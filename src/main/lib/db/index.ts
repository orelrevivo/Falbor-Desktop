import Database from "better-sqlite3"
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3"
import { migrate as migrateSqlite } from "drizzle-orm/better-sqlite3/migrator"
import { neon } from "@neondatabase/serverless"
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http"
import { app } from "electron"
import { join } from "path"
import { existsSync, mkdirSync } from "fs"
import * as sqliteSchema from "./schema"
import * as pgSchema from "./schema/pg"

let db: any = null
let sqlite: Database.Database | null = null

const DATABASE_URL = import.meta.env.MAIN_VITE_DATABASE_URL

/**
 * Get the database path in the app's user data directory
 */
function getDatabasePath(): string {
  const userDataPath = app.getPath("userData")
  const dataDir = join(userDataPath, "data")

  // Ensure data directory exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }

  return join(dataDir, "agents.db")
}

/**
 * Get the migrations folder path
 */
function getMigrationsPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, "migrations")
  }
  return join(__dirname, "../../drizzle")
}

/**
 * Initialize the database with Drizzle ORM
 */
export function initDatabase() {
  if (db) {
    return db
  }

  if (DATABASE_URL) {
    console.log("[DB] Initializing Neon database")
    try {
      const sql = neon(DATABASE_URL)
      db = drizzleNeon(sql, { schema: pgSchema })
      console.log("[DB] Neon database initialized")
      return db
    } catch (error) {
      console.error("[DB] Neon initialization error:", error)
      // Fallback to SQLite if Neon fails? 
      // Probably better to let it fail if the user explicitly set a URL
      throw error
    }
  }

  const dbPath = getDatabasePath()
  console.log(`[DB] Initializing local SQLite database at: ${dbPath}`)

  // Create SQLite connection
  sqlite = new Database(dbPath)
  sqlite.pragma("journal_mode = WAL")
  sqlite.pragma("foreign_keys = ON")

  // Create Drizzle instance
  db = drizzleSqlite(sqlite, { schema: sqliteSchema })

  // Run migrations
  const migrationsPath = getMigrationsPath()
  console.log(`[DB] Running SQLite migrations from: ${migrationsPath}`)

  try {
    migrateSqlite(db, { migrationsFolder: migrationsPath })
    console.log("[DB] SQLite migrations completed")
  } catch (error) {
    console.error("[DB] SQLite migration error:", error)
    throw error
  }

  return db
}

/**
 * Get the database instance
 */
export function getDatabase() {
  if (!db) {
    return initDatabase()
  }
  return db
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (sqlite) {
    sqlite.close()
    sqlite = null
    db = null
    console.log("[DB] SQLite database connection closed")
  }
}

// Re-export schema for convenience, choosing based on connection
export const projects = DATABASE_URL ? pgSchema.projects : sqliteSchema.projects
export const chats = DATABASE_URL ? pgSchema.chats : sqliteSchema.chats
export const subChats = DATABASE_URL ? pgSchema.subChats : sqliteSchema.subChats
export const claudeCodeCredentials = DATABASE_URL ? pgSchema.claudeCodeCredentials : sqliteSchema.claudeCodeCredentials
export const anthropicAccounts = DATABASE_URL ? pgSchema.anthropicAccounts : sqliteSchema.anthropicAccounts
export const anthropicSettings = DATABASE_URL ? pgSchema.anthropicSettings : sqliteSchema.anthropicSettings

/**
 * Dialect-agnostic helper to get a single row
 */
export async function getOne<T>(query: any): Promise<T | null> {
  if (DATABASE_URL) {
    const results = await query
    return (results[0] as T) || null
  }
  return (query.get() as T) || null
}

/**
 * Dialect-agnostic helper to get all rows
 */
export async function getAll<T>(query: any): Promise<T[]> {
  if (DATABASE_URL) {
    return (await query) as T[]
  }
  return (query.all() as T[]) || []
}

/**
 * Dialect-agnostic helper to run a query (insert/update/delete)
 */
export async function runQuery(query: any): Promise<void> {
  if (DATABASE_URL) {
    await query
  } else {
    query.run()
  }
}
