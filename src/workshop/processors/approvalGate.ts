// STAGE 5: a tool gate that requires user approval when a Rule node says so.
// Approval is granted by the human through the harness (`/approve` in the REPL), never by the model.
import { config } from "../../../workshop.config.js";
import { listRules, type RuleRow } from "../graph/store.js";
import type { Guard, GuardBlock } from "../tools/guards.js";

export interface PendingApproval { id: string; tool: string; args: unknown }

/** Process-local approval state. Lives outside the model's reach. */
export const approvals = {
  pending: [] as PendingApproval[],
  granted: new Set<string>(), // tool names the user has approved for this session
  seq: 0,
  reset() { this.pending = []; this.granted = new Set(); this.seq = 0; },
  /** Approve everything currently pending (or one id). Returns the approved tool names. */
  approve(id?: string): string[] {
    const toApprove = id ? this.pending.filter((p) => p.id === id) : this.pending;
    for (const p of toApprove) this.granted.add(p.tool);
    this.pending = this.pending.filter((p) => !toApprove.includes(p));
    return [...new Set(toApprove.map((p) => p.tool))];
  },
};

export function checkApproval(tool: string, args: unknown, rules: Pick<RuleRow, "tool" | "mode">[], state = approvals): GuardBlock | null {
  const forbidden = rules.find((r) => r.tool === tool && r.mode === "forbid");
  if (forbidden) {
    return { status: "blocked", gate: "forbid", tool, message: `The user has a standing rule that ${tool} must never be used. The call was NOT executed.` };
  }
  const rule = rules.find((r) => r.tool === tool && r.mode === "require_approval");
  if (!rule || state.granted.has(tool)) return null;
  // one pending approval per tool: approving it covers the batch the agent was attempting
  const existing = state.pending.find((p) => p.tool === tool);
  const id = existing?.id ?? `ap-${++state.seq}`;
  if (!existing) state.pending.push({ id, tool, args });
  return {
    status: "approval_required",
    gate: "approval",
    tool,
    approval_id: id,
    message: `The user has a standing rule that ${tool} requires their approval. The call was NOT executed. Tell the user what you want to do and ask them to approve; do not retry until they have.`,
  };
}

export const approvalGate: Guard = async ({ tool, args }) => {
  if (!config.approvalGate) return null;
  return checkApproval(tool, args, await listRules());
};
