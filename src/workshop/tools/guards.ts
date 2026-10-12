// STAGE 5: guards run INSIDE tool execution, in code. The model cannot talk its way past them.
export interface GuardBlock {
  status: "approval_required" | "blocked";
  gate: string;
  tool: string;
  message: string;
  [k: string]: unknown;
}
export type Guard = (call: { tool: string; args: any }) => Promise<GuardBlock | null> | GuardBlock | null;

const installed = new Set<Guard>();
export const installGuards = (guards: Guard[]) => guards.forEach((g) => installed.add(g));
export const clearGuards = () => installed.clear();

export async function runGuards(call: { tool: string; args: any }): Promise<GuardBlock | null> {
  for (const g of installed) {
    try {
      const block = await g(call);
      if (block) return block;
    } catch (err) {
      // Fail closed: a guard that cannot decide must not let the call through.
      return { status: "blocked", gate: "guard_error", tool: call.tool, message: `Guard failed (${err instanceof Error ? err.message : err}); call refused.` };
    }
  }
  return null;
}
