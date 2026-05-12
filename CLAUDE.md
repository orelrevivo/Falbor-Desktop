<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this?

**21st Agents** - A local-first Electron desktop app for AI-powered code assistance. Users create chat sessions linked to local project folders, interact with Claude in Plan or Agent mode, and see real-time tool execution (bash, file edits, web search, etc.).

## Commands

```bash
# Development
bun run dev              # Start Electron with hot reload

# Build
bun run build            # Compile app
bun run package          # Package for current platform (dir)
bun run package:mac      # Build macOS (DMG + ZIP)
bun run package:win      # Build Windows (NSIS + portable)
bun run package:linux    # Build Linux (AppImage + DEB)

# Database (Drizzle + SQLite)
bun run db:generate      # Generate migrations from schema
bun run db:push          # Push schema directly (dev only)
```

## Architecture

```
src/
â”œâ”€â”€ main/                    # Electron main process
â”‚   â”œâ”€â”€ index.ts             # App entry, window lifecycle
â”‚   â”œâ”€â”€ auth-manager.ts      # OAuth flow, token refresh
â”‚   â”œâ”€â”€ auth-store.ts        # Encrypted credential storage (safeStorage)
â”‚   â”œâ”€â”€ windows/main.ts      # Window creation, IPC handlers
â”‚   â””â”€â”€ lib/
â”‚       â”œâ”€â”€ db/              # Drizzle + SQLite
â”‚       â”‚   â”œâ”€â”€ index.ts     # DB init, auto-migrate on startup
â”‚       â”‚   â”œâ”€â”€ schema/      # Drizzle table definitions
â”‚       â”‚   â””â”€â”€ utils.ts     # ID generation
â”‚       â””â”€â”€ trpc/routers/    # tRPC routers (projects, chats, claude)
â”‚
â”œâ”€â”€ preload/                 # IPC bridge (context isolation)
â”‚   â””â”€â”€ index.ts             # Exposes desktopApi + tRPC bridge
â”‚
â””â”€â”€ renderer/                # React 19 UI
    â”œâ”€â”€ App.tsx              # Root with providers
    â”œâ”€â”€ features/
    â”‚   â”œâ”€â”€ agents/          # Main chat interface
    â”‚   â”‚   â”œâ”€â”€ main/        # active-chat.tsx, new-chat-form.tsx
    â”‚   â”‚   â”œâ”€â”€ ui/          # Tool renderers, preview, diff view
    â”‚   â”‚   â”œâ”€â”€ commands/    # Slash commands (/plan, /agent, /clear)
    â”‚   â”‚   â”œâ”€â”€ atoms/       # Jotai atoms for agent state
    â”‚   â”‚   â””â”€â”€ stores/      # Zustand store for sub-chats
    â”‚   â”œâ”€â”€ sidebar/         # Chat list, archive, navigation
    â”‚   â”œâ”€â”€ sub-chats/       # Tab/sidebar sub-chat management
    â”‚   â””â”€â”€ layout/          # Main layout with resizable panels
    â”œâ”€â”€ components/ui/       # Radix UI wrappers (button, dialog, etc.)
    â””â”€â”€ lib/
        â”œâ”€â”€ atoms/           # Global Jotai atoms
        â”œâ”€â”€ stores/          # Global Zustand stores
        â”œâ”€â”€ trpc.ts          # Real tRPC client
        â””â”€â”€ mock-api.ts      # DEPRECATED - being replaced with real tRPC
```

## Database (Drizzle ORM)

**Location:** `{userData}/data/agents.db` (SQLite)

**Schema:** `src/main/lib/db/schema/index.ts`

```typescript
// Three main tables:
projects    â†’ id, name, path (local folder), timestamps
chats       â†’ id, name, projectId, worktree fields, timestamps
sub_chats   â†’ id, name, chatId, sessionId, mode, messages (JSON)
```

**Auto-migration:** On app start, `initDatabase()` runs migrations from `drizzle/` folder (dev) or `resources/migrations` (packaged).

**Queries:**
```typescript
import { getDatabase, projects, chats } from "../lib/db"
import { eq } from "drizzle-orm"

const db = getDatabase()
const allProjects = db.select().from(projects).all()
const projectChats = db.select().from(chats).where(eq(chats.projectId, id)).all()
```

## Key Patterns

### IPC Communication
- Uses **tRPC** with `trpc-electron` for type-safe mainâ†”renderer communication
- All backend calls go through tRPC routers, not raw IPC
- Preload exposes `window.desktopApi` for native features (window controls, clipboard, notifications)

### State Management
- **Jotai**: UI state (selected chat, sidebar open, preview settings)
- **Zustand**: Sub-chat tabs and pinned state (persisted to localStorage)
- **React Query**: Server state via tRPC (auto-caching, refetch)

### Claude Integration
- Dynamic import of `@anthropic-ai/claude-code` SDK
- Two modes: "plan" (read-only) and "agent" (full permissions)
- Session resume via `sessionId` stored in SubChat
- Message streaming via tRPC subscription (`claude.onMessage`)

## Tech Stack

| Layer | Tech |
|-------|------|
| Desktop | Electron 33.4.5, electron-vite, electron-builder |
| UI | React 19, TypeScript 5.4.5, Tailwind CSS |
| Components | Radix UI, Lucide icons, Motion, Sonner |
| State | Jotai, Zustand, React Query |
| Backend | tRPC, Drizzle ORM, better-sqlite3 |
| AI | @anthropic-ai/claude-code |
| Package Manager | bun |

