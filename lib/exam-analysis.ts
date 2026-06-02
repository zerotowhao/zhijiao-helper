/**
 * 考试分析引擎
 *
 * 根据考试答题数据，计算每个学生在每个知识点上的得分率，
 * 生成 StudentKpAnalysis 聚合数据，用于定位薄弱环节。
 */

import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/app/generated/prisma/client"

interface QuestionScore {
  questionId: string
  score: number
  maxScore: number
}

interface StudentExamRow {
  studentId: string
  questions: QuestionScore[]
}

/**
 * 运行完整分析流程：
 * 1. 根据 ExamQuestionResult 计算每个学生每个知识点的得分率
 * 2. Upsert StudentKpAnalysis 记录
 */
export async function runExamAnalysis(examId: string) {
  // 获取考试的所有答题记录，包含题目-知识点关联
  const examResults = await prisma.examResult.findMany({
    where: { examId },
    include: {
      questionResults: {
        include: {
          question: {
            include: {
              knowledgePoints: {
                include: {
                  knowledgePoint: true,
                },
              },
            },
          },
        },
      },
    },
  })

  // 按学生聚合：studentId → kpId → { totalScore, totalMaxScore, wrongCount, totalQuestions }
  const kpAgg = new Map<
    string,
    Map<
      string,
      { totalScore: number; totalMaxScore: number; wrongCount: number; totalQuestions: number }
    >
  >()

  for (const result of examResults) {
    const studentId = result.studentId
    if (!kpAgg.has(studentId)) {
      kpAgg.set(studentId, new Map())
    }
    const studentKpMap = kpAgg.get(studentId)!

    for (const qr of result.questionResults) {
      const kps = qr.question.knowledgePoints.map((k) => k.knowledgePoint)

      for (const kp of kps) {
        if (!studentKpMap.has(kp.id)) {
          studentKpMap.set(kp.id, {
            totalScore: 0,
            totalMaxScore: 0,
            wrongCount: 0,
            totalQuestions: 0,
          })
        }
        const agg = studentKpMap.get(kp.id)!
        agg.totalScore += qr.score
        agg.totalMaxScore += qr.maxScore
        agg.totalQuestions += 1
        if (qr.isWrong) {
          agg.wrongCount += 1
        }
      }
    }
  }

  // Upsert StudentKpAnalysis 记录
  const upserts: Prisma.Prisma__StudentKpAnalysisClient<unknown>[] = []

  for (const [studentId, kpMap] of kpAgg) {
    for (const [kpId, agg] of kpMap) {
      const scoreRate =
        agg.totalMaxScore > 0 ? agg.totalScore / agg.totalMaxScore : 0

      upserts.push(
        prisma.studentKpAnalysis.upsert({
          where: {
            studentId_knowledgePointId: {
              studentId,
              knowledgePointId: kpId,
            },
          },
          create: {
            studentId,
            knowledgePointId: kpId,
            scoreRate,
            totalQuestions: agg.totalQuestions,
            wrongCount: agg.wrongCount,
          },
          update: {
            scoreRate,
            totalQuestions: agg.totalQuestions,
            wrongCount: agg.wrongCount,
          },
        }) as any
      )
    }
  }

  await Promise.all(upserts)

  return {
    studentCount: kpAgg.size,
    analysisCount: upserts.length,
  }
}

/**
 * 获取班级薄弱知识点（按平均得分率升序）
 */
export async function getClassWeakPoints(classId: string, topN = 10) {
  // 获取该班级所有学生的 ID
  const students = await prisma.user.findMany({
    where: { classId, role: "STUDENT" },
    select: { id: true },
  })
  const studentIds = students.map((s) => s.id)

  // SQLite 不支持标量子查询，使用两步聚合
  const analyses = await prisma.studentKpAnalysis.findMany({
    where: { studentId: { in: studentIds } },
    include: {
      knowledgePoint: {
        select: { id: true, name: true, book: true, module: true },
      },
    },
  })

  // 按知识点聚合：kpId → { rates, totalQuestions, wrongCount }
  const kpAgg = new Map<
    string,
    {
      info: { name: string; book: string; module: string }
      rates: number[]
      totalQuestions: number
      wrongCount: number
    }
  >()

  for (const a of analyses) {
    if (!kpAgg.has(a.knowledgePointId)) {
      kpAgg.set(a.knowledgePointId, {
        info: {
          name: a.knowledgePoint.name,
          book: a.knowledgePoint.book,
          module: a.knowledgePoint.module,
        },
        rates: [],
        totalQuestions: 0,
        wrongCount: 0,
      })
    }
    const agg = kpAgg.get(a.knowledgePointId)!
    agg.rates.push(a.scoreRate)
    agg.totalQuestions += a.totalQuestions
    agg.wrongCount += a.wrongCount
  }

  // 计算平均得分率并排序
  const result = Array.from(kpAgg.entries())
    .map(([kpId, agg]) => ({
      knowledgePointId: kpId,
      knowledgePointName: agg.info.name,
      book: agg.info.book,
      module: agg.info.module,
      avgScoreRate: agg.rates.reduce((a, b) => a + b, 0) / agg.rates.length,
      studentCount: agg.rates.length,
      weakStudentCount: agg.rates.filter((r) => r < 0.6).length,
      totalQuestions: agg.totalQuestions,
      wrongCount: agg.wrongCount,
    }))
    .sort((a, b) => a.avgScoreRate - b.avgScoreRate)
    .slice(0, topN)

  return result
}

/**
 * 获取单个学生的薄弱知识点
 */
export async function getStudentWeakPoints(studentId: string, topN = 10) {
  const analyses = await prisma.studentKpAnalysis.findMany({
    where: { studentId },
    orderBy: { scoreRate: "asc" },
    take: topN,
    include: {
      knowledgePoint: {
        select: { id: true, name: true, book: true, module: true },
      },
    },
  })

  return analyses.map((a) => ({
    knowledgePointId: a.knowledgePointId,
    knowledgePointName: a.knowledgePoint.name,
    book: a.knowledgePoint.book,
    module: a.knowledgePoint.module,
    scoreRate: a.scoreRate,
    totalQuestions: a.totalQuestions,
    wrongCount: a.wrongCount,
  }))
}
