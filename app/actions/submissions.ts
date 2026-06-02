"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"

/**
 * SM-2 算法：根据答题结果更新间隔重复状态
 */
function sm2Update(
  current: {
    interval: number
    repetitions: number
    easeFactor: number
  },
  quality: number // 0-5
): { interval: number; repetitions: number; easeFactor: number; nextReviewDate: Date } {
  let { interval, repetitions, easeFactor } = current

  if (quality >= 3) {
    // 正确回答
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easeFactor)
    }
    repetitions += 1
  } else {
    // 错误回答
    repetitions = 0
    interval = 1
  }

  // 更新 easeFactor
  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  )

  const nextReviewDate = new Date()
  nextReviewDate.setDate(nextReviewDate.getDate() + interval)

  return { interval, repetitions, easeFactor, nextReviewDate }
}

/**
 * 学生提交练习单
 * 记录错题编号，上传照片（可选），更新 SM-2 间隔重复状态
 */
export async function createSubmission(
  sheetId: string,
  wrongNumbers: string[],
  photoUrls?: string[]
) {
  const session = await auth()
  if (!session?.user) {
    return { success: false, error: "请先登录" }
  }
  const userId = (session.user as any).userId || (session.user as any).id

  // Verify the sheet belongs to this student
  const sheet = await prisma.practiceSheet.findUnique({
    where: { id: sheetId },
    include: {
      items: {
        include: {
          question: {
            include: {
              knowledgePoints: {
                include: { knowledgePoint: true },
              },
            },
          },
        },
      },
    },
  })

  if (!sheet) {
    return { success: false, error: "练习单不存在" }
  }

  if (sheet.studentId !== userId) {
    return { success: false, error: "只能提交自己的练习单" }
  }

  if (sheet.status === "SUBMITTED" || sheet.status === "REVIEWED") {
    return { success: false, error: "该练习单已提交过" }
  }

  // Create submission record
  const submission = await prisma.studentSubmission.create({
    data: {
      sheetId,
      studentId: userId,
      wrongNumbers: wrongNumbers,
      photoUrls: photoUrls || [],
      submittedAt: new Date(),
    },
  })

  // Update sheet status
  await prisma.practiceSheet.update({
    where: { id: sheetId },
    data: { status: "SUBMITTED" },
  })

  // Update SM-2 states for each question
  const wrongSet = new Set(wrongNumbers.map(Number))
  const now = new Date()

  for (const item of sheet.items) {
    const isWrong = wrongSet.has(item.sortOrder)
    const quality = isWrong ? 1 : 4 // SM-2 quality: 1 = wrong, 4 = correct with hesitation

    // Find existing SM-2 state
    const existing = await prisma.spacedRepetitionState.findUnique({
      where: {
        studentId_questionId: {
          studentId: userId,
          questionId: item.questionId,
        },
      },
    })

    // Get knowledge point IDs
    const kpIds = item.question.knowledgePoints.map((k) => k.knowledgePointId)

    if (existing) {
      const updated = sm2Update(
        {
          interval: existing.interval,
          repetitions: existing.repetitions,
          easeFactor: existing.easeFactor,
        },
        quality
      )

      await prisma.spacedRepetitionState.update({
        where: { id: existing.id },
        data: {
          interval: updated.interval,
          repetitions: updated.repetitions,
          easeFactor: updated.easeFactor,
          nextReviewDate: updated.nextReviewDate,
          lastReviewDate: now,
          lastScore: quality,
        },
      })
    } else {
      // Create new SM-2 state for first-time review
      const initial = sm2Update(
        { interval: 1, repetitions: 0, easeFactor: 2.5 },
        quality
      )

      // Use the primary knowledge point (first one)
      const kpId = kpIds[0]
      if (kpId) {
        await prisma.spacedRepetitionState.create({
          data: {
            studentId: userId,
            questionId: item.questionId,
            knowledgePointId: kpId,
            interval: initial.interval,
            repetitions: initial.repetitions,
            easeFactor: initial.easeFactor,
            nextReviewDate: initial.nextReviewDate,
            lastReviewDate: now,
            lastScore: quality,
          },
        })
      }
    }
  }

  // Update weekly progress
  const weekLabel = sheet.weekLabel
  const totalQuestions = sheet.items.length
  const correctCount = totalQuestions - wrongNumbers.length
  const completionRate = totalQuestions > 0 ? correctCount / totalQuestions : 0

  // Get previous week streak
  const prevWeekLabel = getPrevWeekLabel(weekLabel)
  const prevProgress = await prisma.weeklyProgress.findUnique({
    where: {
      studentId_weekLabel: {
        studentId: userId,
        weekLabel: prevWeekLabel,
      },
    },
  })

  const streakWeeks =
    prevProgress && prevProgress.completionRate >= 0.6
      ? prevProgress.streakWeeks + 1
      : completionRate >= 0.6
        ? 1
        : 0

  await prisma.weeklyProgress.upsert({
    where: {
      studentId_weekLabel: {
        studentId: userId,
        weekLabel,
      },
    },
    create: {
      studentId: userId,
      weekLabel,
      completionRate,
      totalQuestions,
      correctCount,
      streakWeeks,
    },
    update: {
      completionRate,
      totalQuestions,
      correctCount,
      streakWeeks,
    },
  })

  revalidatePath("/my-sheets")
  revalidatePath(`/sheets/${sheetId}`)
  revalidatePath("/sheets")

  return {
    success: true,
    submissionId: submission.id,
    stats: {
      total: totalQuestions,
      correct: correctCount,
      wrong: wrongNumbers.length,
    },
  }
}

/**
 * 获取学生的提交列表
 */
export async function getStudentSubmissions(studentId?: string) {
  const session = await auth()
  if (!session?.user) return []

  const userId = studentId || (session.user as any).userId || (session.user as any).id

  return prisma.studentSubmission.findMany({
    where: { studentId: userId },
    include: {
      sheet: {
        select: { weekLabel: true },
      },
    },
    orderBy: { submittedAt: "desc" },
    take: 30,
  })
}

/**
 * 获取单次提交详情
 */
export async function getSubmissionDetail(submissionId: string) {
  const session = await auth()
  if (!session?.user) return null

  return prisma.studentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      sheet: {
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
            include: {
              question: {
                include: {
                  knowledgePoints: {
                    include: {
                      knowledgePoint: { select: { name: true, book: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      student: { select: { name: true, studentNumber: true } },
    },
  })
}

function getPrevWeekLabel(current: string): string {
  const parts = current.split("-W")
  if (parts.length !== 2) return ""
  const year = parseInt(parts[0])
  const week = parseInt(parts[1])
  if (week > 1) {
    return `${year}-W${String(week - 1).padStart(2, "0")}`
  }
  // Week 1 of year → last week of previous year
  const prevYear = year - 1
  const lastWeek = getWeeksInYear(prevYear)
  return `${prevYear}-W${String(lastWeek).padStart(2, "0")}`
}

function getWeeksInYear(year: number): number {
  const dec31 = new Date(year, 11, 31)
  const jan01 = new Date(year, 0, 1)
  const days = (dec31.getTime() - jan01.getTime()) / 86400000
  return Math.ceil((days + jan01.getDay() + 1) / 7)
}
