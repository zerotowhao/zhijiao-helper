import { requireTeacher } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { markSheetPrinted } from "@/app/actions/practice-sheets"
import Link from "next/link"
import { ArrowLeft, Printer, Download } from "lucide-react"

interface Props {
  params: Promise<{ sheetId: string }>
}

export default async function SheetDetailPage({ params }: Props) {
  await requireTeacher()
  const { sheetId } = await params

  const sheet = await prisma.practiceSheet.findUnique({
    where: { id: sheetId },
    include: {
      student: { select: { id: true, name: true, studentNumber: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          question: {
            include: {
              knowledgePoints: {
                include: {
                  knowledgePoint: { select: { id: true, name: true, book: true } },
                },
              },
            },
          },
        },
      },
      submissions: {
        orderBy: { submittedAt: "desc" },
        take: 5,
      },
    },
  })

  if (!sheet) {
    return (
      <div className="p-8">
        <p className="text-zinc-500">练习单不存在</p>
        <Link href="/sheets" className="text-emerald-600 text-sm mt-2 block">
          ← 返回
        </Link>
      </div>
    )
  }

  const reviewCount = sheet.items.filter((i) => i.isReview).length
  const newCount = sheet.items.length - reviewCount

  return (
    <div className="p-8 max-w-5xl">
      <Link
        href="/sheets"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-4"
      >
        <ArrowLeft className="size-3.5" />
        返回练习单列表
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            {sheet.student.name} 的练习单
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {sheet.student.studentNumber} · {sheet.weekLabel} ·{" "}
            {newCount} 新题 + {reviewCount} 复习题
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PdfDownloadButton sheetId={sheet.id} />
          <form action={markSheetPrinted.bind(null, sheet.id)}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              <Printer className="size-4" />
              标记已打印
            </button>
          </form>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatBox label="题目总数" value={String(sheet.items.length)} />
        <StatBox label="新题" value={String(newCount)} color="text-emerald-600" />
        <StatBox label="复习题" value={String(reviewCount)} color="text-amber-600" />
        <StatBox
          label="状态"
          value={statusLabel(sheet.status)}
          color={
            sheet.status === "GENERATED"
              ? "text-emerald-600"
              : sheet.status === "PRINTED"
                ? "text-blue-600"
                : sheet.status === "SUBMITTED"
                  ? "text-purple-600"
                  : "text-zinc-600"
          }
        />
      </div>

      {/* Questions */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">题目列表</h2>
        </div>
        <div className="divide-y divide-zinc-100">
          {sheet.items.map((item) => {
            const q = item.question
            const kps = q.knowledgePoints.map((k) => k.knowledgePoint)
            return (
              <div
                key={item.id}
                className={`px-5 py-4 hover:bg-zinc-50 ${
                  item.isReview ? "bg-amber-50/30" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`size-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                      item.isReview
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {item.sortOrder}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <TypeBadge type={q.questionType} />
                      <DifficultyBadge difficulty={q.difficulty} />
                      {item.isReview && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                          复习题
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-900 mb-1.5">
                      {q.content.length > 120
                        ? q.content.slice(0, 120) + "..."
                        : q.content}
                    </p>
                    {q.questionType === "CHOICE" &&
                      q.options &&
                      Array.isArray(q.options) && (
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mb-1.5">
                          {(q.options as { label: string; text: string }[]).map(
                            (opt) => (
                              <span
                                key={opt.label}
                                className="text-xs text-zinc-500"
                              >
                                {opt.label}. {opt.text}
                              </span>
                            )
                          )}
                        </div>
                      )}
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {kps.map((kp) => (
                        <span
                          key={kp.id}
                          className="text-xs bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded"
                        >
                          {kp.book} · {kp.name}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-zinc-400">
                      答案：{q.answer}
                      {q.explanation && ` · 解析：${q.explanation}`}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Submissions */}
      {sheet.submissions.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden mt-8">
          <div className="px-5 py-4 border-b border-zinc-100">
            <h2 className="font-semibold text-zinc-900">提交记录</h2>
          </div>
          <div className="divide-y divide-zinc-100">
            {sheet.submissions.map((sub) => (
              <div
                key={sub.id}
                className="px-5 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm text-zinc-900">
                    {sub.submittedAt.toLocaleDateString("zh-CN")}{" "}
                    {sub.submittedAt.toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-xs text-zinc-500">
                    错题数：{" "}
                    {sub.wrongNumbers
                      ? (sub.wrongNumbers as string[]).length
                      : "未统计"}
                    {sub.ocrText && ` · OCR识别`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({
  label,
  value,
  color = "text-zinc-900",
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
    </div>
  )
}

function statusLabel(s: string) {
  const m: Record<string, string> = {
    DRAFT: "草稿",
    GENERATED: "已生成",
    PRINTED: "已打印",
    SUBMITTED: "已提交",
    REVIEWED: "已批阅",
  }
  return m[s] || s
}

function TypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    CHOICE: "选择题",
    FILL_IN_BLANK: "填空题",
    SHORT_ANSWER: "简答题",
    EXPERIMENT_DESIGN: "实验设计",
    CHART_ANALYSIS: "图表分析",
  }
  return (
    <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
      {labels[type] || type}
    </span>
  )
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    EASY: "bg-emerald-50 text-emerald-700",
    MEDIUM: "bg-amber-50 text-amber-700",
    HARD: "bg-red-50 text-red-700",
  }
  const labels: Record<string, string> = {
    EASY: "简单",
    MEDIUM: "中等",
    HARD: "困难",
  }
  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded ${colors[difficulty] || "bg-zinc-100 text-zinc-600"}`}
    >
      {labels[difficulty] || difficulty}
    </span>
  )
}

function PdfDownloadButton({ sheetId }: { sheetId: string }) {
  return (
    <a
      href={`/api/sheets/${sheetId}/pdf`}
      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
    >
      <Download className="size-4" />
      下载 PDF
    </a>
  )
}
