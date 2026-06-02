import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createSubmission } from "@/app/actions/submissions"
import Link from "next/link"
import { ArrowLeft, Send, Camera, X, AlertCircle } from "lucide-react"

interface Props {
  params: Promise<{ sheetId: string }>
}

export default async function SubmitSheetPage({ params }: Props) {
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
        take: 1,
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

  // Only the sheet owner can submit
  if (sheet.studentId !== userId) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="size-12 text-amber-400 mx-auto mb-4" />
        <p className="text-zinc-600 font-medium">无权访问</p>
        <p className="text-sm text-zinc-400 mt-1">只能提交自己的练习单</p>
        <Link href="/my-sheets" className="text-emerald-600 text-sm mt-3 block">
          ← 返回我的练习单
        </Link>
      </div>
    )
  }

  const alreadySubmitted =
    sheet.status === "SUBMITTED" || sheet.status === "REVIEWED"

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <Link
        href="/my-sheets"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-4"
      >
        <ArrowLeft className="size-3.5" />
        返回练习单列表
      </Link>

      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-zinc-900">
          提交练习单
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {sheet.student.name} · {sheet.weekLabel} · {sheet.items.length} 题
        </p>
      </div>

      {alreadySubmitted ? (
        <AlreadySubmittedView sheet={sheet} />
      ) : (
        <SubmissionForm sheet={sheet} />
      )}
    </div>
  )
}

/**
 * Already submitted view - show summary
 */
function AlreadySubmittedView({ sheet }: { sheet: any }) {
  const latestSub = sheet.submissions[0]
  const wrongCount = latestSub?.wrongNumbers
    ? (latestSub.wrongNumbers as string[]).length
    : 0

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 md:p-8 text-center">
      <CheckCircleLarge className="size-16 text-emerald-500 mx-auto mb-4" />
      <h2 className="text-lg font-semibold text-emerald-800 mb-2">已提交成功</h2>
      <p className="text-sm text-emerald-700 mb-4">
        你在 {new Date(latestSub?.submittedAt || "").toLocaleDateString("zh-CN")}{" "}
        已提交了该练习单
      </p>
      <div className="inline-flex items-center gap-6 bg-white rounded-lg px-6 py-3 border border-emerald-200">
        <div className="text-center">
          <p className="text-2xl font-bold text-zinc-900">{sheet.items.length}</p>
          <p className="text-xs text-zinc-500">总题数</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-600">
            {sheet.items.length - wrongCount}
          </p>
          <p className="text-xs text-zinc-500">正确</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-red-500">{wrongCount}</p>
          <p className="text-xs text-zinc-500">错误</p>
        </div>
      </div>
      <div className="mt-4">
        <Link
          href="/my-sheets"
          className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
        >
          ← 返回练习单列表
        </Link>
      </div>
    </div>
  )
}

/**
 * Submission form - mark wrong questions
 */
function SubmissionForm({ sheet }: { sheet: any }) {
  const reviewCount = sheet.items.filter((i: any) => i.isReview).length
  const newCount = sheet.items.length - reviewCount

  return (
    <>
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-3 text-center">
          <p className="text-xl font-bold text-zinc-900">{sheet.items.length}</p>
          <p className="text-xs text-zinc-500">总题数</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3 text-center">
          <p className="text-xl font-bold text-emerald-600">{newCount}</p>
          <p className="text-xs text-zinc-500">新题</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3 text-center">
          <p className="text-xl font-bold text-amber-600">{reviewCount}</p>
          <p className="text-xs text-zinc-500">复习题</p>
        </div>
      </div>

      {/* Form */}
      <form
        action={async (formData: FormData) => {
          "use server"
          const sheetId = formData.get("sheetId") as string
          const wrongNumbersStr = formData.get("wrongNumbers") as string
          const wrongNumbers = wrongNumbersStr
            ? wrongNumbersStr.split(",").filter(Boolean)
            : []
          await createSubmission(sheetId, wrongNumbers)
        }}
        className="space-y-6"
      >
        <input type="hidden" name="sheetId" value={sheet.id} />
        <input
          type="hidden"
          name="wrongNumbers"
          id="wrongNumbersInput"
          value=""
        />

        {/* Questions list */}
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-4 md:px-5 py-3 border-b border-zinc-100 bg-zinc-50">
            <h2 className="font-semibold text-zinc-900 text-sm">
              请勾选你做错的题目
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              错题会自动加入你的间隔重复复习计划
            </p>
          </div>
          <div className="divide-y divide-zinc-100">
            {sheet.items.map((item: any) => {
              const q = item.question
              const kps = q.knowledgePoints.map((k: any) => k.knowledgePoint)
              return (
                <label
                  key={item.id}
                  className="flex items-start gap-3 px-4 md:px-5 py-3.5 cursor-pointer hover:bg-zinc-50 transition-colors has-[:checked]:bg-red-50/40"
                >
                  <input
                    type="checkbox"
                    name={`wrong_${item.sortOrder}`}
                    value={item.sortOrder}
                    className="mt-0.5 size-5 rounded border-zinc-300 text-red-500 focus:ring-red-400 shrink-0"
                    onChange={(e) => {
                      // Update hidden input with comma-separated wrong numbers
                      const hidden = document.getElementById(
                        "wrongNumbersInput"
                      ) as HTMLInputElement
                      const form = e.target.closest("form")
                      if (!form || !hidden) return
                      const checked = form.querySelectorAll<HTMLInputElement>(
                        'input[type="checkbox"]:checked'
                      )
                      hidden.value = Array.from(checked)
                        .map((cb) => cb.value)
                        .join(",")
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="size-5 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-500 shrink-0">
                        {item.sortOrder}
                      </span>
                      <TypeBadge type={q.questionType} />
                      <DifficultyBadge difficulty={q.difficulty} />
                      {item.isReview && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                          复习
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-800 leading-relaxed">
                      {q.content}
                    </p>
                    {q.questionType === "CHOICE" &&
                      q.options &&
                      Array.isArray(q.options) && (
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
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
                    <div className="flex flex-wrap gap-1 mt-2">
                      {kps.map((kp: any) => (
                        <span
                          key={kp.id}
                          className="text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded"
                        >
                          {kp.book} · {kp.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {/* Photo upload hint */}
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 md:p-6 text-center">
          <Camera className="size-8 text-zinc-400 mx-auto mb-2" />
          <p className="text-sm text-zinc-600 font-medium mb-1">
            拍照上传（可选）
          </p>
          <p className="text-xs text-zinc-400">
            你可以拍下完成的练习单照片上传。当前版本支持拍照后通过微信/QQ发送给老师。
          </p>
          <p className="text-xs text-amber-600 mt-2 bg-amber-50 inline-block px-2 py-1 rounded">
            OCR 识别功能即将上线，届时可自动识别答案
          </p>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800 transition-colors shadow-sm"
        >
          <Send className="size-5" />
          提交练习单
        </button>

        <p className="text-xs text-zinc-400 text-center">
          提交后系统会自动更新你的间隔重复复习计划，错题将适时再次出现
        </p>
      </form>
    </>
  )
}

function CheckCircleLarge({ className }: { className: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
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
