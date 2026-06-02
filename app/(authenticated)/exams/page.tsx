import { requireTeacher } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Upload, FileSpreadsheet, ArrowRight, Calendar } from "lucide-react"

export default async function ExamsPage() {
  const session = await requireTeacher()

  // Get classes for the teacher
  const classes = await prisma.class.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  })

  // Get all exams with stats
  const exams = await prisma.exam.findMany({
    orderBy: { examDate: "desc" },
    include: {
      class: { select: { name: true } },
      _count: { select: { results: true } },
    },
    take: 30,
  })

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">考试分析</h1>
          <p className="text-sm text-zinc-500 mt-1">
            上传考试成绩表，自动分析每个知识点的得分率，定位班级薄弱环节
          </p>
        </div>
        <Link
          href="/exams/import"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          <Upload className="size-4" />
          导入考试数据
        </Link>
      </div>

      {exams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-16 text-center">
          <FileSpreadsheet className="size-12 text-zinc-300 mx-auto mb-4" />
          <p className="text-zinc-600 font-medium mb-1">暂无考试数据</p>
          <p className="text-sm text-zinc-400 mb-4">
            上传智学网导出的 Excel 成绩表，或手动录入考试结果
          </p>
          <Link
            href="/exams/import"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            <Upload className="size-4" />
            导入第一场考试
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="divide-y divide-zinc-100">
            {exams.map((exam) => (
              <Link
                key={exam.id}
                href={`/exams/${exam.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Calendar className="size-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900 group-hover:text-emerald-700 transition-colors">
                      {exam.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {exam.class.name} ·{" "}
                      {exam.examDate.toLocaleDateString("zh-CN")} ·{" "}
                      {exam._count.results} 名学生
                    </p>
                  </div>
                </div>
                <ArrowRight className="size-4 text-zinc-300 group-hover:text-emerald-600 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
