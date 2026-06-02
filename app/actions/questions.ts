"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import type { QuestionType, Difficulty } from "@/app/generated/prisma/client"

// ─── Types ────────────────────────────────────────────
export interface QuestionFormData {
  content: string
  answer: string
  explanation?: string
  questionType: QuestionType
  difficulty: Difficulty
  knowledgePointIds: string[]
  optionLabels?: string[]
  optionTexts?: string[]
  source?: string
}

// ─── Create ───────────────────────────────────────────
export async function createQuestion(formData: FormData) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "TEACHER") {
    return { success: false, error: "仅教师可以添加题目" }
  }

  const content = formData.get("content") as string
  const answer = formData.get("answer") as string
  const explanation = (formData.get("explanation") as string) || undefined
  const questionType = formData.get("questionType") as string
  const difficulty = formData.get("difficulty") as string
  const kpIdsStr = formData.get("knowledgePointIds") as string // JSON array
  const source = (formData.get("source") as string) || "manual"

  if (!content || !answer || !questionType || !difficulty) {
    return { success: false, error: "请填写所有必填字段" }
  }

  let knowledgePointIds: string[] = []
  try {
    knowledgePointIds = JSON.parse(kpIdsStr || "[]")
  } catch {
    return { success: false, error: "知识点数据格式错误" }
  }

  if (knowledgePointIds.length === 0) {
    return { success: false, error: "请至少选择一个知识点" }
  }

  // Build options for CHOICE type
  let options: { label: string; text: string }[] | undefined
  if (questionType === "CHOICE") {
    const labels = formData.getAll("optionLabels") as string[]
    const texts = formData.getAll("optionTexts") as string[]
    if (labels.length > 0 && texts.length > 0) {
      options = labels.map((label, i) => ({
        label,
        text: texts[i] || "",
      }))
    }
  }

  try {
    const question = await prisma.question.create({
      data: {
        content,
        answer,
        explanation,
        questionType: questionType as QuestionType,
        difficulty: difficulty as Difficulty,
        options: options ? (JSON.parse(JSON.stringify(options)) as any) : undefined,
        source,
        knowledgePoints: {
          create: knowledgePointIds.map((kpId) => ({
            knowledgePointId: kpId,
          })),
        },
      },
    })

    revalidatePath("/questions")
    return { success: true, questionId: question.id }
  } catch (e) {
    return { success: false, error: `保存失败: ${(e as Error).message}` }
  }
}

// ─── Update ───────────────────────────────────────────
export async function updateQuestion(questionId: string, formData: FormData) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "TEACHER") {
    return { success: false, error: "仅教师可以编辑题目" }
  }

  const content = formData.get("content") as string
  const answer = formData.get("answer") as string
  const explanation = (formData.get("explanation") as string) || undefined
  const questionType = formData.get("questionType") as string
  const difficulty = formData.get("difficulty") as string
  const kpIdsStr = formData.get("knowledgePointIds") as string

  if (!content || !answer) {
    return { success: false, error: "请填写所有必填字段" }
  }

  let knowledgePointIds: string[] = []
  try {
    knowledgePointIds = JSON.parse(kpIdsStr || "[]")
  } catch {
    return { success: false, error: "知识点数据格式错误" }
  }

  let options: { label: string; text: string }[] | undefined
  if (questionType === "CHOICE") {
    const labels = formData.getAll("optionLabels") as string[]
    const texts = formData.getAll("optionTexts") as string[]
    if (labels.length > 0 && texts.length > 0) {
      options = labels.map((label, i) => ({
        label,
        text: texts[i] || "",
      }))
    }
  }

  try {
    // Delete old KP relations and recreate
    await prisma.knowledgePointOnQuestion.deleteMany({
      where: { questionId },
    })

    const question = await prisma.question.update({
      where: { id: questionId },
      data: {
        content,
        answer,
        explanation,
        questionType: questionType as QuestionType,
        difficulty: difficulty as Difficulty,
        options: options ? (JSON.parse(JSON.stringify(options)) as any) : undefined,
        knowledgePoints: {
          create: knowledgePointIds.map((kpId) => ({
            knowledgePointId: kpId,
          })),
        },
      },
    })

    revalidatePath("/questions")
    revalidatePath(`/questions/${questionId}`)
    return { success: true, questionId: question.id }
  } catch (e) {
    return { success: false, error: `更新失败: ${(e as Error).message}` }
  }
}

// ─── Delete ───────────────────────────────────────────
export async function deleteQuestion(questionId: string) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "TEACHER") {
    return { success: false, error: "仅教师可以删除题目" }
  }

  try {
    // Soft delete: just mark inactive
    await prisma.question.update({
      where: { id: questionId },
      data: { isActive: false },
    })

    revalidatePath("/questions")
    return { success: true }
  } catch (e) {
    return { success: false, error: `删除失败: ${(e as Error).message}` }
  }
}

// ─── Toggle active ────────────────────────────────────
export async function toggleQuestionActive(questionId: string, isActive: boolean) {
  "use server"
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "TEACHER") {
    return
  }

  await prisma.question.update({
    where: { id: questionId },
    data: { isActive },
  })

  revalidatePath("/questions")
}
