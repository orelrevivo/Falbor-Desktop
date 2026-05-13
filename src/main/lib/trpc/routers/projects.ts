import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { router, publicProcedure } from "../index"
import { getDatabase, projects, getAll, getOne, runQuery } from "../../db"
import { eq, desc, and } from "drizzle-orm"
import { dialog, BrowserWindow, app } from "electron"
import { basename, join } from "path"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import { existsSync } from "node:fs"
import { mkdir, copyFile, unlink, writeFile } from "node:fs/promises"
import { extname } from "node:path"
import { getGitRemoteInfo } from "../../git"
import { trackProjectOpened } from "../../analytics"
import { getLaunchDirectory } from "../../cli"

const execAsync = promisify(exec)

export const projectsRouter = router({
  /**
   * Get launch directory from CLI args (consumed once)
   * Based on PR #16 by @caffeinum
   */
  getLaunchDirectory: publicProcedure.query(() => {
    return getLaunchDirectory()
  }),

  /**
   * List all projects
   */
  list: publicProcedure.query(async ({ ctx }) => {
    const db = getDatabase()
    if (!ctx.userId) return []
    return getAll(db.select().from(projects).where(eq(projects.userId, ctx.userId)).orderBy(desc(projects.updatedAt)))
  }),

  /**
   * Get a single project by ID
   */
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = getDatabase()
      if (!ctx.userId) return null
      return getOne(db.select().from(projects).where(and(eq(projects.id, input.id), eq(projects.userId, ctx.userId))))
    }),

  /**
   * Open folder picker and create project
   */
  openFolder: publicProcedure.mutation(async ({ ctx }) => {
    const window = ctx.getWindow?.() ?? BrowserWindow.getFocusedWindow()

    if (!window) {
      console.error("[Projects] No window available for folder dialog")
      return null
    }

    // Ensure window is focused before showing dialog (fixes first-launch timing issue on macOS)
    if (!window.isFocused()) {
      console.log("[Projects] Window not focused, focusing before dialog...")
      window.focus()
      // Small delay to ensure focus is applied by the OS
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    const result = await dialog.showOpenDialog(window, {
      properties: ["openDirectory", "createDirectory"],
      title: "Select Project Folder",
      buttonLabel: "Open Project",
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const folderPath = result.filePaths[0]!
    const folderName = basename(folderPath)

    // Get git remote info
    const gitInfo = await getGitRemoteInfo(folderPath)

    const db = getDatabase()

    const existing = await getOne<any>(
      db
        .select()
        .from(projects)
        .where(and(eq(projects.path, folderPath), eq(projects.userId, ctx.userId)))
    )

    if (existing) {
      // Update the updatedAt timestamp and git info (in case remote changed)
      const updatedProject = await getOne<any>(
        db
          .update(projects)
          .set({
            updatedAt: new Date(),
            gitRemoteUrl: gitInfo.remoteUrl,
            gitProvider: gitInfo.provider,
            gitOwner: gitInfo.owner,
            gitRepo: gitInfo.repo,
          })
          .where(and(eq(projects.id, existing.id), eq(projects.userId, ctx.userId)))
          .returning()
      )

      // Track project opened
      trackProjectOpened({
        id: updatedProject!.id,
        hasGitRemote: !!gitInfo.remoteUrl,
      })

      return updatedProject
    }

    // Create new project with git info
    const newProject = await getOne<any>(
      db
        .insert(projects)
        .values({
          name: folderName,
          path: folderPath,
          gitRemoteUrl: gitInfo.remoteUrl,
          gitProvider: gitInfo.provider,
          gitOwner: gitInfo.owner,
          gitRepo: gitInfo.repo,
          userId: ctx.userId,
        })
        .returning()
    )

    // Track project opened
    trackProjectOpened({
      id: newProject!.id,
      hasGitRemote: !!gitInfo.remoteUrl,
    })

    return newProject
  }),

  /**
   * Create a project from a known path
   */
  create: publicProcedure
    .input(z.object({ path: z.string(), name: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDatabase()
      if (!ctx.userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" })
      }
      const name = input.name || basename(input.path)

      // Check if project already exists
      const existing = await getOne<any>(
        db
          .select()
          .from(projects)
          .where(and(eq(projects.path, input.path), eq(projects.userId, ctx.userId)))
      )

      if (existing) {
        return existing
      }

      // Get git remote info
      const gitInfo = await getGitRemoteInfo(input.path)

      return getOne<any>(
        db
          .insert(projects)
          .values({
            name,
            path: input.path,
            gitRemoteUrl: gitInfo.remoteUrl,
            gitProvider: gitInfo.provider,
            gitOwner: gitInfo.owner,
            gitRepo: gitInfo.repo,
            userId: ctx.userId,
          })
          .returning()
      )
    }),
  
  /**
   * Create a new project from scratch (Website or App)
   */
  createScratchProject: publicProcedure
    .input(z.object({ type: z.enum(["website", "app"]) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDatabase()
      if (!ctx.userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" })
      }
      const timestamp = new Date().toLocaleDateString('en-US').replace(/\//g, '-') + '-' + Math.floor(Math.random() * 1000)
      const projectName = `${input.type === "website" ? "New-Website" : "New-App"}-${timestamp}`
      
      const homePath = app.getPath("home")
      const scratchDir = join(homePath, ".21st", "repos", "scratch")
      const projectPath = join(scratchDir, projectName)
      
      if (!existsSync(projectPath)) {
        await mkdir(projectPath, { recursive: true })
      }

      // Scaffold Vite files
      const packageJson = {
        name: projectName.toLowerCase(),
        private: true,
        version: "0.0.0",
        type: "module",
        scripts: {
          "dev": "vite",
          "build": "tsc && vite build",
          "preview": "vite preview"
        },
        dependencies: {
          "react": "^19.0.0",
          "react-dom": "^19.0.0"
        },
        devDependencies: {
          "@types/react": "^19.0.0",
          "@types/react-dom": "^19.0.0",
          "@vitejs/plugin-react": "^4.0.0",
          "typescript": "^5.0.0",
          "vite": "^6.0.0"
        }
      }

      const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})`

      const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`

      const mainTsx = `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`

      const appTsx = `import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
      backgroundColor: '#242424',
      color: 'white'
    }}>
      <h1>${input.type === 'website' ? 'My New Website' : 'My New App'}</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)} style={{
          padding: '0.6em 1.2em',
          fontSize: '1em',
          fontWeight: 500,
          backgroundColor: '#1a1a1a',
          cursor: 'pointer',
          border: '1px solid transparent',
          borderRadius: '8px',
          transition: 'border-color 0.25s'
        }}>
          count is {count}
        </button>
      </div>
      <p style={{ color: '#888' }}>
        Built with Vite + React + TypeScript
      </p>
    </div>
  )
}

export default App`

      const indexCss = `body { margin: 0; }`

      await writeFile(join(projectPath, "package.json"), JSON.stringify(packageJson, null, 2))
      await writeFile(join(projectPath, "vite.config.ts"), viteConfig)
      await writeFile(join(projectPath, "index.html"), indexHtml)
      await mkdir(join(projectPath, "src"), { recursive: true })
      await writeFile(join(projectPath, "src", "main.tsx"), mainTsx)
      await writeFile(join(projectPath, "src", "App.tsx"), appTsx)
      await writeFile(join(projectPath, "src", "index.css"), indexCss)

      const newProject = await getOne<any>(
        db
          .insert(projects)
          .values({
            name: projectName,
            path: projectPath,
            type: input.type,
            userId: ctx.userId,
          })
          .returning()
      )

      trackProjectOpened({
        id: newProject!.id,
        hasGitRemote: false,
      })

      return newProject
    }),

  /**
   * Ensure a default project exists (Master Mode)
   */
  ensureDefaultProject: publicProcedure.mutation(async ({ ctx }) => {
    const db = getDatabase()
    if (!ctx.userId) return null
    const allProjects = await getAll(db.select().from(projects).where(eq(projects.userId, ctx.userId)))
    
    if (allProjects.length > 0) {
      return allProjects[0]
    }

    // Create a default project in ~/.21st/repos/default
    const homePath = app.getPath("home")
    const defaultPath = join(homePath, ".21st", "repos", "default")
    
    if (!existsSync(defaultPath)) {
      await mkdir(defaultPath, { recursive: true })
    }

    return getOne<any>(
      db
        .insert(projects)
        .values({
          name: "Default Project",
          path: defaultPath,
          userId: ctx.userId,
        })
        .returning()
    )
  }),

  /**
   * Rename a project
   */
  rename: publicProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDatabase()
      return getOne(
        db
          .update(projects)
          .set({ name: input.name, updatedAt: new Date() })
          .where(and(eq(projects.id, input.id), eq(projects.userId, ctx.userId)))
          .returning()
      )
    }),

  /**
   * Delete a project and all its chats
   */
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDatabase()
      return getOne(
        db
          .delete(projects)
          .where(and(eq(projects.id, input.id), eq(projects.userId, ctx.userId)))
          .returning()
      )
    }),

  /**
   * Refresh git info for a project (in case remote changed)
   */
  refreshGitInfo: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDatabase()

      // Get project
      const project = await getOne<any>(
        db
          .select()
          .from(projects)
          .where(and(eq(projects.id, input.id), eq(projects.userId, ctx.userId)))
      )

      if (!project) {
        return null
      }

      // Get fresh git info
      const gitInfo = await getGitRemoteInfo(project.path)

      // Update project
      return await getOne(
        db
          .update(projects)
          .set({
            updatedAt: new Date(),
            gitRemoteUrl: gitInfo.remoteUrl,
            gitProvider: gitInfo.provider,
            gitOwner: gitInfo.owner,
            gitRepo: gitInfo.repo,
          })
          .where(and(eq(projects.id, input.id), eq(projects.userId, ctx.userId)))
          .returning()
      )
    }),

  /**
   * Clone a GitHub repo and create a project
   */
  cloneFromGitHub: publicProcedure
    .input(z.object({ repoUrl: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { repoUrl } = input

      // Parse the URL to extract owner/repo
      let owner: string | null = null
      let repo: string | null = null

      // Match HTTPS format: https://github.com/owner/repo
      const httpsMatch = repoUrl.match(
        /https?:\/\/github\.com\/([^/]+)\/([^/]+)/,
      )
      if (httpsMatch) {
        owner = httpsMatch[1] || null
        repo = httpsMatch[2]?.replace(/\.git$/, "") || null
      }

      // Match SSH format: git@github.com:owner/repo
      const sshMatch = repoUrl.match(/git@github\.com:([^/]+)\/(.+)/)
      if (sshMatch) {
        owner = sshMatch[1] || null
        repo = sshMatch[2]?.replace(/\.git$/, "") || null
      }

      // Match short format: owner/repo
      const shortMatch = repoUrl.match(/^([^/]+)\/([^/]+)$/)
      if (shortMatch) {
        owner = shortMatch[1] || null
        repo = shortMatch[2]?.replace(/\.git$/, "") || null
      }

      if (!owner || !repo) {
        throw new Error("Invalid GitHub URL or repo format")
      }

      // Clone to ~/.21st/repos/{owner}/{repo}
      const homePath = app.getPath("home")
      const reposDir = join(homePath, ".21st", "repos", owner)
      const clonePath = join(reposDir, repo)

      // Check if already cloned
      if (existsSync(clonePath)) {
        // Project might already exist in DB
        const db = getDatabase()
        const existing = await getOne(
          db
          .select()
          .from(projects)
          .where(and(eq(projects.path, clonePath), eq(projects.userId, ctx.userId)))
        )

        if (existing) {
          trackProjectOpened({
            id: existing.id,
            hasGitRemote: !!existing.gitRemoteUrl,
          })
          return existing
        }

        // Create project for existing clone
        const gitInfo = await getGitRemoteInfo(clonePath)
        const newProject = await getOne(
          db
          .insert(projects)
          .values({
            name: repo,
            path: clonePath,
            gitRemoteUrl: gitInfo.remoteUrl,
            gitProvider: gitInfo.provider,
            gitOwner: gitInfo.owner,
            gitRepo: gitInfo.repo,
            userId: ctx.userId,
          })
          .returning()
        )

        trackProjectOpened({
          id: newProject!.id,
          hasGitRemote: !!gitInfo.remoteUrl,
        })
        return newProject
      }

      // Create repos directory
      await mkdir(reposDir, { recursive: true })

      // Clone the repo
      const cloneUrl = `https://github.com/${owner}/${repo}.git`
      await execAsync(`git clone "${cloneUrl}" "${clonePath}"`)

      // Get git info and create project
      const db = getDatabase()
      const gitInfo = await getGitRemoteInfo(clonePath)

      const newProject = await getOne(
        db
          .insert(projects)
          .values({
            name: repo,
            path: clonePath,
            gitRemoteUrl: gitInfo.remoteUrl,
            gitProvider: gitInfo.provider,
            gitOwner: gitInfo.owner,
            gitRepo: gitInfo.repo,
            userId: ctx.userId,
          })
          .returning()
      )

      trackProjectOpened({
        id: newProject!.id,
        hasGitRemote: !!gitInfo.remoteUrl,
      })

      return newProject
    }),

  /**
   * Open folder picker to locate an existing clone of a specific repo
   * Validates that the selected folder matches the expected owner/repo
   */
  locateAndAddProject: publicProcedure
    .input(
      z.object({
        expectedOwner: z.string(),
        expectedRepo: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const window = ctx.getWindow?.() ?? BrowserWindow.getFocusedWindow()

      if (!window) {
        return { success: false as const, reason: "no-window" as const }
      }

      // Ensure window is focused
      if (!window.isFocused()) {
        window.focus()
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      const result = await dialog.showOpenDialog(window, {
        properties: ["openDirectory"],
        title: `Locate ${input.expectedOwner}/${input.expectedRepo}`,
        buttonLabel: "Select",
      })

      if (result.canceled || !result.filePaths[0]) {
        return { success: false as const, reason: "canceled" as const }
      }

      const folderPath = result.filePaths[0]
      const gitInfo = await getGitRemoteInfo(folderPath)

      // Validate it's the correct repo
      if (
        gitInfo.owner !== input.expectedOwner ||
        gitInfo.repo !== input.expectedRepo
      ) {
        return {
          success: false as const,
          reason: "wrong-repo" as const,
          found:
            gitInfo.owner && gitInfo.repo
              ? `${gitInfo.owner}/${gitInfo.repo}`
              : "not a git repository",
        }
      }

      // Create or update project
      const db = getDatabase()
      const existing = await getOne(
        db
          .select()
          .from(projects)
          .where(and(eq(projects.path, folderPath), eq(projects.userId, ctx.userId)))
      )

      if (existing) {
        // Update git info in case it changed
        const updated = await getOne(
          db
            .update(projects)
            .set({
              updatedAt: new Date(),
              gitRemoteUrl: gitInfo.remoteUrl,
              gitProvider: gitInfo.provider,
              gitOwner: gitInfo.owner,
              gitRepo: gitInfo.repo,
            })
            .where(and(eq(projects.id, existing.id), eq(projects.userId, ctx.userId)))
            .returning()
        )

        return { success: true as const, project: updated }
      }

      const project = await getOne(
        db
          .insert(projects)
          .values({
            name: basename(folderPath),
            path: folderPath,
            gitRemoteUrl: gitInfo.remoteUrl,
            gitProvider: gitInfo.provider,
            gitOwner: gitInfo.owner,
            gitRepo: gitInfo.repo,
            userId: ctx.userId,
          })
          .returning()
      )

      return { success: true as const, project }
    }),

  /**
   * Open folder picker to choose where to clone a repository
   */
  pickCloneDestination: publicProcedure
    .input(z.object({ suggestedName: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const window = ctx.getWindow?.() ?? BrowserWindow.getFocusedWindow()

      if (!window) {
        return { success: false as const, reason: "no-window" as const }
      }

      // Ensure window is focused
      if (!window.isFocused()) {
        window.focus()
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      // Default to ~/.21st/repos/
      const homePath = app.getPath("home")
      const defaultPath = join(homePath, ".21st", "repos")
      await mkdir(defaultPath, { recursive: true })

      const result = await dialog.showOpenDialog(window, {
        properties: ["openDirectory", "createDirectory"],
        title: "Choose where to clone",
        defaultPath,
        buttonLabel: "Clone Here",
      })

      if (result.canceled || !result.filePaths[0]) {
        return { success: false as const, reason: "canceled" as const }
      }

      const targetPath = join(result.filePaths[0], input.suggestedName)
      return { success: true as const, targetPath }
    }),

  /**
   * Upload a custom icon for a project (opens file picker for images)
   */
  uploadIcon: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const window = ctx.getWindow?.() ?? BrowserWindow.getFocusedWindow()
      if (!window) return null

      if (!window.isFocused()) {
        window.focus()
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      const result = await dialog.showOpenDialog(window, {
        properties: ["openFile"],
        title: "Select Project Icon",
        buttonLabel: "Set Icon",
        filters: [
          { name: "Images", extensions: ["png", "jpg", "jpeg", "svg", "webp", "ico"] },
        ],
      })

      if (result.canceled || !result.filePaths[0]) return null

      const sourcePath = result.filePaths[0]
      const ext = extname(sourcePath)
      const iconsDir = join(app.getPath("userData"), "project-icons")
      await mkdir(iconsDir, { recursive: true })

      const destPath = join(iconsDir, `${input.id}${ext}`)
      await copyFile(sourcePath, destPath)

      const db = getDatabase()
      return await getOne(
        db
          .update(projects)
          .set({ iconPath: destPath, updatedAt: new Date() })
          .where(and(eq(projects.id, input.id), eq(projects.userId, ctx.userId)))
          .returning()
      )
    }),

  /**
   * Remove custom icon for a project
   */
  removeIcon: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDatabase()
      const project = await getOne<any>(db.select().from(projects).where(eq(projects.id, input.id)))

      if (project?.iconPath && existsSync(project.iconPath)) {
        try { await unlink(project.iconPath) } catch {}
      }

      return await getOne(
        db
          .update(projects)
          .set({ iconPath: null, updatedAt: new Date() })
          .where(and(eq(projects.id, input.id), eq(projects.userId, ctx.userId)))
          .returning()
      )
    }),
})
