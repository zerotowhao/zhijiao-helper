import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }
  return session
}

export async function requireTeacher() {
  const session = await requireAuth()
  if ((session.user as any).role !== "TEACHER") {
    redirect("/dashboard")
  }
  return session
}
