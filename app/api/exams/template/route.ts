import { NextResponse } from "next/server"
import * as XLSX from "xlsx"

export async function GET() {
  // Create workbook with template structure
  const wb = XLSX.utils.book_new()

  // Sheet 1: 成绩导入模板
  const templateData = [
    ["学生编号", "学生姓名", "题目编号", "题目得分", "题目满分"],
    ["S00001", "张三", "Q001", 8, 10],
    ["S00001", "张三", "Q002", 0, 10],
    ["S00002", "李四", "Q001", 6, 10],
    ["S00002", "李四", "Q002", 10, 10],
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(templateData)

  // Set column widths
  ws1["!cols"] = [
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
  ]

  XLSX.utils.book_append_sheet(wb, ws1, "成绩导入模板")

  // Sheet 2: 填写说明
  const instructions = [
    ["字段", "说明", "示例"],
    ["学生编号", "学生在系统中的6位编号，如 S00001", "S00001"],
    ["学生姓名", "学生姓名（可选，用于校验）", "张三"],
    ["题目编号", "题目在题库中的编号，需先在题库中添加题目", "Q001"],
    ["题目得分", "该学生在这道题上的得分", "8"],
    ["题目满分", "这道题的满分值", "10"],
    ["", "", ""],
    ["注意事项", "", ""],
    [
      "1",
      "每个学生的每道题占一行，一个Excel可包含多次考试的数据",
      "",
    ],
    [
      "2",
      "题目编号必须与题库中的编号一致，否则该行会被跳过",
      "",
    ],
    ["3", "导入前请确保已在「题库管理」中添加了对应题目", ""],
    ["4", "如需导入多场考试，请使用不同的 Excel 重新导入", ""],
    ["5", "题目得分 ≤ 题目满分，得分 < 满分的 60% 将被标记为错题", ""],
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(instructions)
  ws2["!cols"] = [{ wch: 42 }, { wch: 52 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws2, "填写说明")

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="exam-import-template.xlsx"',
    },
  })
}
