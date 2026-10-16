// STAGE 3: long-term memory + pinned rules.
// Flags: extractUserStatements, mapToolResults, pinnedRules, onboarding.
import { config } from "../../../workshop.config.js";
import { ExtractUserStatements } from "../hooks/extractUserStatements.js";
import { mapToolResult, applyDelta } from "../hooks/mapToolResults.js";
import { PinnedRules } from "../processors/pinnedRules.js";
import { AboutUser } from "../processors/aboutUser.js";
import { loadSeed } from "../nsuite/state.js";
import { memoryTools } from "../tools/index.js";
import type { Stage } from "./types.js";

const hasMemoryTools = config.extractUserStatements || config.mapToolResults || config.pinnedRules || config.retrieval !== "none";

export const stage3: Stage = {
  // remember_fact, query_memory
  tools: hasMemoryTools ? { ...memoryTools } : {},
  instructions: hasMemoryTools
    ? `\nYou also have long-term memory tools: query_memory looks up saved facts, standing rules and known events/tickets; remember_fact saves a fact for future sessions.`
    : "",
  inputProcessors: [new ExtractUserStatements(), new PinnedRules(), new AboutUser()],
  stepHooks: [
    async (step) => {
      if (!config.mapToolResults) return;
      const world = loadSeed(); // people, customers and projects: the dictionaries the mapper matches against
      for (const r of step.toolResults ?? []) {
        const p = r.payload ?? r;
        await applyDelta(mapToolResult(p.toolName, p.result, world.people, world));
      }
    },
  ],
};
