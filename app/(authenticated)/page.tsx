import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import {
  Users,
  Library,
  FileText,
  TrendingUp,
  ArrowRight,
  Send,
  CheckCircle,
  Clock,
} from "lucide-react"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) return null

  const userRole = (session.user as any).role
  const userId = (session.user as any).userId || (session.user as any).id

  if (userRole === "TEACHER") {
    return <TeacherDashboard userName={session.user.name} />
  }

  return <StudentDashboard userId={userId} userName={session.user.name} />
}

/**
 * Teacher dashboard — overview of the entire platform
 */
async function TeacherDashboard({ userName }: { userName?: string | null }) {
  const [studentCount, questionCount, sheetCount, classCount] =
    await Promise.all([
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.question.count({ where: { isActive: true } }),
      prisma.practiceSheet.count(),
      prisma.class.count(),
    ])

  const stats = [
    { label: "班级数", value: classCount, href: "/students", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "学生总数", value: studentCount, href: "/students", icon: Users, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "题库题目", value: questionCount, href: "/questions", icon: Library, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "练习单", value: sheetCount, href: "/sheets", icon: FileText, color: "text-purple-600", bg: "bg-purple-50" },
  ]

  const recentSheets = await prisma.practiceSheet.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { student: { select: { name: true } } },
  })

  const pendingSubmissions = await prisma.practiceSheet.count({
    where: { status: "SUBMITTED" },
  })

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-bold text-zinc-900 mb-1">你好，{userName}</h1>
      <p className="text-sm text-zinc-500 mb-8">欢迎使用智教助手</p>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="rounded-xl border border-zinc-200 bg-white p-5 hover:shadow-sm transition-shadow">
            <div className={`inline-flex items-center justify-center size-10 rounded-lg ${stat.bg} ${stat.color} mb-3`}>
              <stat.icon className="size-5" />
            </div>
            <p className="text-2xl font-bold text-zinc-900">{stat.value}</p>
            <p className="text-sm text-zinc-500">{stat.label}</p>
          </Link>
        ))}
      </div>

      {pendingSubmissions > 0 && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Send className="size-5 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-purple-900">待批阅的提交</p>
              <p className="text-sm text-purple-700">{pendingSubmissions} 份练习单等待批阅</p>
            </div>
          </div>
          <Link href="/sheets" className="text-sm text-purple-600 hover:text-purple-700 font-medium">
            查看 →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        <QuickAction title="导入考试数据" desc="上传智学网 Excel，自动分析得分率" href="/exams/import" />
        <QuickAction title="添加题目" desc="手动录入生物题到题库" href="/questions/new" />
        <QuickAction title="生成练习单" desc="基于薄弱知识点自动组卷" href="/sheets" />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">最近练习单</h2>
          <Link href="/sheets" className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
            查看全部 <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="divide-y divide-zinc-100">
          {recentSheets.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-400">还没有生成练习单</p>
          ) : (
            recentSheets.map((sheet) => (
              <div key={sheet.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{sheet.student.name} — {sheet.weekLabel}</p>
                  <p className="text-xs text-zinc-400">{sheet.createdAt.toLocaleDateString("zh-CN")}</p>
                </div>
                <StatusBadge status={sheet.status} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Student dashboard — personal progress and pending tasks
 */
async function StudentDashboard({ userId, userName }: { userId: string; userName?: string | null }) {
  // Student's sheets
  const sheets = await prisma.practiceSheet.findMany({
    where: { studentId: userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  const pendingSheets = sheets.filter((s) => s.status !== "SUBMITTED" && s.status !== "REVIEWED")
  const submittedSheets = sheets.filter((s) => s.status === "SUBMITTED" || s.status === "REVIEWED")

  // Weak knowledge points
  const weakKps = await prisma.studentKpAnalysis.findMany({
    where: { studentId: userId, scoreRate: { lt: 0.7 } },
    orderBy: { scoreRate: "asc" },
    include: { knowledgePoint: { select: { name: true, book: true } } },
    take: 5,
  })

  // Weekly progress
  const recentProgress = await prisma.weeklyProgress.findMany({
    where: { studentId: userId },
    orderBy: { weekLabel: "desc" },
    take: 4,
  })

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-xl md:text-2xl font-bold text-zinc-900 mb-1">你好，{userName}</h1>
      <p className="text-sm text-zinc-500 mb-6">欢迎使用智教助手</p>

      {/* Pending alert */}
      {pendingSheets.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Clock className="size-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-emerald-900">有待完成的练习单</p>
              <p className="text-sm text-emerald-700">{pendingSheets.length} 份练习单等待完成</p>
            </div>
          </div>
          <Link href="/my-sheets" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
            去完成 →
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
        <StatBox label="待完成" value={pendingSheets.length} color="text-emerald-600" bg="bg-emerald-50" />
        <StatBox label="已提交" value={submittedSheets.length} color="text-purple-600" bg="bg-purple-50" />
        <StatBox label="薄弱知识点" value={weakKps.length} color="text-amber-600" bg="bg-amber-50" />
      </div>

      {/* Weak KPs */}
      {weakKps.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-amber-500" />
              <h2 className="font-semibold text-zinc-900 text-sm">需要加强的知识点</h2>
            </div>
          </div>
          <div className="divide-y divide-zinc-100">
            {weakKps.map((wk) => (
              <div key={wk.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{wk.knowledgePoint.name}</p>
                  <p className="text-xs text-zinc-400">{wk.knowledgePoint.book}</p>
                </div>
                <span className="text-sm font-mono font-medium text-red-500">
                  {(wk.scoreRate * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly progress */}
      {recentProgress.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50">
            <h2 className="font-semibold text-zinc-900 text-sm">学习进度</h2>
          </div>
          <div className="grid grid-cols-4 divide-x divide-zinc-100">
            {recentProgress.map((wp) => (
              <div key={wp.id} className="px-3 py-4 text-center">
                <p className="text-xs text-zinc-400 mb-1">{wp.weekLabel}</p>
                <p className={`text-xl font-bold ${wp.completionRate >= 0.6 ? "text-emerald-600" : "text-red-500"}`}>
                  {(wp.completionRate * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {wp.correctCount}/{wp.totalQuestions} 正确
                </p>
                {wp.streakWeeks > 0 && (
                  <p className="text-xs text-amber-600 mt-1">🔥 {wp.streakWeeks}周连续</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick link */}
      <Link
        href="/my-sheets"
        className="block w-full rounded-xl bg-emerald-600 text-white text-center py-3.5 font-semibold hover:bg-emerald-700 active:bg-emerald-800 transition-colors shadow-sm"
      >
        {pendingSheets.length > 0 ? `去完成 ${pendingSheets.length} 份练习单` : "查看我的练习单"}
      </Link>
    </div>
  )
}

function QuickAction({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <Link href={href} className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-emerald-300 hover:shadow-sm transition-all group">
      <h3 className="font-semibold text-zinc-900 mb-1 group-hover:text-emerald-700 transition-colors">{title}</h3>
      <p className="text-sm text-zinc-500">{desc}</p>
    </Link>
  )
}

function StatBox({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    GENERATED: { bg: "bg-emerald-50", text: "text-emerald-600", label: "已生成" },
    PRINTED: { bg: "bg-blue-50", text: "text-blue-600", label: "已打印" },
    SUBMITTED: { bg: "bg-purple-50", text: "text-purple-600", label: "已提交" },
    REVIEWED: { bg: "bg-amber-50", text: "text-amber-600", label: "已批阅" },
    DRAFT: { bg: "bg-zinc-100", text: "text-zinc-500", label: "草稿" },
  }
  const c = config[status] || config.DRAFT
  return <span className={`text-xs px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>{c.label}</span>
}
