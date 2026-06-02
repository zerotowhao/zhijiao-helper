"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { importExamResults, type ImportResult } from "@/app/actions/exam-import"
import { Upload, Download, FileSpreadsheet, X, AlertCircle, CheckCircle, Loader2 } from "lucide-react"

export default function ExamImportPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [examName, setExamName] = useState("")
  const [examDate, setExamDate] = useState(
    new Date().toISOString().split("T")[0]
  )
  const [classId, setClassId] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) setFile(f)
    setResult(null)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (
      f &&
      (f.name.endsWith(".xlsx") ||
        f.name.endsWith(".xls") ||
        f.name.endsWith(".csv"))
    ) {
      setFile(f)
      setResult(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !classId) return

    setLoading(true)
    setResult(null)

    const fd = new FormData()
    fd.append("file", file)
    fd.append("examName", examName || file.name.replace(/\.(xlsx?|csv)$/i, ""))
    fd.append("examDate", examDate)
    fd.append("classId", classId)

    try {
      const res = await importExamResults(fd)
      setResult(res)
      if (res.success) {
        router.refresh()
      }
    } catch (err) {
      setResult({
        success: false,
        totalRows: 0,
        importedRows: 0,
        skippedRows: 0,
        errors: [`导入失败: ${(err as Error).message}`],
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">导入考试数据</h1>
          <p className="text-sm text-zinc-500 mt-1">
            上传智学网或自制的 Excel 成绩表，自动分析知识点得分率
          </p>
        </div>
        <a
          href="/api/exams/template"
          className="inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
        >
          <Download className="size-4" />
          下载模板
        </a>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Meta info */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              考试名称
            </label>
            <input
              type="text"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              placeholder="如：期中考试"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              考试日期
            </label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              班级
            </label>
            <ClassSelector value={classId} onChange={setClassId} />
          </div>
        </div>

        {/* Upload area */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`relative rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
            dragOver
              ? "border-emerald-400 bg-emerald-50"
              : file
                ? "border-emerald-300 bg-emerald-50/50"
                : "border-zinc-300 bg-white hover:border-zinc-400"
          }`}
        >
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileSpreadsheet className="size-8 text-emerald-600" />
              <div className="text-left">
                <p className="text-sm font-medium text-zinc-900">
                  {file.name}
                </p>
                <p className="text-xs text-zinc-500">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null)
                  setResult(null)
                }}
                className="ml-2 p-1 rounded-full hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="size-10 text-zinc-300 mx-auto mb-3" />
              <p className="text-sm text-zinc-600 mb-1">
                拖拽 Excel 文件到此处，或
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-emerald-600 hover:text-emerald-700 font-medium mx-1"
                >
                  点击选择文件
                </button>
              </p>
              <p className="text-xs text-zinc-400">
                支持 .xlsx、.xls、.csv 格式
              </p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!file || !classId || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              导入中...
            </>
          ) : (
            "开始导入"
          )}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div
          className={`mt-8 rounded-xl border p-6 ${
            result.success
              ? "border-emerald-200 bg-emerald-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          <div className="flex items-center gap-2 mb-4">
            {result.success ? (
              <CheckCircle className="size-5 text-emerald-600" />
            ) : (
              <AlertCircle className="size-5 text-red-600" />
            )}
            <h3 className="font-semibold text-zinc-900">
              {result.success ? "导入成功" : "导入失败"}
            </h3>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-4">
            <Stat label="总行数" value={result.totalRows} />
            <Stat label="成功导入" value={result.importedRows} />
            <Stat label="跳过" value={result.skippedRows} />
            <Stat label="涉及学生" value={result.analysis?.studentCount ?? 0} />
          </div>

          {result.success && result.examId && (
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => router.push(`/exams/${result.examId}`)}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                查看详细分析 →
              </button>
            </div>
          )}

          {result.errors.length > 0 && (
            <details className="mt-4">
              <summary className="text-sm text-zinc-600 cursor-pointer hover:text-zinc-800">
                查看详情（{result.errors.length} 条）
              </summary>
              <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <li
                    key={i}
                    className="text-xs text-zinc-500 pl-3 border-l-2 border-zinc-200"
                  >
                    {err}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  )
}

/**
 * 客户端班级选择器 - 从 API 加载班级列表
 */
function ClassSelector({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch("/api/classes")
      .then((r) => r.json())
      .then((data) => {
        setClasses(data)
        if (data.length > 0 && !value) {
          onChange(data[0].id)
        }
      })
      .catch(() => {})
  }, [])

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
    >
      <option value="">选择班级</option>
      {classes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  )
}
