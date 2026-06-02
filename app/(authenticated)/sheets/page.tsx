import { requireTeacher } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { generateSheets } from "@/app/actions/practice-sheets"
import Link from "next/link"
import { FileText, Plus, Printer, CheckCircle, Clock } from "lucide-react"

export default async function SheetsPage() {
  const session = await requireTeacher()

  // Get all students
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: { id: true, name: true, studentNumber: true, class: { select: { name: true } } },
    orderBy: { studentNumber: "asc" },
  })

  // Get all sheets
  const sheets = await prisma.practiceSheet.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      student: { select: { name: true, studentNumber: true } },
      _count: { select: { items: true, submissions: true } },
    },
    take: 30,
  })

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">练习单管理</h1>
          <p className="text-sm text-zinc-500 mt-1">
            基于薄弱知识点 + SM-2 间隔重复，为每位学生生成个性化周练习单
          </p>
        </div>
      </div>

      {/* Generate section */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 mb-8">
        <h2 className="font-semibold text-zinc-900 mb-1">生成新练习单</h2>
        <p className="text-sm text-zinc-500 mb-4">
          选择学生，系统将自动根据薄弱知识点和到期复习题生成个性化练习单
        </p>
        <form action={generateSheetsWrapper} className="space-y-4">
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
            {students.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50"
              >
                <input
                  type="checkbox"
                  name="studentIds"
                  value={s.id}
                  className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <p className="text-xs font-medium text-zinc-800">{s.name}</p>
                  <p className="text-xs text-zinc-400">
                    {s.studentNumber}
                    {s.class?.name ? ` · ${s.class.name}` : ""}
                  </p>
                </div>
              </label>
            ))}
          </div>
          {students.length === 0 && (
            <p className="text-sm text-zinc-400 py-4 text-center">
              暂无学生，请先在学生管理中导入学生数据
            </p>
          )}
          <div className="flex items-center gap-3">
            <select
              name="questionCount"
              defaultValue="10"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white"
            >
              <option value="5">5 题</option>
              <option value="10">10 题</option>
              <option value="15">15 题</option>
              <option value="20">20 题</option>
            </select>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
            >
              <Plus className="size-4" />
              生成练习单
            </button>
          </div>
        </form>
      </div>

      {/* Sheet list */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">已生成的练习单</h2>
        </div>
        {sheets.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="size-12 text-zinc-300 mx-auto mb-4" />
            <p className="text-zinc-600 font-medium mb-1">暂无练习单</p>
            <p className="text-sm text-zinc-400">
              选择上方学生，生成第一份个性化练习单
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {sheets.map((sheet) => (
              <div
                key={sheet.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-lg bg-purple-50 flex items-center justify-center">
                    <FileText className="size-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {sheet.student.name} — {sheet.weekLabel}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {sheet.student.studentNumber} ·{" "}
                      {sheet._count.items} 题
                      {sheet._count.submissions > 0 &&
                        ` · ${sheet._count.submissions} 次提交`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={sheet.status} />
                  <Link
                    href={`/sheets/${sheet.id}`}
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    查看 →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: any; label: string }> = {
    DRAFT: { bg: "bg-zinc-100", text: "text-zinc-600", icon: Clock, label: "草稿" },
    GENERATED: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      icon: CheckCircle,
      label: "已生成",
    },
    PRINTED: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      icon: Printer,
      label: "已打印",
    },
    SUBMITTED: {
      bg: "bg-purple-50",
      text: "text-purple-700",
      icon: CheckCircle,
      label: "已提交",
    },
    REVIEWED: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      icon: CheckCircle,
      label: "已批阅",
    },
  }
  const c = config[status] || config.DRAFT
  const Icon = c.icon
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}
    >
      <Icon className="size-3" />
      {c.label}
    </span>
  )
}

/**
 * Wrapper for generateSheets to work as a form action
 */
async function generateSheetsWrapper(formData: FormData) {
  "use server"
  const studentIds = formData.getAll("studentIds") as string[]
  const questionCount = parseInt(formData.get("questionCount") as string) || 10

  if (studentIds.length === 0) return

  await generateSheets(studentIds, questionCount)
}
