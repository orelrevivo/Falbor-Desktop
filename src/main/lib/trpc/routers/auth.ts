import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { publicProcedure, router } from "../index"
import { getDatabase, users, sessions } from "../../db"
import { eq } from "drizzle-orm"
import crypto from "crypto"
import { getAuthManager } from "../../../index"

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex")
  const hash = crypto.scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(":")
  if (!salt || !key) return false
  const hash = crypto.scryptSync(password, salt, 64).toString("hex")
  return key === hash
}

export const authRouter = router({
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input }) => {
      const { email, password } = input
      const db = getDatabase()

      // Find user
      const userList = await db.select().from(users).where(eq(users.email, email))
      const user = userList[0]
      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" })
      }

      // Verify password
      const isValid = verifyPassword(password, user.passwordHash)
      if (!isValid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" })
      }

      // Create session
      const token = crypto.randomBytes(32).toString("hex")
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30) // 30 days session

      await db.insert(sessions).values({
        userId: user.id,
        token,
        expiresAt,
      })

      // Sync with main process AuthManager
      getAuthManager()?.save({
        token,
        refreshToken: "", // Not used in custom auth yet
        expiresAt: expiresAt.toISOString(),
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          imageUrl: null,
          username: null,
        },
      })

      return {
        token,
        user: { id: user.id, email: user.email, name: user.name },
      }
    }),

  register: publicProcedure
    .input(z.object({ 
      email: z.string().email(), 
      password: z.string().min(6),
      name: z.string().optional() 
    }))
    .mutation(async ({ input }) => {
      const { email, password, name } = input
      const db = getDatabase()

      // Check if exists
      const existing = await db.select().from(users).where(eq(users.email, email))
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "User with this email already exists" })
      }

      // Create user
      const passwordHash = hashPassword(password)
      const newUserList = await db.insert(users).values({ 
        email, 
        passwordHash,
        name: name || null
      }).returning()
      const newUser = newUserList[0]

      if (!newUser) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create user" })
      }

      // Create session
      const token = crypto.randomBytes(32).toString("hex")
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      await db.insert(sessions).values({
        userId: newUser.id,
        token,
        expiresAt,
      })

      // Sync with main process AuthManager
      getAuthManager()?.save({
        token,
        refreshToken: "",
        expiresAt: expiresAt.toISOString(),
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          imageUrl: null,
          username: null,
        },
      })

      return {
        token,
        user: { id: newUser.id, email: newUser.email, name: newUser.name },
      }
    }),

  me: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = getDatabase()
      const sessionList = await db.select().from(sessions).where(eq(sessions.token, input.token))
      const session = sessionList[0]

      if (!session || session.expiresAt < new Date()) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Session expired or invalid" })
      }

      const userList = await db.select().from(users).where(eq(users.id, session.userId))
      const user = userList[0]

      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" })
      }

      // Sync with main process AuthManager (ensures main process knows who is logged in)
      getAuthManager()?.save({
        token: input.token,
        refreshToken: "",
        expiresAt: session.expiresAt.toISOString(),
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          imageUrl: null,
          username: null,
        },
      })

      return { id: user.id, email: user.email, name: user.name }
    }),

  logout: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDatabase()
      await db.delete(sessions).where(eq(sessions.token, input.token))
      
      // Clear main process AuthManager
      getAuthManager()?.logout()
      
      return { success: true }
    }),

  updateProfile: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDatabase()
      if (!ctx.userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" })
      }

      const updatedUserList = await db
        .update(users)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(users.id, ctx.userId))
        .returning()
      
      const updatedUser = updatedUserList[0]
      if (!updatedUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" })
      }

      // Sync with main process AuthManager
      const currentAuth = getAuthManager()?.getAuth()
      if (currentAuth) {
        getAuthManager()?.save({
          ...currentAuth,
          user: {
            ...currentAuth.user,
            name: updatedUser.name,
          },
        })
      }

      return { id: updatedUser.id, email: updatedUser.email, name: updatedUser.name }
    }),
})
