/**
 * 练习单生成引擎
 *
 * 根据学生薄弱知识点 + SM-2 间隔重复，为每个学生生成个性化练习单。
 * 策略：
 *   60% 题目来自薄弱知识点（得分率最低的）
 *   40% 来自到期的 SM-2 间隔复习题
 *   总数不足时用薄弱知识点题目补充
 */

import { prisma } from "@/lib/prisma"

const DEFAULT_SHEET_SIZE = 10
const NEW_QUESTION_RATIO = 0.6

export interface GeneratedSheetItem {
  questionId: string
  sortOrder: number
  isReview: boolean
  question: {
    content: string
    answer: string
    explanation: string | null
    questionType: string
    difficulty: string
    options: unknown
  }
  knowledgePoints: { name: string; book: string }[]
}

/**
 * 为指定学生生成个性化练习单题目
 */
export async function generateSheetQuestions(
  studentId: string,
  targetSize = DEFAULT_SHEET_SIZE
): Promise<{
  studentName: string
  studentNumber: string | null
  items: GeneratedSheetItem[]
  weakKpSummary: { name: string; scoreRate: number }[]
}> {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, studentNumber: true },
  })
  if (!student) throw new Error(`学生 ${studentId} 不存在`)

  // 1. Get weak KPs (scoreRate < 0.7)
  const weakKps = await prisma.studentKpAnalysis.findMany({
    where: { studentId, scoreRate: { lt: 0.7 } },
    orderBy: { scoreRate: "asc" },
    include: { knowledgePoint: { select: { id: true, name: true } } },
    take: 10,
  })

  // 2. Get already-used question IDs
  const usedSheets = await prisma.practiceSheet.findMany({
    where: { studentId },
    select: { items: { select: { questionId: true } } },
  })
  const usedQuestionIds = new Set(
    usedSheets.flatMap((s) => s.items.map((i) => i.questionId))
  )

  // 3. Get new questions from weak KPs
  const weakKpIds = weakKps.map((wk) => wk.knowledgePointId)
  let newQuestions: Awaited<ReturnType<typeof prisma.question.findMany>> = []

  if (weakKpIds.length > 0) {
    newQuestions = await prisma.question.findMany({
      where: {
        isActive: true,
        id: { notIn: [...usedQuestionIds] },
        knowledgePoints: {
          some: { knowledgePointId: { in: weakKpIds } },
        },
      },
      take: Math.ceil(targetSize * 1.5),
    })
  }

  // 4. Get SM-2 reviews that are due, then fetch questions separately
  const reviewStates = await prisma.spacedRepetitionState.findMany({
    where: {
      studentId,
      nextReviewDate: { lte: new Date() },
    },
    orderBy: { nextReviewDate: "asc" },
    take: targetSize,
  })

  const reviewQuestionIds = reviewStates.map((r) => r.questionId)
  const reviewQuestions =
    reviewQuestionIds.length > 0
      ? await prisma.question.findMany({
          where: { id: { in: reviewQuestionIds }, isActive: true },
        })
      : []

  // Build a map for O(1) lookup
  const reviewQuestionMap = new Map(reviewQuestions.map((q) => [q.id, q]))

  // 5. Get all knowledge point data for selected questions
  const allQuestionIds = [
    ...newQuestions.slice(0, targetSize).map((q) => q.id),
    ...reviewStates.slice(0, targetSize).map((r) => r.questionId),
  ]

  const questionsWithKps =
    allQuestionIds.length > 0
      ? await prisma.question.findMany({
          where: { id: { in: allQuestionIds } },
          include: {
            knowledgePoints: {
              include: {
                knowledgePoint: { select: { name: true, book: true } },
              },
            },
          },
        })
      : []

  const kpMap = new Map(questionsWithKps.map((q) => [q.id, q]))

  // 6. Combine
  const newCount = Math.min(
    Math.ceil(targetSize * NEW_QUESTION_RATIO),
    newQuestions.length
  )
  const reviewCount = Math.min(
    targetSize - newCount,
    reviewStates.length
  )
  const actualNewCount = targetSize - reviewCount

  const selectedNew = newQuestions.slice(0, actualNewCount)
  const selectedReviews = reviewStates.slice(0, reviewCount)

  const items: GeneratedSheetItem[] = []

  for (let i = 0; i < selectedNew.length; i++) {
    const q = selectedNew[i]
    const kps = kpMap.get(q.id)
    items.push({
      questionId: q.id,
      sortOrder: i + 1,
      isReview: false,
      question: {
        content: q.content,
        answer: q.answer,
        explanation: q.explanation,
        questionType: q.questionType,
        difficulty: q.difficulty,
        options: q.options,
      },
      knowledgePoints:
        kps?.knowledgePoints.map((k: any) => ({
          name: k.knowledgePoint.name,
          book: k.knowledgePoint.book,
        })) || [],
    })
  }

  for (let i = 0; i < selectedReviews.length; i++) {
    const r = selectedReviews[i]
    const q = reviewQuestionMap.get(r.questionId)
    const kps = kpMap.get(r.questionId)
    if (q) {
      items.push({
        questionId: q.id,
        sortOrder: selectedNew.length + i + 1,
        isReview: true,
        question: {
          content: q.content,
          answer: q.answer,
          explanation: q.explanation,
          questionType: q.questionType,
          difficulty: q.difficulty,
          options: q.options,
        },
        knowledgePoints:
          kps?.knowledgePoints.map((k: any) => ({
            name: k.knowledgePoint.name,
            book: k.knowledgePoint.book,
          })) || [],
      })
    }
  }

  return {
    studentName: student.name,
    studentNumber: student.studentNumber,
    items,
    weakKpSummary: weakKps.slice(0, 5).map((wk) => ({
      name: wk.knowledgePoint.name,
      scoreRate: wk.scoreRate,
    })),
  }
}

export function getWeekLabel(date: Date = new Date()): string {
  const year = date.getFullYear()
  const oneJan = new Date(year, 0, 1)
  const weekNum = Math.ceil(
    ((date.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7
  )
  return `${year}-W${String(weekNum).padStart(2, "0")}`
}
