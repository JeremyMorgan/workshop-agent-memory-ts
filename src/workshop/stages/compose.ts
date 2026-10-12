// Merges the enabled stages into the pieces the Agent needs. Does not call `setup`; agent.ts does that.
import type { Stage } from "./types.js";

export function composeStages(stages: Stage[]) {
  return {
    instructions: stages.map((x) => x.instructions ?? "").join(""),
    tools: Object.assign({}, ...stages.map((x) => x.tools ?? {})) as Record<string, any>,
    stepHooks: stages.flatMap((x) => x.stepHooks ?? []),
    memory: stages.map((x) => x.memory).find(Boolean),
    // "final" processors (the trace recorder) go last so they see everything the others injected
    inputProcessors: [...stages.flatMap((x) => x.inputProcessors ?? []), ...stages.flatMap((x) => x.finalInputProcessors ?? [])],
  };
}
