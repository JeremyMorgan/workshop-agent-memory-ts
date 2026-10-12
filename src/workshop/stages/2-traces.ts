// STAGE 2: context traces.
// Flag: traces. Records which messages were in the context window at every step, and the tool called.
import { ContextRecorder, recordStep } from "../hooks/recordTrace.js";
import type { Stage } from "./types.js";

export const stage2: Stage = {
  stepHooks: [recordStep],
  finalInputProcessors: [new ContextRecorder()],
};
