import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import Link from "next/link"
import {
  Plus,
  Search,
  Library,
  Eye,
  EyeOff,
} from "lucide-react"
import { toggleQuestionActive } from "@/app/actions/questions"

const PAGE_SIZE = 20

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "TEACHER") {
    return (
      <div className="p-8">
        <p className="text-zinc-500">仅教师可访问题库管理</p>
      </div>
    )
  }

  const sp = await searchParams
  const search = (sp.search as string) || ""
  const typeFilter = (sp.type as string) || ""
  const difficultyFilter = (sp.diff as string) || ""
  const bookFilter = (sp.book as string) || ""
  const showInactive = sp.inactive === "1"

  // Build where clause
  const where: any = { isActive: !showInactive ? true : undefined }
  if (search) {
    where.OR = [
      { content: { contains: search } },
      { answer: { contains: search } },
      {
        knowledgePoints: {
          some: {
            knowledgePoint: {
              name: { contains: search },
            },
          },
        },
      },
    ]
  }
  if (typeFilter) where.questionType = typeFilter
  if (difficultyFilter) where.difficulty = difficultyFilter
  if (bookFilter) {
    where.knowledgePoints = {
      ...(where.knowledgePoints || {}),
      some: {
        ...(where.knowledgePoints?.some || {}),
        knowledgePoint: {
          ...(where.knowledgePoints?.some?.knowledgePoint || {}),
          book: bookFilter,
        },
      },
    }
  }

  const [questions, totalCount] = await Promise.all([
    prisma.question.findMany({
      where,
      include: {
        knowledgePoints: {
          include: { knowledgePoint: { select: { id: true, name: true, book: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    }),
    prisma.question.count({ where }),
  ])

  // Get distinct books for filter
  const books = await prisma.knowledgePoint.findMany({
    select: { book: true },
    distinct: ["book"],
    orderBy: { book: "asc" },
  })

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">题库管理</h1>
          <p className="text-sm text-zinc-500 mt-1">
            共 {totalCount} 道题目
          </p>
        </div>
        <Link
          href="/questions/new"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          <Plus className="size-4" />
          添加题目
        </Link>
      </div>

      {/* Filters */}
      <form className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
          <input
            name="search"
            type="text"
            placeholder="搜索题目内容、答案或知识点..."
            defaultValue={search}
            className="w-full rounded-lg border border-zinc-300 pl-9 pr-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <select
          name="type"
          defaultValue={typeFilter}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none bg-white"
        >
          <option value="">全部题型</option>
          <option value="CHOICE">选择题</option>
          <option value="FILL_IN_BLANK">填空题</option>
          <option value="SHORT_ANSWER">简答题</option>
          <option value="EXPERIMENT_DESIGN">实验设计题</option>
          <option value="CHART_ANALYSIS">图表分析题</option>
        </select>
        <select
          name="diff"
          defaultValue={difficultyFilter}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none bg-white"
        >
          <option value="">全部难度</option>
          <option value="EASY">简单</option>
          <option value="MEDIUM">中等</option>
          <option value="HARD">困难</option>
        </select>
        <select
          name="book"
          defaultValue={bookFilter}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none bg-white"
        >
          <option value="">全部教材</option>
          {books.map((b) => (
            <option key={b.book} value={b.book}>
              {b.book}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-zinc-600 cursor-pointer select-none">
          <input
            type="checkbox"
            name="inactive"
            value="1"
            defaultChecked={showInactive}
            className="rounded border-zinc-300"
          />
          显示已停用
        </label>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          筛选
        </button>
      </form>

      {/* Question list */}
      {questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-16 text-center">
          <Library className="size-12 text-zinc-300 mx-auto mb-4" />
          <p className="text-zinc-600 font-medium mb-1">
            {search || typeFilter || difficultyFilter
              ? "没有匹配的题目"
              : "题库为空"}
          </p>
          <p className="text-sm text-zinc-400 mb-4">
            {search || typeFilter || difficultyFilter
              ? "请尝试调整筛选条件"
              : "开始添加高中生物题目"}
          </p>
          {!search && !typeFilter && !difficultyFilter && (
            <Link
              href="/questions/new"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
            >
              <Plus className="size-4" />
              添加第一道题
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="divide-y divide-zinc-100">
            {questions.map((q) => (
              <QuestionRow key={q.id} question={q} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function QuestionRow({
  question,
}: {
  question: any
}) {
  const kps = question.knowledgePoints.map((k: any) => k.knowledgePoint)
  const contentPreview =
    question.content.length > 80
      ? question.content.slice(0, 80) + "..."
      : question.content

  return (
    <div
      className={`px-5 py-4 hover:bg-zinc-50 transition-colors ${
        !question.isActive ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <TypeBadge type={question.questionType} />
            <DifficultyBadge difficulty={question.difficulty} />
            {!question.isActive && (
              <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
                已停用
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-900 mb-1.5">{contentPreview}</p>
          <div className="flex flex-wrap gap-1">
            {kps.map((kp: any) => (
              <span
                key={kp.id}
                className="inline-block text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded"
              >
                {kp.name}
              </span>
            ))}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {question.source === "ai" ? "AI 生成" : "手动录入"}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Link
            href={`/questions/${question.id}/edit`}
            className="rounded px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            编辑
          </Link>
          <ToggleActiveButton
            questionId={question.id}
            isActive={question.isActive}
          />
        </div>
      </div>
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
    <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
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

function ToggleActiveButton({
  questionId,
  isActive,
}: {
  questionId: string
  isActive: boolean
}) {
  return (
    <form action={toggleQuestionActive.bind(null, questionId, !isActive)}>
      <button
        type="submit"
        className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 transition-colors"
        title={isActive ? "停用" : "启用"}
      >
        {isActive ? (
          <EyeOff className="size-3.5" />
        ) : (
          <Eye className="size-3.5" />
        )}
      </button>
    </form>
  )
}
