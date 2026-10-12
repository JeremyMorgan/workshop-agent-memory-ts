// One user turn against the agent: per-session memory thread, per-call options and the stage hooks.
import type { Agent } from "@mastra/core/agent";
import type { Memory } from "@mastra/memory";
import { config } from "../../workshop.config.js";
import { runtime } from "./runtime.js";
import type { StepHook } from "./stages/types.js";

export interface TurnOptions {
  /** Called after every model step (before the stage hooks), e.g. to print the step in the REPL. */
  onStep?: (step: any) => void | Promise<void>;
  /** Restrict which tools the model may call this turn. */
  activeTools?: string[];
  /** 'none' answers from context only (used to test retrieval, not tool exploration). */
  toolChoice?: "auto" | "none";
}

export function makeRunTurn(agent: Agent, { memory, stepHooks }: { memory?: Memory; stepHooks: StepHook[] }) {
  return (prompt: string, opts: TurnOptions = {}) =>
    agent.generate(prompt, {
      maxSteps: config.maxSteps,
      ...(memory ? { memory: { thread: runtime.sessionId, resource: "workshop-user" } } : {}),
      ...(opts.activeTools ? { activeTools: opts.activeTools } : {}),
      ...(opts.toolChoice ? { toolChoice: opts.toolChoice } : {}),
      // Does a per-call onStepFinish replace the default? Verified by the stage 2 scenario still recording steps.
      onStepFinish: async (step: any) => {
        await opts.onStep?.(step);
        for (const hook of stepHooks) await hook(step);
      },
    } as any);
}
