"use server"

import { signIn } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { AuthError } from "next-auth"

export async function loginAction(formData: FormData) {
  const loginId = formData.get("loginId") as string
  const password = formData.get("password") as string

  if (!loginId || !password) {
    return { error: "请输入账号和密码" }
  }

  try {
    console.log("[loginAction] calling signIn with:", { loginId, hasPassword: !!password })
    await signIn("credentials", {
      loginId,
      password,
      redirectTo: "/",
    })
    console.log("[loginAction] signIn returned successfully")
  } catch (error) {
    console.log("[loginAction] caught error:", (error as Error).constructor.name, (error as Error).message)
    if (error instanceof AuthError) {
      return { error: "账号或密码错误" }
    }
    // signIn throws a NEXT_REDIRECT on success in server actions
    console.log("[loginAction] re-throwing:", (error as Error).constructor.name)
    throw error
  }
}

export async function signupAction(formData: FormData) {
  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const role = formData.get("role") as string
  const studentNumber = formData.get("studentNumber") as string
  const classId = formData.get("classId") as string

  if (!name || !password) {
    return { error: "请填写姓名和密码" }
  }

  if (role === "TEACHER" && !email) {
    return { error: "教师需要填写邮箱" }
  }

  if (role === "STUDENT" && !studentNumber) {
    return { error: "学生需要填写学号" }
  }

  // Check uniqueness
  if (email) {
    const existingEmail = await prisma.user.findUnique({ where: { email } })
    if (existingEmail) {
      return { error: "该邮箱已被注册" }
    }
  }

  if (studentNumber) {
    const existingStudent = await prisma.user.findUnique({
      where: { studentNumber },
    })
    if (existingStudent) {
      return { error: "该学号已存在" }
    }
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.user.create({
    data: {
      name,
      email: email || null,
      passwordHash,
      role: role as any,
      studentNumber: studentNumber || null,
      classId: classId || null,
    },
  })

  // Auto sign in after signup
  const loginId = role === "TEACHER" ? email : studentNumber
  await signIn("credentials", {
    loginId,
    password,
    redirectTo: "/",
  })
}
