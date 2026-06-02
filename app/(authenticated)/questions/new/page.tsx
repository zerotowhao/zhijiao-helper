import { requireTeacher } from "@/lib/auth-utils"
import QuestionForm from "@/components/question-form"

export default async function NewQuestionPage() {
  await requireTeacher()

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">添加题目</h1>
      <QuestionForm />
    </div>
  )
}
