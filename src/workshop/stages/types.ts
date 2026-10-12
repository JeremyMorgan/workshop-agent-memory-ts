// What a stage contributes to the agent. agent.ts merges the enabled stages in order.
import type { Memory } from "@mastra/memory";

export type StepHook = (step: any) => unknown | Promise<unknown>;

export interface Stage {
  instructions?: string;                // appended to the system prompt
  tools?: Record<string, any>;
  inputProcessors?: any[];
  finalInputProcessors?: any[];         // run after every other processor, so they see what the others injected
  stepHooks?: StepHook[];               // run after every model step (onStepFinish)
  memory?: Memory;
  setup?: () => void;                   // one-off wiring (guards, memory policies)
}
