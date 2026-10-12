import type { MastraDBMessage } from "@mastra/core/memory";

/** Plain text of a message, including a one-line rendering of tool calls. */
export function messageText(m: MastraDBMessage, maxLen = 400): string {
  const out: string[] = [];
  for (const part of (m.content?.parts ?? []) as any[]) {
    if (part.type === "text" && typeof part.text === "string") out.push(part.text);
    else if (part.type === "tool-invocation") {
      const t = part.toolInvocation ?? {};
      out.push(`[tool ${t.toolName}(${JSON.stringify(t.args ?? {})})${t.state === "result" ? " -> result" : ""}]`);
    }
  }
  if (!out.length && typeof m.content?.content === "string") out.push(m.content.content);
  const text = out.join(" ").replace(/\s+/g, " ").trim();
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

export const userTextOf = (m: MastraDBMessage) =>
  ((m.content?.parts ?? []) as any[]).filter((p) => p.type === "text").map((p) => p.text).join("\n") || (typeof m.content?.content === "string" ? m.content.content : "");
