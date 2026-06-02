import { requireTeacher } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { getWeekLabel } from "@/lib/sheet-generator"
import {
  TrendingUp,
  TrendingDown,
  Users,
  Library,
  FileText,
  Target,
  BarChart3,
} from "lucide-react"

export default async function AnalyticsPage() {
  await requireTeacher()

  // ─── Overview stats ───
  const [studentCount, questionCount, sheetCount, examCount, classCount] =
    await Promise.all([
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.question.count({ where: { isActive: true } }),
      prisma.practiceSheet.count(),
      prisma.exam.count(),
      prisma.class.count(),
    ])

  // ─── School-wide weak knowledge points ───
  const allKpAnalyses = await prisma.studentKpAnalysis.findMany({
    include: {
      knowledgePoint: { select: { id: true, name: true, book: true, module: true } },
    },
  })

  const kpAgg = new Map<
    string,
    {
      name: string; book: string; module: string
      rates: number[]; totalQuestions: number; wrongCount: number
    }
  >()

  for (const a of allKpAnalyses) {
    if (!kpAgg.has(a.knowledgePointId)) {
      kpAgg.set(a.knowledgePointId, {
        name: a.knowledgePoint.name,
        book: a.knowledgePoint.book,
        module: a.knowledgePoint.module,
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

  const schoolWeakKps = Array.from(kpAgg.entries())
    .map(([kpId, agg]) => ({
      knowledgePointId: kpId,
      name: agg.name,
      book: agg.book,
      module: agg.module,
      avgScoreRate: agg.rates.reduce((a, b) => a + b, 0) / agg.rates.length,
      studentCount: agg.rates.length,
      weakStudentCount: agg.rates.filter((r) => r < 0.6).length,
      totalQuestions: agg.totalQuestions,
      wrongCount: agg.wrongCount,
    }))
    .sort((a, b) => a.avgScoreRate - b.avgScoreRate)
    .slice(0, 15)

  // ─── Weekly progress overview ───
  const currentWeek = getWeekLabel()
  const weeklyProgress = await prisma.weeklyProgress.findMany({
    where: { weekLabel: currentWeek },
    include: {
      student: { select: { name: true, studentNumber: true } },
    },
    orderBy: { completionRate: "desc" },
  })

  // ─── Class comparison ───
  const classes = await prisma.class.findMany({
    include: {
      students: {
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              practiceSheets: true,
              submissions: true,
            },
          },
        },
      },
    },
  })

  const classStats = classes.map((c) => {
    const totalSheets = c.students.reduce(
      (sum, s) => sum + s._count.practiceSheets,
      0
    )
    const totalSubs = c.students.reduce(
      (sum, s) => sum + s._count.submissions,
      0
    )
    // Get class KP analysis
    const classAnalyses = allKpAnalyses.filter((a) =>
      c.students.some((s) => s.id === a.studentId)
    )
    const avgScoreRate =
      classAnalyses.length > 0
        ? classAnalyses.reduce((sum, a) => sum + a.scoreRate, 0) /
          classAnalyses.length
        : 0

    return {
      id: c.id,
      name: c.name,
      grade: c.grade,
      studentCount: c.students.length,
      totalSheets,
      totalSubs,
      avgScoreRate,
      submissionRate: totalSheets > 0 ? totalSubs / totalSheets : 0,
    }
  })

  // ─── Exam score overview ───
  const recentExams = await prisma.exam.findMany({
    orderBy: { examDate: "desc" },
    take: 5,
    include: {
      class: { select: { name: true } },
      results: {
        select: { totalScore: true },
      },
    },
  })

  const examStats = recentExams.map((e) => {
    const scores = e.results
      .map((r) => r.totalScore)
      .filter((s): s is number => s != null)
    const avg =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0
    const max = scores.length > 0 ? Math.max(...scores) : 0
    const min = scores.length > 0 ? Math.min(...scores) : 0
    const passCount = scores.filter((s) => s >= 60).length

    return {
      id: e.id,
      name: e.name,
      date: e.examDate,
      className: e.class.name,
      studentCount: e.results.length,
      avgScore: avg,
      maxScore: max,
      minScore: min,
      passRate: scores.length > 0 ? passCount / scores.length : 0,
    }
  })

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-zinc-900">
          数据看板
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          全校概览、班级对比、知识点薄弱分析
        </p>
      </div>

      {/* ─── Overview cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
        <OverviewCard
          label="班级数"
          value={classCount}
          icon={Users}
          color="bg-blue-50 text-blue-600"
        />
        <OverviewCard
          label="学生总数"
          value={studentCount}
          icon={Users}
          color="bg-emerald-50 text-emerald-600"
        />
        <OverviewCard
          label="题库题目"
          value={questionCount}
          icon={Library}
          color="bg-amber-50 text-amber-600"
        />
        <OverviewCard
          label="练习单"
          value={sheetCount}
          icon={FileText}
          color="bg-purple-50 text-purple-600"
        />
        <OverviewCard
          label="考试次数"
          value={examCount}
          icon={Target}
          color="bg-red-50 text-red-600"
        />
      </div>

      {/* ─── Two-column layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Class comparison */}
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-4 md:px-5 py-3.5 border-b border-zinc-100 bg-zinc-50">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-zinc-500" />
              <h2 className="font-semibold text-zinc-900 text-sm">
                班级对比
              </h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/50">
                  <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">
                    班级
                  </th>
                  <th className="text-center px-3 py-2.5 font-medium text-zinc-500 text-xs">
                    人数
                  </th>
                  <th className="text-center px-3 py-2.5 font-medium text-zinc-500 text-xs">
                    练习单
                  </th>
                  <th className="text-center px-3 py-2.5 font-medium text-zinc-500 text-xs">
                    提交率
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium text-zinc-500 text-xs">
                    平均得分率
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {classStats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-400">
                      暂无班级数据
                    </td>
                  </tr>
                ) : (
                  classStats.map((c) => (
                    <tr key={c.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900 text-xs">
                          {c.name}
                        </p>
                        <p className="text-xs text-zinc-400">{c.grade}</p>
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-zinc-600">
                        {c.studentCount}
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-zinc-600">
                        {c.totalSheets}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`text-xs font-medium ${
                            c.submissionRate >= 0.8
                              ? "text-emerald-600"
                              : c.submissionRate >= 0.5
                                ? "text-amber-600"
                                : "text-red-500"
                          }`}
                        >
                          {(c.submissionRate * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ScoreRateBadge rate={c.avgScoreRate} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Exam overview */}
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-4 md:px-5 py-3.5 border-b border-zinc-100 bg-zinc-50">
            <div className="flex items-center gap-2">
              <Target className="size-4 text-zinc-500" />
              <h2 className="font-semibold text-zinc-900 text-sm">
                近期考试概览
              </h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/50">
                  <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">
                    考试
                  </th>
                  <th className="text-center px-3 py-2.5 font-medium text-zinc-500 text-xs">
                    班级
                  </th>
                  <th className="text-center px-3 py-2.5 font-medium text-zinc-500 text-xs">
                    人数
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium text-zinc-500 text-xs">
                    均分
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium text-zinc-500 text-xs">
                    及格率
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {examStats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-400">
                      暂无考试数据
                    </td>
                  </tr>
                ) : (
                  examStats.map((e) => (
                    <tr key={e.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900 text-xs">
                          {e.name}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {e.date.toLocaleDateString("zh-CN")}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-zinc-500">
                        {e.className}
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-zinc-600">
                        {e.studentCount}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-medium text-zinc-900">
                        {e.studentCount > 0 ? e.avgScore.toFixed(1) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`text-xs font-medium ${
                            e.passRate >= 0.8
                              ? "text-emerald-600"
                              : e.passRate >= 0.6
                                ? "text-amber-600"
                                : "text-red-500"
                          }`}
                        >
                          {e.studentCount > 0
                            ? (e.passRate * 100).toFixed(0) + "%"
                            : "-"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── School-wide weak KPs ─── */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden mb-6">
        <div className="px-4 md:px-5 py-3.5 border-b border-zinc-100 bg-zinc-50">
          <div className="flex items-center gap-2">
            <TrendingDown className="size-4 text-red-500" />
            <h2 className="font-semibold text-zinc-900 text-sm">
              全校薄弱知识点 Top 15
            </h2>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            按全校学生平均得分率排序，得分率越低表示越薄弱
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs w-8">
                  #
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-zinc-500 text-xs">
                  知识点
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-zinc-500 text-xs hidden md:table-cell">
                  教材
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-zinc-500 text-xs hidden md:table-cell">
                  模块
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-zinc-500 text-xs">
                  涉及学生
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-zinc-500 text-xs">
                  薄弱人数
                </th>
                <th className="text-right px-4 py-2.5 font-medium text-zinc-500 text-xs">
                  平均得分率
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {schoolWeakKps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-400">
                    暂无分析数据，请先导入考试数据
                  </td>
                </tr>
              ) : (
                schoolWeakKps.map((kp, i) => (
                  <tr key={kp.knowledgePointId} className="hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center justify-center size-5 rounded-full text-xs font-bold ${
                          i < 3
                            ? "bg-red-100 text-red-600"
                            : i < 7
                              ? "bg-amber-100 text-amber-700"
                              : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-medium text-zinc-900 text-xs">
                      {kp.name}
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-500 hidden md:table-cell">
                      {kp.book}
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-500 hidden md:table-cell">
                      {kp.module}
                    </td>
                    <td className="px-3 py-3 text-center text-xs text-zinc-600">
                      {kp.studentCount}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`text-xs font-medium ${
                          kp.weakStudentCount > kp.studentCount * 0.5
                            ? "text-red-500"
                            : kp.weakStudentCount > 0
                              ? "text-amber-600"
                              : "text-zinc-400"
                        }`}
                      >
                        {kp.weakStudentCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ScoreRateBar rate={kp.avgScoreRate} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Weekly progress ─── */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-4 md:px-5 py-3.5 border-b border-zinc-100 bg-zinc-50">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-emerald-500" />
            <h2 className="font-semibold text-zinc-900 text-sm">
              本周完成情况 ({currentWeek})
            </h2>
          </div>
        </div>
        {weeklyProgress.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-400">
            本周暂无练习单完成数据
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/50">
                  <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">
                    学生
                  </th>
                  <th className="text-center px-3 py-2.5 font-medium text-zinc-500 text-xs">
                    总题数
                  </th>
                  <th className="text-center px-3 py-2.5 font-medium text-zinc-500 text-xs">
                    正确数
                  </th>
                  <th className="text-center px-3 py-2.5 font-medium text-zinc-500 text-xs">
                    正确率
                  </th>
                  <th className="text-center px-3 py-2.5 font-medium text-zinc-500 text-xs">
                    连续周
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium text-zinc-500 text-xs">
                    完成率
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {weeklyProgress.map((wp) => (
                  <tr key={wp.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900 text-xs">
                        {wp.student.name}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {wp.student.studentNumber}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-center text-xs text-zinc-600">
                      {wp.totalQuestions}
                    </td>
                    <td className="px-3 py-3 text-center text-xs text-zinc-600">
                      {wp.correctCount}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`text-xs font-medium ${
                          wp.totalQuestions > 0
                            ? wp.correctCount / wp.totalQuestions >= 0.8
                              ? "text-emerald-600"
                              : wp.correctCount / wp.totalQuestions >= 0.6
                                ? "text-amber-600"
                                : "text-red-500"
                            : "text-zinc-400"
                        }`}
                      >
                        {wp.totalQuestions > 0
                          ? (
                              (wp.correctCount / wp.totalQuestions) *
                              100
                            ).toFixed(0) + "%"
                          : "-"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {wp.streakWeeks > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                          🔥 {wp.streakWeeks}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="w-20 h-2 bg-zinc-100 rounded-full ml-auto overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            wp.completionRate >= 0.8
                              ? "bg-emerald-500"
                              : wp.completionRate >= 0.6
                                ? "bg-amber-500"
                                : "bg-red-500"
                          }`}
                          style={{
                            width: `${Math.round(wp.completionRate * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-zinc-500 mt-0.5 block">
                        {(wp.completionRate * 100).toFixed(0)}%
                      </span>
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

function OverviewCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: any
  color: string
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 md:p-5">
      <div className={`inline-flex items-center justify-center size-9 rounded-lg ${color} mb-2 md:mb-3`}>
        <Icon className="size-4" />
      </div>
      <p className="text-xl md:text-2xl font-bold text-zinc-900">{value}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
    </div>
  )
}

function ScoreRateBadge({ rate }: { rate: number }) {
  const pct = (rate * 100).toFixed(0)
  const color =
    rate >= 0.8
      ? "text-emerald-600 bg-emerald-50"
      : rate >= 0.6
        ? "text-amber-600 bg-amber-50"
        : "text-red-500 bg-red-50"
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${color}`}
    >
      {rate >= 0.8 ? (
        <TrendingUp className="size-3" />
      ) : (
        <TrendingDown className="size-3" />
      )}
      {pct}%
    </span>
  )
}

function ScoreRateBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100)
  const color =
    rate >= 0.8
      ? "bg-emerald-500"
      : rate >= 0.6
        ? "bg-amber-500"
        : "bg-red-500"
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono font-medium text-zinc-700 w-8 text-right">
        {pct}%
      </span>
    </div>
  )
}
