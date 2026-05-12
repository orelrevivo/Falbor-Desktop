import { defineConfig } from "drizzle-kit"
import dotenv from "dotenv"

// Load .env file for drizzle-kit
dotenv.config()

const isPostgres = !!process.env.MAIN_VITE_DATABASE_URL

export default defineConfig({
  schema: isPostgres 
    ? "./src/main/lib/db/schema/pg.ts" 
    : "./src/main/lib/db/schema/index.ts",
  out: "./drizzle",
  dialect: isPostgres ? "postgresql" : "sqlite",
  dbCredentials: isPostgres ? {
    url: process.env.MAIN_VITE_DATABASE_URL!,
  } : undefined,
})