## File Naming

- Components: PascalCase (`ActiveChat.tsx`, `AgentsSidebar.tsx`)
- Utilities/hooks: camelCase (`useFileUpload.ts`, `formatters.ts`)
- Stores: kebab-case (`sub-chat-store.ts`, `agent-chat-store.ts`)
- Atoms: camelCase with `Atom` suffix (`selectedAgentChatIdAtom`)

## Important Files

- `electron.vite.config.ts` - Build config (main/preload/renderer entries)
- `src/main/lib/db/schema/index.ts` - Drizzle schema (source of truth)
- `src/main/lib/db/index.ts` - DB initialization + auto-migrate
- `src/renderer/features/agents/atoms/index.ts` - Agent UI state atoms
- `src/renderer/features/agents/main/active-chat.tsx` - Main chat component
- `src/main/lib/trpc/routers/claude.ts` - Claude SDK integration

## Debugging First Install Issues

When testing auth flows or behavior for new users, you need to simulate a fresh install:

```bash
# 1. Clear all app data (auth, database, settings)
rm -rf ~/Library/Application\ Support/Agents\ Dev/

# 2. Reset macOS protocol handler registration (if testing deep links)
/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -kill -r -domain local -domain system -domain user

# 3. Clear app preferences
defaults delete dev.21st.agents.dev  # Dev mode
defaults delete dev.21st.agents      # Production

# 4. Run in dev mode with clean state
cd apps/desktop
bun run dev
```

**Common First-Install Bugs:**
- **OAuth deep link not working**: macOS Launch Services may not immediately recognize protocol handlers on first app launch. User may need to click "Sign in" again after the first attempt.
- **Folder dialog not appearing**: Window focus timing issues on first launch. Fixed by ensuring window focus before showing `dialog.showOpenDialog()`.

**Dev vs Production App:**
- Dev mode uses `twentyfirst-agents-dev://` protocol
- Dev mode uses separate userData path (`~/Library/Application Support/Agents Dev/`)
- This prevents conflicts between dev and production installs

## Releasing a New Version

### Prerequisites for Notarization

- Keychain profile: `21st-notarize`
- Create with: `xcrun notarytool store-credentials "21st-notarize" --apple-id YOUR_APPLE_ID --team-id YOUR_TEAM_ID`

### Release Commands

```bash
# Full release (build, sign, submit notarization, upload to CDN)
bun run release

# Or step by step:
bun run build              # Compile TypeScript
bun run package:mac        # Build & sign macOS app
bun run dist:manifest      # Generate latest-mac.yml manifests
./scripts/upload-release-wrangler.sh  # Submit notarization & upload to R2 CDN
```

### Bump Version Before Release

```bash
npm version patch --no-git-tag-version  # 0.0.27 â†’ 0.0.28
```

### After Release Script Completes

1. Wait for notarization (2-5 min): `xcrun notarytool history --keychain-profile "21st-notarize"`
2. Staple DMGs: `cd release && xcrun stapler staple *.dmg`
3. Re-upload stapled DMGs to R2 and GitHub (see RELEASE.md for commands)
4. Update changelog: `gh release edit v0.0.X --notes "..."`
5. **Upload manifests (triggers auto-updates!)** â€” see RELEASE.md
6. Sync to public: `./scripts/sync-to-public.sh`

### Files Uploaded to CDN

| File | Purpose |
|------|---------|
| `latest-mac.yml` | Manifest for arm64 auto-updates |
| `latest-mac-x64.yml` | Manifest for Intel auto-updates |
| `Falbor-{version}-arm64-mac.zip` | Auto-update payload (arm64) |
| `Falbor-{version}-mac.zip` | Auto-update payload (Intel) |
| `Falbor-{version}-arm64.dmg` | Manual download (arm64) |
| `Falbor-{version}.dmg` | Manual download (Intel) |

### Auto-Update Flow

1. App checks `https://cdn.21st.dev/releases/desktop/latest-mac.yml` on startup and when window regains focus (with 1 min cooldown)
2. If version in manifest > current version, shows "Update Available" banner
3. User clicks Download â†’ downloads ZIP in background
4. User clicks "Restart Now" â†’ installs update and restarts

## Current Status (WIP)

**Done:**
- Drizzle ORM setup with schema (projects, chats, sub_chats)
- Auto-migration on app startup
- tRPC routers structure

**In Progress:**
- Replacing `mock-api.ts` with real tRPC calls in renderer
- ProjectSelector component (local folder picker)

**Planned:**
- Git worktree per chat (isolation)
- Claude Code execution in worktree path
- Full feature parity with web app

## Debug Mode

When debugging runtime issues in the renderer or main process, use the structured debug logging system. This avoids asking the user to manually copy-paste console output.

**Start the server:**
```bash
bun packages/debug/src/server.ts &
```

**Instrument renderer code** (no import needed, fails silently):
```js
fetch('http://localhost:7799/log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tag:'TAG',msg:'MESSAGE',data:{},ts:Date.now()})}).catch(()=>{});
```

**Read logs:** Read `.debug/logs.ndjson` - each line is a JSON object with `tag`, `msg`, `data`, `ts`.

**Clear logs:** `curl -X DELETE http://localhost:7799/logs`

**Workflow:** Hypothesize â†’ instrument â†’ user reproduces â†’ read logs â†’ fix with evidence â†’ verify â†’ remove instrumentation.

See `packages/debug/INSTRUCTIONS.md` for the full protocol.

