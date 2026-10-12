// ─────────────────────────────────────────────────────────────────────────────
// THE agent. Each workshop stage is one line in `stages` below.
//
// Comment a line out to remove that stage, uncomment it to add it back. Stage 0 is the baseline.
// All stages are listed by default so the scenarios and `npm run step` presets work; the flags decide what is active.
// Each stage also has a flag in workshop.config.ts; a stage must be listed here AND have its flag on.
// The stage code lives in src/workshop/stages/.
// ─────────────────────────────────────────────────────────────────────────────
import { Agent } from "@mastra/core/agent";
import { MODEL } from "./workshop/env.js";
import { makeRunTurn } from "./workshop/turn.js";
import * as s from "./workshop/stages/index.js";

// ── YOUR TOOLS ───────────────────────────────────────────────────────────────
// Add your own tools and MCP server tools here (examples in the README). They are added to the agent
// and to Mastra Studio. They bypass the audit log and the mode switch; stage 5 guards only cover the built-in tools.
export const customTools: Record<string, any> = {
  // yourTool,
  // ...mcpTools,
};
const yours: s.Stage = { tools: customTools };

const stages: s.Stage[] = [
  s.stage0, //   broken agent: no memory. Built-in tools: list_emails, read_email, delete_email, send_message,
            //   get_events, update_event, list_issues, get_issue, update_issue
  s.stage1, //   short-term memory (message history window)
  s.stage2, //   context traces
  s.stage3, //   long-term memory + pinned rules
  s.stage4, //   graph / semantic retrieval
  s.stage5, //   guardrails (approval gate, recipient allowlist)
  s.stage6, //   provenance + trust filter
  yours,    //   your own tools and MCP servers (see above)
];

// Boilerplate to combine settings from each stage, no need to modify this part.
for (const stage of stages) stage.setup?.();
const { instructions, tools, inputProcessors, stepHooks, memory } = s.composeStages(stages);

// Your working agent definition
export const agent = new Agent({
  id: "workshop-agent",
  name: "Workshop Agent",
  description: "A personal assistant for email, calendar and tickets, used to teach context engineering.",
  instructions,
  model: MODEL as any,
  tools,
  memory,
  inputProcessors,
  // Stage hooks must run for every caller (REPL, scenarios and Mastra Studio), so they live in the agent defaults.
  defaultOptions: {
    onStepFinish: async (step: any) => {
      for (const hook of stepHooks) await hook(step);
    },
  } as any,
});

// Export for cli commands, you can ignore this
export const runTurn = makeRunTurn(agent, { memory, stepHooks });
