import { requireTeacher } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"

export default async function StudentsPage() {
  await requireTeacher()

  const classes = await prisma.class.findMany({
    include: {
      _count: { select: { students: true } },
    },
    orderBy: { name: "asc" },
  })

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">学生管理</h1>
      <p className="text-sm text-zinc-500 mb-8">
        管理班级和学生，查看每个学生的学习进度。
      </p>

      {classes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <p className="text-zinc-400 mb-2">还没有添加班级</p>
          <p className="text-sm text-zinc-400">
            请先运行 seed 脚本初始化数据
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="rounded-xl border border-zinc-200 bg-white p-5"
            >
              <h3 className="font-semibold text-zinc-900">{cls.name}</h3>
              <p className="text-sm text-zinc-500">
                {cls.grade} · {cls._count.students} 名学生
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
