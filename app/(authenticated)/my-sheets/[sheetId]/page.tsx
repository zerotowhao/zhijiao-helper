import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react"

interface Props {
  params: Promise<{ sheetId: string }>
}

export default async function MySheetDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user) return null

  const userId = (session.user as any).userId || (session.user as any).id
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
      <div className="p-8 text-center">
        <p className="text-zinc-500">练习单不存在</p>
        <Link href="/my-sheets" className="text-emerald-600 text-sm mt-2 block">
          ← 返回
        </Link>
      </div>
    )
  }

  // Access control: student can only view own, teacher can view all
  const userRole = (session.user as any).role
  if (userRole === "STUDENT" && sheet.studentId !== userId) {
    return (
      <div className="p-8 text-center">
        <p className="text-zinc-500">无权访问</p>
        <Link href="/my-sheets" className="text-emerald-600 text-sm mt-2 block">
          ← 返回
        </Link>
      </div>
    )
  }

  const latestSub = sheet.submissions[0]
  const wrongNumbers: string[] = latestSub?.wrongNumbers
    ? (latestSub.wrongNumbers as string[])
    : []
  const wrongSet = new Set(wrongNumbers.map(Number))

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <Link
        href={userRole === "STUDENT" ? "/my-sheets" : "/sheets"}
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-4"
      >
        <ArrowLeft className="size-3.5" />
        返回练习单列表
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-zinc-900">
          {sheet.student.name} · {sheet.weekLabel}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {sheet.student.studentNumber} · {sheet.items.length} 题
          {latestSub && ` · ${latestSub.submittedAt.toLocaleDateString("zh-CN")} 提交`}
        </p>
      </div>

      {/* Score summary */}
      {latestSub && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-zinc-900">
              {sheet.items.length}
            </p>
            <p className="text-xs text-zinc-500 mt-1">总题数</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">
              {sheet.items.length - wrongNumbers.length}
            </p>
            <p className="text-xs text-zinc-500 mt-1">正确</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-2xl font-bold text-red-500">
              {wrongNumbers.length}
            </p>
            <p className="text-xs text-zinc-500 mt-1">错误</p>
          </div>
        </div>
      )}

      {/* Questions with results */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-4 md:px-5 py-3 border-b border-zinc-100 bg-zinc-50">
          <h2 className="font-semibold text-zinc-900 text-sm">答题详情</h2>
        </div>
        <div className="divide-y divide-zinc-100">
          {sheet.items.map((item: any) => {
            const q = item.question
            const kps = q.knowledgePoints.map(
              (k: any) => k.knowledgePoint
            )
            const isWrong = wrongSet.has(item.sortOrder)

            return (
              <div
                key={item.id}
                className={`px-4 md:px-5 py-3.5 ${
                  isWrong ? "bg-red-50/40" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Status icon */}
                  <div className="shrink-0 mt-0.5">
                    {latestSub ? (
                      isWrong ? (
                        <XCircle className="size-5 text-red-500" />
                      ) : (
                        <CheckCircle className="size-5 text-emerald-500" />
                      )
                    ) : (
                      <span className="size-5 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-500">
                        {item.sortOrder}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <TypeBadge type={q.questionType} />
                      <DifficultyBadge difficulty={q.difficulty} />
                      {item.isReview && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                          复习
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-800 leading-relaxed mb-1.5">
                      {q.content}
                    </p>
                    {q.questionType === "CHOICE" &&
                      q.options &&
                      Array.isArray(q.options) && (
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mb-1.5">
                          {(
                            q.options as { label: string; text: string }[]
                          ).map((opt) => (
                            <span
                              key={opt.label}
                              className="text-xs text-zinc-500"
                            >
                              {opt.label}. {opt.text}
                            </span>
                          ))}
                        </div>
                      )}
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {kps.map((kp: any) => (
                        <span
                          key={kp.id}
                          className="text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded"
                        >
                          {kp.book} · {kp.name}
                        </span>
                      ))}
                    </div>
                    {/* Show answer for reference */}
                    <details className="mt-1">
                      <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-600">
                        查看答案
                      </summary>
                      <p className="text-xs text-zinc-600 mt-1 bg-zinc-50 rounded p-2">
                        答案：{q.answer}
                        {q.explanation && (
                          <>
                            <br />
                            解析：{q.explanation}
                          </>
                        )}
                      </p>
                    </details>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Submission history */}
      {sheet.submissions.length > 1 && (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden mt-6">
          <div className="px-4 md:px-5 py-3 border-b border-zinc-100 bg-zinc-50">
            <h2 className="font-semibold text-zinc-900 text-sm">历史提交</h2>
          </div>
          <div className="divide-y divide-zinc-100">
            {sheet.submissions.map((sub) => {
              const wnums = sub.wrongNumbers
                ? (sub.wrongNumbers as string[])
                : []
              return (
                <div
                  key={sub.id}
                  className="px-4 md:px-5 py-3 flex items-center justify-between"
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
                      正确 {sheet.items.length - wnums.length} / 错误{" "}
                      {wnums.length}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
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
