import { requireTeacher } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { getStudentWeakPoints } from "@/lib/exam-analysis"
import Link from "next/link"
import { ArrowLeft, TrendingDown } from "lucide-react"

interface Props {
  params: Promise<{ examId: string; studentId: string }>
}

export default async function StudentExamDetailPage({ params }: Props) {
  await requireTeacher()
  const { examId, studentId } = await params

  const [examResult, student, weakPoints] = await Promise.all([
    prisma.examResult.findUnique({
      where: {
        examId_studentId: { examId, studentId },
      },
      include: {
        exam: { select: { name: true, examDate: true } },
        questionResults: {
          include: {
            question: {
              select: {
                id: true,
                content: true,
                questionType: true,
                difficulty: true,
                knowledgePoints: {
                  include: {
                    knowledgePoint: {
                      select: { id: true, name: true, book: true },
                    },
                  },
                },
              },
            },
          },
          orderBy: { questionId: "asc" },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, studentNumber: true },
    }),
    getStudentWeakPoints(studentId, 20),
  ])

  if (!examResult || !student) {
    return (
      <div className="p-8">
        <p className="text-zinc-500">数据不存在</p>
        <Link href={`/exams/${examId}`} className="text-emerald-600 text-sm mt-2 block">
          ← 返回
        </Link>
      </div>
    )
  }

  const wrongCount = examResult.questionResults.filter((q) => q.isWrong).length

  return (
    <div className="p-8 max-w-5xl">
      <Link
        href={`/exams/${examId}`}
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-4"
      >
        <ArrowLeft className="size-3.5" />
        返回考试详情
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">{student.name}</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {student.studentNumber} · {examResult.exam.name} ·{" "}
          {examResult.exam.examDate.toLocaleDateString("zh-CN")}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatBox
          label="总分"
          value={examResult.totalScore?.toFixed(0) ?? "-"}
          color="text-blue-600"
        />
        <StatBox
          label="答题数"
          value={String(examResult.questionResults.length)}
          color="text-zinc-600"
        />
        <StatBox
          label="错题数"
          value={String(wrongCount)}
          color={wrongCount > 0 ? "text-red-600" : "text-emerald-600"}
        />
        <StatBox
          label="正确率"
          value={
            examResult.questionResults.length > 0
              ? `${Math.round(
                  ((examResult.questionResults.length - wrongCount) /
                    examResult.questionResults.length) *
                    100
                )}%`
              : "-"
          }
          color={
            wrongCount === 0
              ? "text-emerald-600"
              : wrongCount < examResult.questionResults.length / 2
                ? "text-amber-600"
                : "text-red-600"
          }
        />
      </div>

      {/* Per-question results */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">答题详情</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-5 py-2.5 font-medium text-zinc-600 text-xs">
                  题目
                </th>
                <th className="text-left px-5 py-2.5 font-medium text-zinc-600 text-xs">
                  知识点
                </th>
                <th className="text-center px-5 py-2.5 font-medium text-zinc-600 text-xs">
                  题型
                </th>
                <th className="text-center px-5 py-2.5 font-medium text-zinc-600 text-xs">
                  难度
                </th>
                <th className="text-right px-5 py-2.5 font-medium text-zinc-600 text-xs">
                  得分
                </th>
                <th className="text-right px-5 py-2.5 font-medium text-zinc-600 text-xs">
                  得分率
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {examResult.questionResults.map((qr) => {
                const rate = qr.score / qr.maxScore
                return (
                  <tr
                    key={qr.id}
                    className={`hover:bg-zinc-50 ${qr.isWrong ? "bg-red-50/30" : ""}`}
                  >
                    <td className="px-5 py-3 max-w-xs">
                      <p className="text-zinc-900 truncate">
                        {qr.question.content.length > 50
                          ? qr.question.content.slice(0, 50) + "..."
                          : qr.question.content}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {qr.question.knowledgePoints.map((k) => (
                          <span
                            key={k.knowledgePoint.id}
                            className="inline-block text-xs bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded"
                          >
                            {k.knowledgePoint.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <QuestionTypeBadge type={qr.question.questionType} />
                    </td>
                    <td className="px-5 py-3 text-center">
                      <DifficultyBadge difficulty={qr.question.difficulty} />
                    </td>
                    <td className="px-5 py-3 text-right font-mono">
                      <span
                        className={
                          qr.isWrong ? "text-red-600 font-medium" : "text-zinc-900"
                        }
                      >
                        {qr.score}
                      </span>
                      <span className="text-zinc-400">/{qr.maxScore}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={`font-mono text-xs font-medium ${
                          rate < 0.6
                            ? "text-red-600"
                            : rate < 0.8
                              ? "text-amber-600"
                              : "text-emerald-600"
                        }`}
                      >
                        {(rate * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Weak Points */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <TrendingDown className="size-4 text-red-500" />
            <h2 className="font-semibold text-zinc-900">
              该学生的薄弱知识点（全历史）
            </h2>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            基于所有考试历史数据综合计算
          </p>
        </div>
        {weakPoints.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-zinc-400">暂无分析数据</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-5 py-2.5 font-medium text-zinc-600 text-xs">
                    知识点
                  </th>
                  <th className="text-left px-5 py-2.5 font-medium text-zinc-600 text-xs">
                    教材
                  </th>
                  <th className="text-left px-5 py-2.5 font-medium text-zinc-600 text-xs">
                    模块
                  </th>
                  <th className="text-right px-5 py-2.5 font-medium text-zinc-600 text-xs">
                    得分率
                  </th>
                  <th className="text-right px-5 py-2.5 font-medium text-zinc-600 text-xs">
                    涉及题数
                  </th>
                  <th className="text-right px-5 py-2.5 font-medium text-zinc-600 text-xs">
                    错题数
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {weakPoints.map((wp) => (
                  <tr key={wp.knowledgePointId} className="hover:bg-zinc-50">
                    <td className="px-5 py-3 font-medium text-zinc-900">
                      {wp.knowledgePointName}
                    </td>
                    <td className="px-5 py-3 text-zinc-500">{wp.book}</td>
                    <td className="px-5 py-3 text-zinc-500">{wp.module}</td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={`font-mono text-xs font-medium ${
                          wp.scoreRate < 0.5
                            ? "text-red-600"
                            : wp.scoreRate < 0.7
                              ? "text-amber-600"
                              : "text-emerald-600"
                        }`}
                      >
                        {(wp.scoreRate * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-zinc-500">
                      {wp.totalQuestions}
                    </td>
                    <td className="px-5 py-3 text-right text-zinc-500">
                      {wp.wrongCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
    </div>
  )
}

function QuestionTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    CHOICE: "选择题",
    FILL_IN_BLANK: "填空题",
    SHORT_ANSWER: "简答题",
    EXPERIMENT_DESIGN: "实验设计",
    CHART_ANALYSIS: "图表分析",
  }
  return (
    <span className="text-xs bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">
      {labels[type] || type}
    </span>
  )
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    EASY: "bg-emerald-50 text-emerald-600",
    MEDIUM: "bg-amber-50 text-amber-600",
    HARD: "bg-red-50 text-red-600",
  }
  const labels: Record<string, string> = {
    EASY: "易",
    MEDIUM: "中",
    HARD: "难",
  }
  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded ${colors[difficulty] || "bg-zinc-100 text-zinc-600"}`}
    >
      {labels[difficulty] || difficulty}
    </span>
  )
}
