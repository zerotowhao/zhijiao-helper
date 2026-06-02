import { requireTeacher } from "@/lib/auth-utils"

export default async function AnalyticsPage() {
  await requireTeacher()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">数据看板</h1>
      <p className="text-sm text-zinc-500">
        班级整体进度、学生个人成长轨迹、知识点掌握热力图。
      </p>
      <div className="mt-8 rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center">
        <p className="text-zinc-400">数据看板功能将在后续阶段实现</p>
      </div>
    </div>
  )
}
