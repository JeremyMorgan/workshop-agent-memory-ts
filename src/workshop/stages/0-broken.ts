// STAGE 0: the broken agent. Tools and generic instructions. NO memory object, so every call starts from a blank context.
// The "never delete" rule is deliberately NOT here: the user states it in conversation.
import { baseTools } from "../tools/index.js";
import { SessionTracker, ToolMode } from "../processors/sessionTracker.js";
import type { Stage } from "./types.js";

export const stage0: Stage = {
  instructions: `You are a personal assistant with access to the user's email, calendar and ticket tracker.
Use your tools to look things up and to take actions when asked. Be concise.
Today is Monday 2025-06-09.`,
  tools: { ...baseTools },
  // always on: tracks the turn and the user's words, handles /approve and /tools
  inputProcessors: [new SessionTracker(), new ToolMode()],
};
