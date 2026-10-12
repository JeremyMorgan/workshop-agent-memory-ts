// Always on. Tells the rest of the workshop which session/turn we are in and what the user just said, and
// handles the human-typed chat commands that make every demo drivable from Mastra Studio:
//   /approve [id]          approve pending gated tool calls (stage 5)
//   /tools none|all|a,b,c  restrict which tools the model may use (stage 3-6 demos)
// Only the human can author a user message, so the model cannot issue these itself.
import { MASTRA_THREAD_ID_KEY } from "@mastra/core/request-context";
import type { Processor, ProcessInputArgs, ProcessInputStepArgs } from "@mastra/core/processors";
import { newSession, runtime } from "../runtime.js";
import { approvals } from "./approvalGate.js";
import { userTextOf } from "./util.js";

export function handleCommand(text: string): string | null {
  const t = text.trim();
  if (/^\/approve\b/.test(t)) {
    const tools = approvals.approve(t.split(/\s+/)[1]);
    return tools.length ? `approved: ${tools.join(", ")}` : "nothing was pending";
  }
  const m = t.match(/^\/tools\s+(.+)$/);
  if (m) {
    const arg = m[1].trim().toLowerCase();
    runtime.toolMode = arg === "all" ? null : arg === "none" ? "none" : arg.split(/[\s,]+/).filter(Boolean);
    return `tools: ${arg}`;
  }
  return null;
}

export class SessionTracker implements Processor {
  id = "session-tracker";
  async processInput({ messages, messageList, requestContext }: ProcessInputArgs) {
    // Studio (and any caller using memory) identifies the conversation by thread id: one thread = one session.
    // (MessageList keeps the thread id in a private field; reading it is the only way a processor can see it.)
    const thread = (requestContext?.get(MASTRA_THREAD_ID_KEY) as string | undefined) ?? (messageList as any).memoryInfo?.threadId;
    if (thread && thread !== runtime.sessionId) newSession(thread);

    const input = messageList.get.input.db().filter((m) => m.role === "user");
    const latest = input[input.length - 1] ?? [...messages].reverse().find((m) => m.role === "user");
    runtime.turn += 1;
    runtime.userText = latest ? userTextOf(latest) : "";
    runtime.userMessageId = latest?.id ?? null;
    runtime.injected = [];
    runtime.injectedRuleKeys = [];
    runtime.systemMeta = {};

    const ack = handleCommand(runtime.userText);
    if (ack && latest) {
      // Keep the model cheap and quiet for harness commands.
      for (const part of (latest.content?.parts ?? []) as any[]) {
        if (part.type === "text") part.text = `(harness command executed: ${ack}) Reply with one short sentence confirming.`;
      }
      runtime.userText = "";
    }
    return messageList;
  }
}

/** Applies `/tools` to every step. */
export class ToolMode implements Processor {
  id = "tool-mode";
  async processInputStep(_args: ProcessInputStepArgs) {
    const mode = runtime.toolMode;
    if (!mode) return;
    return mode === "none" ? { toolChoice: "none" as const } : { activeTools: mode };
  }
}
