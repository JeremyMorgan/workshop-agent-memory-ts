// STAGE 5: guardrails (enforced in code, not in the prompt).
// Flags: approvalGate, recipientAllowlist. Guards run inside tool execution; the model cannot bypass them.
import { approvalGate } from "../processors/approvalGate.js";
import { recipientAllowlist } from "../processors/recipientAllowlist.js";
import { installGuards } from "../tools/guards.js";
import type { Stage } from "./types.js";

export const stage5: Stage = {
  setup: () => installGuards([approvalGate, recipientAllowlist]),
};
