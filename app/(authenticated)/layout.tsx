import { AppSidebar } from "@/components/app-sidebar"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="flex w-full min-h-screen">
      <AppSidebar user={session.user} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
