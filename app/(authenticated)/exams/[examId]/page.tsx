import { requireTeacher } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { getClassWeakPoints } from "@/lib/exam-analysis"
import Link from "next/link"
import { ArrowLeft, TrendingDown, Users, BookOpen } from "lucide-react"

interface Props {
  params: Promise<{ examId: string }>
}

export default async function ExamDetailPage({ params }: Props) {
  await requireTeacher()
  const { examId } = await params

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      class: { select: { id: true, name: true } },
      results: {
        include: {
          student: { select: { id: true, name: true, studentNumber: true } },
          _count: { select: { questionResults: true } },
        },
      },
    },
  })

  if (!exam) {
    return (
      <div className="p-8">
        <p className="text-zinc-500">考试不存在</p>
        <Link href="/exams" className="text-emerald-600 text-sm mt-2 block">
          ← 返回考试列表
        </Link>
      </div>
    )
  }

  // Get class weak points
  const weakPoints = await getClassWeakPoints(exam.class.id, 15)

  // Calculate class stats
  const totalStudents = exam.results.length
  const avgScore =
    totalStudents > 0
      ? exam.results.reduce((sum, r) => sum + (r.totalScore ?? 0), 0) /
        totalStudents
      : 0

  return (
    <div className="p-8 max-w-6xl">
      {/* Breadcrumb */}
      <Link
        href="/exams"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-4"
      >
        <ArrowLeft className="size-3.5" />
        返回考试列表
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{exam.name}</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {exam.class.name} ·{" "}
            {exam.examDate.toLocaleDateString("zh-CN")} · {totalStudents} 名学生
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="size-4 text-blue-600" />
            <span className="text-sm text-zinc-500">参考人数</span>
          </div>
          <p className="text-2xl font-bold text-zinc-900">{totalStudents}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="size-4 text-emerald-600" />
            <span className="text-sm text-zinc-500">班级平均分</span>
          </div>
          <p className="text-2xl font-bold text-zinc-900">
            {avgScore.toFixed(1)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="size-4 text-red-500" />
            <span className="text-sm text-zinc-500">薄弱知识点数</span>
          </div>
          <p className="text-2xl font-bold text-zinc-900">
            {weakPoints.filter((w) => w.avgScoreRate < 0.6).length}
          </p>
        </div>
      </div>

      {/* Class Weak Points */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">班级薄弱知识点</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            按全班平均得分率从低到高排列
          </p>
        </div>
        {weakPoints.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-zinc-400">
              暂无分析数据，请先导入考试数据
            </p>
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
                    平均得分率
                  </th>
                  <th className="text-right px-5 py-2.5 font-medium text-zinc-600 text-xs">
                    薄弱学生
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
                        className={`inline-flex items-center gap-1 font-mono text-xs font-medium ${
                          wp.avgScoreRate < 0.5
                            ? "text-red-600"
                            : wp.avgScoreRate < 0.7
                              ? "text-amber-600"
                              : "text-emerald-600"
                        }`}
                      >
                        {(wp.avgScoreRate * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-zinc-500">
                      {wp.weakStudentCount > 0 ? (
                        <span className="text-red-600 font-medium">
                          {wp.weakStudentCount}/{wp.studentCount}
                        </span>
                      ) : (
                        `0/${wp.studentCount}`
                      )}
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

      {/* Student Results */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">学生成绩</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-5 py-2.5 font-medium text-zinc-600 text-xs">
                  学生编号
                </th>
                <th className="text-left px-5 py-2.5 font-medium text-zinc-600 text-xs">
                  姓名
                </th>
                <th className="text-right px-5 py-2.5 font-medium text-zinc-600 text-xs">
                  总分
                </th>
                <th className="text-right px-5 py-2.5 font-medium text-zinc-600 text-xs">
                  答题数
                </th>
                <th className="text-right px-5 py-2.5 font-medium text-zinc-600 text-xs">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {exam.results.map((result) => (
                <tr key={result.id} className="hover:bg-zinc-50">
                  <td className="px-5 py-3 font-mono text-xs text-zinc-500">
                    {result.student.studentNumber}
                  </td>
                  <td className="px-5 py-3 font-medium text-zinc-900">
                    {result.student.name}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-zinc-900">
                    {result.totalScore?.toFixed(0) ?? "-"}
                  </td>
                  <td className="px-5 py-3 text-right text-zinc-500">
                    {result._count.questionResults}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/exams/${exam.id}/student/${result.studentId}`}
                      className="text-xs text-emerald-600 hover:text-emerald-700"
                    >
                      详情 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
