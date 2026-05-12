import type { BuiltinCommandAction, SlashCommandOption } from "./types"

/**
 * Prompt texts for prompt-based slash commands
 */
export const COMMAND_PROMPTS: Partial<
  Record<BuiltinCommandAction["type"], string>
> = {
  review:
    "Please review the code in the current context and provide feedback on code quality, potential bugs, and improvements.",
  "pr-comments":
    "Generate detailed PR review comments for the changes in the current context.",
  "release-notes":
    "Generate release notes summarizing the changes in this codebase.",
  "security-review":
    "Perform a security audit of the code in the current context. Identify vulnerabilities, security risks, and suggest fixes.",
  commit:
    "Ð—Ð°ÐºÐ¾Ð¼Ð¼Ð¸Ñ‚ÑŒ ÑÑ‚Ð¾ Ð°ÐºÐºÑƒÑ€Ð°Ñ‚Ð½Ð¾, Ð½Ðµ Ñ‚Ñ€Ð¾Ð³Ð°Ñ Ð±Ð¾Ð»ÑŒÑˆÐµ Ð½Ð¸Ñ‡ÐµÐ³Ð¾. Ð¡Ð´ÐµÐ»Ð°Ð¹ ÐºÐ¾Ð¼Ð¼Ð¸Ñ‚ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð´Ð»Ñ staged Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ð¹, Ð½Ðµ Ð´Ð¾Ð±Ð°Ð²Ð»ÑÐ¹ Ð½Ð¸ÐºÐ°ÐºÐ¸Ðµ Ð´Ñ€ÑƒÐ³Ð¸Ðµ Ñ„Ð°Ð¹Ð»Ñ‹ Ð¸ Ð½Ðµ Ð²Ð½Ð¾ÑÐ¸ Ð´Ð¾Ð¿Ð¾Ð»Ð½Ð¸Ñ‚ÐµÐ»ÑŒÐ½Ñ‹Ñ… Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ð¹.",
  "worktree-setup": `Create a worktree setup script for this project.

Your task:
1. Analyze the project to understand what's needed to set up a working copy
2. Create the file .Falbor/worktree.json with setup commands

The goal is to reproduce the EXACT same working state as the original repo in the new worktree.

Rules:
- Use only "setup-worktree" key (works on all platforms)
- Install dependencies using the project's package manager (check for bun.lockb, pnpm-lock.yaml, yarn.lock, package-lock.json)
- Copy ALL real env files that exist (.env, .env.local, .env.development, etc) - NOT example files
- Use $ROOT_WORKTREE_PATH to reference the main repo path
- Don't include build steps unless absolutely necessary for the project to work

Example output for .Falbor/worktree.json:
{
  "setup-worktree": [
    "bun install",
    "cp $ROOT_WORKTREE_PATH/.env .env",
    "cp $ROOT_WORKTREE_PATH/.env.local .env.local"
  ]
}

Now analyze this project and create .Falbor/worktree.json with the appropriate setup commands.`,
}

/**
 * Check if a command is a prompt-based command
 */
export function isPromptCommand(
  type: BuiltinCommandAction["type"],
): type is "review" | "pr-comments" | "release-notes" | "security-review" | "commit" | "worktree-setup" {
  return type in COMMAND_PROMPTS
}

/**
 * Built-in slash commands that are handled client-side
 */
export const BUILTIN_SLASH_COMMANDS: SlashCommandOption[] = [
  {
    id: "builtin:clear",
    name: "clear",
    command: "/clear",
    description: "Start a new conversation (creates new sub-chat)",
    category: "builtin",
  },
  {
    id: "builtin:plan",
    name: "plan",
    command: "/plan",
    description: "Switch to Plan mode (creates plan before making changes)",
    category: "builtin",
  },
  {
    id: "builtin:agent",
    name: "agent",
    command: "/agent",
    description: "Switch to Agent mode (applies changes directly)",
    category: "builtin",
  },
  {
    id: "builtin:compact",
    name: "compact",
    command: "/compact",
    description: "Compact conversation context to reduce token usage",
    category: "builtin",
  },
  // Prompt-based commands
  {
    id: "builtin:review",
    name: "review",
    command: "/review",
    description: "Ask agent to review your code",
    category: "builtin",
  },
  {
    id: "builtin:pr-comments",
    name: "pr-comments",
    command: "/pr-comments",
    description: "Ask agent to generate PR review comments",
    category: "builtin",
  },
  {
    id: "builtin:release-notes",
    name: "release-notes",
    command: "/release-notes",
    description: "Ask agent to generate release notes",
    category: "builtin",
  },
  {
    id: "builtin:security-review",
    name: "security-review",
    command: "/security-review",
    description: "Ask agent to perform a security audit",
    category: "builtin",
  },
  {
    id: "builtin:commit",
    name: "commit",
    command: "/commit",
    description: "Commit staged changes carefully without touching anything else",
    category: "builtin",
  },
  {
    id: "builtin:worktree-setup",
    name: "worktree-setup",
    command: "/worktree-setup",
    description: "Generate worktree setup config with AI",
    category: "builtin",
  },
]

/**
 * Filter builtin commands by search text
 */
export function filterBuiltinCommands(
  searchText: string,
): SlashCommandOption[] {
  if (!searchText) return BUILTIN_SLASH_COMMANDS

  const query = searchText.toLowerCase()
  return BUILTIN_SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(query) ||
      cmd.description.toLowerCase().includes(query),
  )
}

