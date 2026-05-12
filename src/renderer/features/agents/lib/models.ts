export const CLAUDE_MODELS = []

export type CodexThinkingLevel = "low" | "medium" | "high" | "xhigh"

export const CODEX_MODELS = [
  {
    id: "gpt-5.2/medium",
    name: "GPT-4o",
    thinkings: [] as CodexThinkingLevel[],
  },
  {
    id: "gpt-5.1-codex-max/medium",
    name: "o1",
    thinkings: [] as CodexThinkingLevel[],
  },
  {
    id: "gpt-5.1-codex-mini/medium",
    name: "o3-mini",
    thinkings: [] as CodexThinkingLevel[],
  },
  {
    id: "gpt-5.1-codex-mini/low",
    name: "GPT-4o Mini",
    thinkings: [] as CodexThinkingLevel[],
  },
  {
    id: "gpt-5.2/low",
    name: "GPT-4 Turbo",
    thinkings: [] as CodexThinkingLevel[],
  },
]

export function formatCodexThinkingLabel(thinking: CodexThinkingLevel): string {
  if (!thinking || typeof thinking !== "string") return ""
  if (thinking === "xhigh") return "Extra High"
  return thinking.charAt(0).toUpperCase() + thinking.slice(1)
}
