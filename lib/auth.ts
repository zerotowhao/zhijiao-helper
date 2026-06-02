import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        loginId: { label: "教师账号/学生编号", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        console.log("[authorize] credentials received:", { loginId: credentials?.loginId, hasPassword: !!credentials?.password })

        if (!credentials?.loginId || !credentials?.password) {
          console.log("[authorize] missing credentials")
          return null
        }

        const { loginId, password } = credentials as {
          loginId: string
          password: string
        }

        console.log("[authorize] looking up user:", loginId)
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: loginId },
              { studentNumber: loginId },
            ],
          },
        })

        console.log("[authorize] user found:", user?.name || "null")
        if (!user) return null

        const isValid = await bcrypt.compare(password, user.passwordHash)
        console.log("[authorize] password valid:", isValid)
        if (!isValid) return null

        const result = {
          id: user.id,
          name: user.name,
          email: user.email || "",
          role: user.role,
        }
        console.log("[authorize] returning user:", result)
        return result
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userRole = (user as any).role as string
        token.userId = user.id as string
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId as string
        (session.user as any).role = token.userRole as string
      }
      return session
    },
  },
})
