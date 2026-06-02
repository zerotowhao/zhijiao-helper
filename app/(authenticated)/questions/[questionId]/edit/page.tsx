import { requireTeacher } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import QuestionForm from "@/components/question-form"
import { notFound } from "next/navigation"

interface Props {
  params: Promise<{ questionId: string }>
}

export default async function EditQuestionPage({ params }: Props) {
  await requireTeacher()
  const { questionId } = await params

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      knowledgePoints: { select: { knowledgePointId: true } },
    },
  })

  if (!question) notFound()

  const formData = {
    id: question.id,
    content: question.content,
    answer: question.answer,
    explanation: question.explanation,
    questionType: question.questionType,
    difficulty: question.difficulty,
    options: (question.options as { label: string; text: string }[] | null) || null,
    knowledgePoints: question.knowledgePoints.map((k: any) => ({
      knowledgePointId: k.knowledgePointId,
    })),
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">编辑题目</h1>
      <QuestionForm question={formData} />
    </div>
  )
}
