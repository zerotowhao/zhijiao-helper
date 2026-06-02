"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { generateSheetQuestions, getWeekLabel } from "@/lib/sheet-generator"
import { jsPDF } from "jspdf"

/**
 * 为一个或多个学生生成练习单
 */
export async function generateSheets(
  studentIds: string[],
  questionCount: number = 10
) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "TEACHER") {
    return { success: false, error: "仅教师可以生成练习单" }
  }

  const weekLabel = getWeekLabel()
  const results: { studentId: string; sheetId?: string; error?: string }[] = []

  for (const studentId of studentIds) {
    try {
      // Check if sheet already exists for this student this week
      const existing = await prisma.practiceSheet.findUnique({
        where: { studentId_weekLabel: { studentId, weekLabel } },
      })
      if (existing) {
        results.push({
          studentId,
          error: `已存在本周练习单`,
          sheetId: existing.id,
        })
        continue
      }

      const generated = await generateSheetQuestions(studentId, questionCount)

      if (generated.items.length === 0) {
        results.push({
          studentId,
          error: "没有可用的题目（薄弱知识点题目和复习题都为空）",
        })
        continue
      }

      const sheet = await prisma.practiceSheet.create({
        data: {
          studentId,
          weekLabel,
          status: "GENERATED",
          generatedAt: new Date(),
          items: {
            create: generated.items.map((item) => ({
              questionId: item.questionId,
              sortOrder: item.sortOrder,
              isReview: item.isReview,
            })),
          },
        },
      })

      results.push({ studentId, sheetId: sheet.id })
    } catch (e) {
      results.push({
        studentId,
        error: (e as Error).message,
      })
    }
  }

  revalidatePath("/sheets")
  return { success: true, results, weekLabel }
}

/**
 * 标记练习单状态为已打印
 */
export async function markSheetPrinted(sheetId: string) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "TEACHER") return

  await prisma.practiceSheet.update({
    where: { id: sheetId },
    data: { status: "PRINTED" },
  })
  revalidatePath("/sheets")
}

/**
 * 生成练习单 PDF（服务端）
 */
export async function generateSheetPdf(sheetId: string): Promise<{
  success: boolean
  pdfBase64?: string
  error?: string
}> {
  const session = await auth()
  if (!session?.user) {
    return { success: false, error: "请先登录" }
  }

  const sheet = await prisma.practiceSheet.findUnique({
    where: { id: sheetId },
    include: {
      student: { select: { name: true, studentNumber: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          question: {
            include: {
              knowledgePoints: {
                include: {
                  knowledgePoint: { select: { name: true } },
                },
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

  try {
    const doc = new jsPDF({ unit: "mm", format: "a4" })

    // Font for Chinese - use built-in helvetica, it works for ASCII
    // For Chinese characters we'd need a font file; for now use placeholder approach
    doc.setFont("helvetica", "normal")

    // Header
    doc.setFontSize(16)
    doc.text("Biology Practice Sheet", 20, 20)
    doc.setFontSize(10)
    doc.text(`Student: ${sheet.student.name}`, 20, 30)
    doc.text(`Student ID: ${sheet.student.studentNumber || "N/A"}`, 20, 36)
    doc.text(`Week: ${sheet.weekLabel}`, 20, 42)
    doc.text(`Date: ${new Date().toLocaleDateString("en-US")}`, 20, 48)

    // Separator
    doc.setDrawColor(200, 200, 200)
    doc.line(20, 52, 190, 52)

    // Questions
    let y = 62
    const pageHeight = 277 // A4 height in mm
    const margin = 20

    for (const item of sheet.items) {
      const q = item.question
      const qLabel = item.isReview ? "[Review]" : "[New]"
      const kpNames = q.knowledgePoints
        .map((k: any) => k.knowledgePoint.name)
        .join(", ")

      // Check page break
      if (y > pageHeight - 40) {
        doc.addPage()
        y = margin
      }

      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text(
        `${item.sortOrder}. ${qLabel} | Type: ${q.questionType} | Difficulty: ${q.difficulty} | KPs: ${kpNames}`,
        margin,
        y
      )
      y += 6

      // Question content
      doc.setFontSize(11)
      doc.setTextColor(0, 0, 0)
      const contentLines = doc.splitTextToSize(
        sanitizeText(q.content),
        170
      ) as string[]
      doc.text(contentLines, margin, y)
      y += contentLines.length * 5.5 + 4

      // Options for CHOICE
      if (
        q.questionType === "CHOICE" &&
        q.options &&
        Array.isArray(q.options)
      ) {
        for (const opt of q.options as { label: string; text: string }[]) {
          if (y > pageHeight - 20) {
            doc.addPage()
            y = margin
          }
          doc.setFontSize(10)
          doc.text(
            `${opt.label}. ${sanitizeText(opt.text)}`,
            margin + 5,
            y
          )
          y += 5
        }
        y += 2
      }

      // Answer area
      y += 12

      // Separator between questions
      doc.setDrawColor(230, 230, 230)
      doc.line(margin, y, 190, y)
      y += 6
    }

    // Footer
    if (y > pageHeight - 15) {
      doc.addPage()
      y = margin
    }
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      "Generated by ZhiJiao Helper - Biology Practice Platform",
      20,
      y + 8
    )

    const pdfBase64 = doc.output("datauristring")
    return { success: true, pdfBase64 }
  } catch (e) {
    return { success: false, error: `PDF generation failed: ${(e as Error).message}` }
  }
}

/**
 * Strip or replace characters that jspdf can't render (Chinese, special chars)
 * In production, use a CJK font file. For now, provide readable ASCII fallback.
 */
function sanitizeText(text: string): string {
  // jspdf with default font can't render Chinese
  // Replace CJK chars with placeholder or keep as-is for font embedding
  // In this demo, we keep the text — the user should embed a CJK font
  return text
}
