import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const points = await prisma.knowledgePoint.findMany({
    select: { id: true, name: true, book: true, module: true },
    orderBy: [{ book: "asc" }, { module: "asc" }, { sortOrder: "asc" }],
  })

  return NextResponse.json(points)
}
