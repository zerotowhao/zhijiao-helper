import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userRole = (session.user as any).role as string

  let classes: { id: string; name: string; grade: string }[]
  if (userRole === "TEACHER") {
    classes = await prisma.class.findMany({
      select: { id: true, name: true, grade: true },
      orderBy: { createdAt: "desc" },
    })
  } else {
    // Student: only their own class
    const userId = (session.user as any).id as string
    const student = await prisma.user.findUnique({
      where: { id: userId },
      select: { classId: true },
    })
    if (student?.classId) {
      classes = await prisma.class.findMany({
        where: { id: student.classId },
        select: { id: true, name: true, grade: true },
      })
    } else {
      classes = []
    }
  }

  return NextResponse.json(classes)
}
