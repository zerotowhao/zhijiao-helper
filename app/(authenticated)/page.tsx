import { requireTeacher } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import {
  Users,
  Library,
  FileText,
  TrendingUp,
  ArrowRight,
} from "lucide-react"

export default async function DashboardPage() {
  const session = await requireTeacher()

  // Quick stats
  const [studentCount, questionCount, sheetCount, classCount] =
    await Promise.all([
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.question.count({ where: { isActive: true } }),
      prisma.practiceSheet.count(),
      prisma.class.count(),
    ])

  const stats = [
    {
      label: "班级数",
      value: classCount,
      href: "/students",
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "学生总数",
      value: studentCount,
      href: "/students",
      icon: Users,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "题库题目",
      value: questionCount,
      href: "/questions",
      icon: Library,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "已生成练习单",
      value: sheetCount,
      href: "/sheets",
      icon: FileText,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ]

  // Recent sheets
  const recentSheets = await prisma.practiceSheet.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: {
      student: { select: { name: true } },
    },
  })

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-bold text-zinc-900 mb-1">
        你好，{session.user?.name}
      </h1>
      <p className="text-sm text-zinc-500 mb-8">欢迎使用智教助手</p>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-xl border border-zinc-200 bg-white p-5 hover:shadow-sm transition-shadow"
          >
            <div
              className={`inline-flex items-center justify-center size-10 rounded-lg ${stat.bg} ${stat.color} mb-3`}
            >
              <stat.icon className="size-5" />
            </div>
            <p className="text-2xl font-bold text-zinc-900">{stat.value}</p>
            <p className="text-sm text-zinc-500">{stat.label}</p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <QuickAction
          title="导入考试数据"
          desc="上传智学网 Excel，自动分析得分率"
          href="/exams/import"
        />
        <QuickAction
          title="添加题目"
          desc="手动录入或 AI 生成生物题"
          href="/questions/new"
        />
        <QuickAction
          title="生成练习单"
          desc="基于薄弱知识点自动组卷"
          href="/sheets/generate"
        />
      </div>

      {/* Recent sheets */}
      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">最近练习单</h2>
          <Link
            href="/sheets"
            className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            查看全部
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="divide-y divide-zinc-100">
          {recentSheets.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-400">
              还没有生成练习单，点击上方"生成练习单"开始
            </p>
          ) : (
            recentSheets.map((sheet) => (
              <div
                key={sheet.id}
                className="flex items-center justify-between px-5 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    {sheet.student.name} — {sheet.weekLabel}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {sheet.createdAt.toLocaleDateString("zh-CN")}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    sheet.status === "GENERATED"
                      ? "bg-emerald-50 text-emerald-600"
                      : sheet.status === "PRINTED"
                        ? "bg-blue-50 text-blue-600"
                        : sheet.status === "SUBMITTED"
                          ? "bg-purple-50 text-purple-600"
                          : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {statusLabel(sheet.status)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function QuickAction({
  title,
  desc,
  href,
}: {
  title: string
  desc: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-emerald-300 hover:shadow-sm transition-all group"
    >
      <h3 className="font-semibold text-zinc-900 mb-1 group-hover:text-emerald-700 transition-colors">
        {title}
      </h3>
      <p className="text-sm text-zinc-500">{desc}</p>
    </Link>
  )
}

function statusLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "草稿"
    case "GENERATED":
      return "已生成"
    case "PRINTED":
      return "已打印"
    case "SUBMITTED":
      return "已提交"
    case "REVIEWED":
      return "已批阅"
    default:
      return status
  }
}
