import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { FileText, Send, Clock, CheckCircle, Printer, ArrowRight } from "lucide-react"

export default async function MySheetsPage() {
  const session = await auth()
  if (!session?.user) return null

  const userId = (session.user as any).userId || (session.user as any).id
  const userRole = (session.user as any).role

  // Students see their own sheets, teachers see all
  const sheets = await prisma.practiceSheet.findMany({
    where: userRole === "STUDENT" ? { studentId: userId } : {},
    orderBy: { createdAt: "desc" },
    include: {
      student: { select: { name: true, studentNumber: true } },
      _count: { select: { items: true, submissions: true } },
    },
    take: 50,
  })

  const isStudent = userRole === "STUDENT"

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-zinc-900">
          {isStudent ? "我的练习单" : "全部练习单"}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {isStudent
            ? "查看并提交你的个性化练习单"
            : "查看所有学生的练习单和提交情况"}
        </p>
      </div>

      {sheets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <FileText className="size-12 text-zinc-300 mx-auto mb-4" />
          <p className="text-zinc-600 font-medium mb-1">暂无练习单</p>
          <p className="text-sm text-zinc-400">
            {isStudent
              ? "老师还没有为你生成本周的练习单，请耐心等待"
              : "还没有生成任何练习单"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sheets.map((sheet) => (
            <Link
              key={sheet.id}
              href={
                isStudent && sheet.status !== "SUBMITTED" && sheet.status !== "REVIEWED"
                  ? `/my-sheets/${sheet.id}/submit`
                  : `/my-sheets/${sheet.id}`
              }
              className="block rounded-xl border border-zinc-200 bg-white p-4 md:p-5 hover:border-emerald-300 hover:shadow-sm transition-all active:scale-[0.99]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 md:gap-4 min-w-0">
                  <div
                    className={`size-10 md:size-12 rounded-xl flex items-center justify-center shrink-0 ${
                      sheet.status === "GENERATED" || sheet.status === "PRINTED"
                        ? "bg-emerald-50"
                        : sheet.status === "SUBMITTED"
                          ? "bg-purple-50"
                          : sheet.status === "REVIEWED"
                            ? "bg-amber-50"
                            : "bg-zinc-50"
                    }`}
                  >
                    {sheet.status === "SUBMITTED" || sheet.status === "REVIEWED" ? (
                      <CheckCircle
                        className={`size-5 md:size-6 ${
                          sheet.status === "REVIEWED"
                            ? "text-amber-600"
                            : "text-purple-600"
                        }`}
                      />
                    ) : sheet.status === "PRINTED" ? (
                      <Printer className="size-5 md:size-6 text-blue-600" />
                    ) : (
                      <FileText className="size-5 md:size-6 text-emerald-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-zinc-900 text-sm md:text-base">
                        {sheet.student.name}
                      </p>
                      <span className="text-xs text-zinc-400">
                        {sheet.student.studentNumber}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {sheet.weekLabel} · {sheet._count.items} 题
                      {sheet._count.submissions > 0 &&
                        ` · ${sheet._count.submissions} 次提交`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:gap-3 shrink-0">
                  <StatusBadge status={sheet.status} />
                  <ArrowRight className="size-4 text-zinc-300 hidden md:block" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { bg: string; text: string; label: string }
  > = {
    DRAFT: { bg: "bg-zinc-100", text: "text-zinc-600", label: "草稿" },
    GENERATED: { bg: "bg-emerald-100", text: "text-emerald-700", label: "待完成" },
    PRINTED: { bg: "bg-blue-100", text: "text-blue-700", label: "已打印" },
    SUBMITTED: { bg: "bg-purple-100", text: "text-purple-700", label: "已提交" },
    REVIEWED: { bg: "bg-amber-100", text: "text-amber-700", label: "已批阅" },
  }
  const c = config[status] || config.DRAFT
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  )
}
