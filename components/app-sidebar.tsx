"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  FileSpreadsheet,
  Library,
  FileText,
  Users,
  BarChart3,
  LogOut,
  BookOpen,
} from "lucide-react"

interface SidebarProps {
  user: any
}

const teacherNavItems = [
  {
    label: "首页仪表盘",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "考试分析",
    href: "/exams",
    icon: FileSpreadsheet,
  },
  {
    label: "题库管理",
    href: "/questions",
    icon: Library,
  },
  {
    label: "练习单",
    href: "/sheets",
    icon: FileText,
  },
  {
    label: "学生管理",
    href: "/students",
    icon: Users,
  },
  {
    label: "数据看板",
    href: "/analytics",
    icon: BarChart3,
  },
]

const studentNavItems = [
  {
    label: "首页",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "我的练习单",
    href: "/my-sheets",
    icon: FileText,
  },
]

export function AppSidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const userRole = (user as any)?.role
  const navItems = userRole === "STUDENT" ? studentNavItems : teacherNavItems

  if (!user) return null

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-zinc-200 flex flex-col shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-100">
        <BookOpen className="size-5 text-emerald-600" />
        <span className="font-semibold text-zinc-900">智教助手</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User info & logout */}
      <div className="border-t border-zinc-100 px-4 py-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="size-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-medium text-emerald-700">
            {user?.name?.charAt(0) || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-900 truncate">
              {user?.name}
            </p>
            <p className="text-xs text-zinc-500">
              {(user as any)?.role === "TEACHER" ? "教师" : "学生"}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-red-600 transition-colors w-full px-1 py-1 rounded"
        >
          <LogOut className="size-3.5" />
          退出登录
        </button>
      </div>
    </aside>
  )
}
