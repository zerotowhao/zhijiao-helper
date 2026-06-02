"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { X, Plus } from "lucide-react"
import { createQuestion, updateQuestion } from "@/app/actions/questions"

interface KnowledgePoint {
  id: string
  name: string
  book: string
  module: string
}

interface Props {
  // For edit mode
  question?: {
    id: string
    content: string
    answer: string
    explanation: string | null
    questionType: string
    difficulty: string
    options: { label: string; text: string }[] | null
    knowledgePoints: { knowledgePointId: string }[]
  }
}

export default function QuestionForm({ question }: Props) {
  const router = useRouter()
  const isEdit = !!question

  const [content, setContent] = useState(question?.content || "")
  const [answer, setAnswer] = useState(question?.answer || "")
  const [explanation, setExplanation] = useState(question?.explanation || "")
  const [questionType, setQuestionType] = useState(
    question?.questionType || "CHOICE"
  )
  const [difficulty, setDifficulty] = useState(question?.difficulty || "MEDIUM")
  const [selectedKps, setSelectedKps] = useState<string[]>(
    question?.knowledgePoints.map((k) => k.knowledgePointId) || []
  )
  const [options, setOptions] = useState<{ label: string; text: string }[]>(
    question?.options || [
      { label: "A", text: "" },
      { label: "B", text: "" },
      { label: "C", text: "" },
      { label: "D", text: "" },
    ]
  )

  const [allKps, setAllKps] = useState<KnowledgePoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Load knowledge points
  useEffect(() => {
    fetch("/api/knowledge-points")
      .then((r) => r.json())
      .then(setAllKps)
      .catch(() => {})
  }, [])

  // Group KPs by book → module
  const kpGroups = new Map<string, Map<string, KnowledgePoint[]>>()
  for (const kp of allKps) {
    if (!kpGroups.has(kp.book)) kpGroups.set(kp.book, new Map())
    const bookMap = kpGroups.get(kp.book)!
    if (!bookMap.has(kp.module)) bookMap.set(kp.module, [])
    bookMap.get(kp.module)!.push(kp)
  }

  function toggleKp(kpId: string) {
    setSelectedKps((prev) =>
      prev.includes(kpId) ? prev.filter((id) => id !== kpId) : [...prev, kpId]
    )
  }

  function addOption() {
    const nextLabel = String.fromCharCode(65 + options.length) // A, B, C, ...
    setOptions([...options, { label: nextLabel, text: "" }])
  }

  function removeOption(index: number) {
    if (options.length <= 2) return
    setOptions(options.filter((_, i) => i !== index))
  }

  function updateOption(index: number, text: string) {
    const updated = [...options]
    updated[index] = { ...updated[index], text }
    setOptions(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!content.trim()) {
      setError("请输入题目内容")
      return
    }
    if (!answer.trim()) {
      setError("请输入答案")
      return
    }
    if (selectedKps.length === 0) {
      setError("请至少选择一个知识点")
      return
    }

    setLoading(true)
    const fd = new FormData()
    fd.append("content", content)
    fd.append("answer", answer)
    fd.append("explanation", explanation)
    fd.append("questionType", questionType)
    fd.append("difficulty", difficulty)
    fd.append("knowledgePointIds", JSON.stringify(selectedKps))

    if (questionType === "CHOICE") {
      for (const opt of options) {
        fd.append("optionLabels", opt.label)
        fd.append("optionTexts", opt.text)
      }
    }

    let result: { success: boolean; questionId?: string; error?: string }
    if (isEdit) {
      result = await updateQuestion(question!.id, fd)
    } else {
      result = await createQuestion(fd)
    }

    if (result.success) {
      router.push("/questions")
      router.refresh()
    } else {
      setError(result.error || "保存失败")
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Content */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          题目内容 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          placeholder="请输入题目内容（纯文本，无需 LaTeX 或图片）"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-y"
        />
      </div>

      {/* Type + Difficulty */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            题型 <span className="text-red-500">*</span>
          </label>
          <select
            value={questionType}
            onChange={(e) => setQuestionType(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none bg-white"
          >
            <option value="CHOICE">选择题</option>
            <option value="FILL_IN_BLANK">填空题</option>
            <option value="SHORT_ANSWER">简答题</option>
            <option value="EXPERIMENT_DESIGN">实验设计题</option>
            <option value="CHART_ANALYSIS">图表分析题</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            难度
          </label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none bg-white"
          >
            <option value="EASY">简单</option>
            <option value="MEDIUM">中等</option>
            <option value="HARD">困难</option>
          </select>
        </div>
      </div>

      {/* Options (only for CHOICE) */}
      {questionType === "CHOICE" && (
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            选项
          </label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="size-7 rounded bg-zinc-100 text-xs font-bold text-zinc-500 flex items-center justify-center shrink-0">
                  {opt.label}
                </span>
                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`选项 ${opt.label}`}
                  className="flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addOption}
            className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
          >
            <Plus className="size-3" />
            添加选项
          </button>
        </div>
      )}

      {/* Answer */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          答案 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={questionType === "CHOICE" ? "如：A" : "如：光合作用的光反应阶段"}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Explanation */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          解析
        </label>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={2}
          placeholder="可选，添加题目解析说明"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-y"
        />
      </div>

      {/* Knowledge Point Selector */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">
          关联知识点 <span className="text-red-500">*</span>
          <span className="text-zinc-400 font-normal ml-2">
            已选 {selectedKps.length} 个
          </span>
        </label>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 max-h-72 overflow-y-auto">
          {Array.from(kpGroups.entries()).map(([book, modules]) => (
            <div key={book} className="mb-3 last:mb-0">
              <p className="text-xs font-semibold text-zinc-500 mb-2">{book}</p>
              {Array.from(modules.entries()).map(([module, kps]) => (
                <div key={module} className="mb-2 last:mb-0 ml-2">
                  <p className="text-xs text-zinc-400 mb-1">{module}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {kps.map((kp) => {
                      const selected = selectedKps.includes(kp.id)
                      return (
                        <button
                          key={kp.id}
                          type="button"
                          onClick={() => toggleKp(kp.id)}
                          className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                            selected
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300"
                          }`}
                        >
                          {kp.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "保存中..." : isEdit ? "保存修改" : "添加题目"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          取消
        </button>
      </div>
    </form>
  )
}
