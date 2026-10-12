// STAGE 3: inject every Rule node from the graph into the context at every step.
// The rule no longer lives in the (windowed) conversation; it lives in the graph and is pinned each step.
import type { Processor, ProcessInputStepArgs } from "@mastra/core/processors";
import { config } from "../../../workshop.config.js";
import { listRules, type RuleRow } from "../graph/store.js";
import { runtime } from "../runtime.js";

export const TAG = "pinned-rules";

export function renderRules(rules: RuleRow[]): string {
  const lines = rules.map((r) =>
    r.mode === "require_approval"
      ? `- Before calling ${r.tool} you must ask the user and receive explicit approval. Without approval, only suggest what you would do.${r.text ? ` (the user said: "${r.text}")` : ""}`
      : `- Never call ${r.tool}.${r.text ? ` (the user said: "${r.text}")` : ""}`,
  );
  return `STANDING RULES from the user (pinned; they apply at every step, whatever else is in the conversation):\n${lines.join("\n")}`;
}

export class PinnedRules implements Processor {
  id = "pinned-rules";
  async processInputStep({ messageList }: ProcessInputStepArgs) {
    if (!config.pinnedRules) return;
    const rules = await listRules();
    messageList.clearSystemMessages(TAG);
    if (!rules.length) return;
    const text = renderRules(rules);
    messageList.addSystem(text, TAG);
    runtime.injectedRuleKeys = rules.map((r) => r.key);
    runtime.systemMeta[TAG] = { rules: rules.map((r) => r.key) };
    if (!runtime.injected.includes(text)) runtime.injected.push(text);
    return;
  }
}
