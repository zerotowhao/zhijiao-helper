"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { runExamAnalysis } from "@/lib/exam-analysis"
import { revalidatePath } from "next/cache"
import * as XLSX from "xlsx"

export interface ImportResult {
  success: boolean
  examId?: string
  examName?: string
  totalRows: number
  importedRows: number
  skippedRows: number
  errors: string[]
  analysis?: {
    studentCount: number
    analysisCount: number
  }
}

export async function importExamResults(
  formData: FormData
): Promise<ImportResult> {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "TEACHER") {
    return {
      success: false,
      totalRows: 0,
      importedRows: 0,
      skippedRows: 0,
      errors: ["仅教师可以导入考试数据"],
    }
  }

  const errors: string[] = []

  // Parse form data
  const file = formData.get("file") as File | null
  const examName = (formData.get("examName") as string) || "未命名考试"
  const examDateStr = formData.get("examDate") as string
  const classId = formData.get("classId") as string

  if (!file) {
    return {
      success: false,
      totalRows: 0,
      importedRows: 0,
      skippedRows: 0,
      errors: ["请选择要上传的 Excel 文件"],
    }
  }

  if (!classId) {
    return {
      success: false,
      totalRows: 0,
      importedRows: 0,
      skippedRows: 0,
      errors: ["请选择班级"],
    }
  }

  // Parse Excel
  let workbook: XLSX.WorkBook
  try {
    const buffer = await file.arrayBuffer()
    workbook = XLSX.read(buffer, { type: "buffer" })
  } catch {
    return {
      success: false,
      totalRows: 0,
      importedRows: 0,
      skippedRows: 0,
      errors: ["无法解析 Excel 文件，请确认文件格式正确"],
    }
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return {
      success: false,
      totalRows: 0,
      importedRows: 0,
      skippedRows: 0,
      errors: ["Excel 文件为空或没有工作表"],
    }
  }

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, {
    defval: "",
  })

  if (rows.length === 0) {
    return {
      success: false,
      totalRows: 0,
      importedRows: 0,
      skippedRows: 0,
      errors: ["Excel 文件中没有数据行"],
    }
  }

  // Preload: all students in the class and all questions in the system
  const [classStudents, allQuestions] = await Promise.all([
    prisma.user.findMany({
      where: { classId, role: "STUDENT" },
      select: { id: true, studentNumber: true, name: true },
    }),
    prisma.question.findMany({
      where: { isActive: true },
      select: { id: true },
    }),
  ])

  const studentMap = new Map<string, { id: string; name: string }>()
  for (const s of classStudents) {
    if (s.studentNumber) {
      studentMap.set(s.studentNumber, { id: s.id, name: s.name })
    }
  }

  const questionIds = new Set(allQuestions.map((q) => q.id))

  // Parse rows, group by studentId
  // Expected columns: 学生编号, 学生姓名, 题目编号, 题目得分, 题目满分
  const studentScores = new Map<
    string,
    { questionId: string; score: number; maxScore: number; isWrong: boolean }[]
  >()

  let importedRows = 0
  let skippedRows = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const studentNumber = String(row["学生编号"] || row["studentNumber"] || "").trim()
    const questionId = String(row["题目编号"] || row["questionId"] || "").trim()
    const score = Number(row["题目得分"] || row["score"] || 0)
    const maxScore = Number(row["题目满分"] || row["maxScore"] || 0)

    // Validate
    if (!studentNumber || !questionId) {
      skippedRows++
      errors.push(`第 ${i + 2} 行：学生编号或题目编号为空，已跳过`)
      continue
    }

    const student = studentMap.get(studentNumber)
    if (!student) {
      skippedRows++
      errors.push(
        `第 ${i + 2} 行：学生编号 "${studentNumber}" 不在班级 ${classId} 中，已跳过`
      )
      continue
    }

    if (!questionIds.has(questionId)) {
      skippedRows++
      errors.push(
        `第 ${i + 2} 行：题目编号 "${questionId}" 不在题库中，请先在题库中添加该题目`
      )
      continue
    }

    if (maxScore <= 0) {
      skippedRows++
      errors.push(`第 ${i + 2} 行：题目满分必须大于 0，已跳过`)
      continue
    }

    // Score cannot exceed maxScore
    const clampedScore = Math.max(0, Math.min(score, maxScore))
    const isWrong = clampedScore < maxScore * 0.6

    if (!studentScores.has(student.id)) {
      studentScores.set(student.id, [])
    }
    studentScores.get(student.id)!.push({
      questionId,
      score: clampedScore,
      maxScore,
      isWrong,
    })
    importedRows++
  }

  if (studentScores.size === 0) {
    return {
      success: false,
      totalRows: rows.length,
      importedRows: 0,
      skippedRows,
      errors,
    }
  }

  // Create Exam record
  const examDate = examDateStr ? new Date(examDateStr) : new Date()
  const exam = await prisma.exam.create({
    data: {
      name: examName,
      examDate,
      classId,
    },
  })

  // Create ExamResult + ExamQuestionResult records in a transaction
  for (const [studentId, questions] of studentScores) {
    const totalScore = questions.reduce((sum, q) => sum + q.score, 0)
    const maxTotalScore = questions.reduce((sum, q) => sum + q.maxScore, 0)

    const examResult = await prisma.examResult.create({
      data: {
        examId: exam.id,
        studentId,
        totalScore: totalScore,
        questionResults: {
          create: questions.map((q) => ({
            questionId: q.questionId,
            score: q.score,
            maxScore: q.maxScore,
            isWrong: q.isWrong,
          })),
        },
      },
    })
  }

  // Run analysis engine
  let analysis: { studentCount: number; analysisCount: number } | undefined
  try {
    analysis = await runExamAnalysis(exam.id)
  } catch (e) {
    errors.push(
      `分析引擎运行失败: ${(e as Error).message}，但考试数据已保存`
    )
  }

  revalidatePath("/exams")

  return {
    success: true,
    examId: exam.id,
    examName: exam.name,
    totalRows: rows.length,
    importedRows,
    skippedRows,
    errors,
    analysis,
  }
}

/**
 * 获取考试列表（包含统计信息）
 */
export async function getExamsWithStats(classId?: string) {
  const session = await auth()
  if (!session?.user) return []

  const userRole = (session.user as any).role as string
  const userId = (session.user as any).id as string

  const where: any = {}
  if (classId) {
    where.classId = classId
  }
  // If student, only show exams for their class
  if (userRole === "STUDENT") {
    const student = await prisma.user.findUnique({
      where: { id: userId },
      select: { classId: true },
    })
    if (student?.classId) {
      where.classId = student.classId
    } else {
      return []
    }
  }

  const exams = await prisma.exam.findMany({
    where,
    orderBy: { examDate: "desc" },
    include: {
      class: { select: { name: true } },
      _count: { select: { results: true } },
    },
    take: 50,
  })

  return exams.map((e) => ({
    id: e.id,
    name: e.name,
    examDate: e.examDate,
    className: e.class.name,
    studentCount: e._count.results,
  }))
}
