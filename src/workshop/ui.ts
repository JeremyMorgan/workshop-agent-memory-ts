// Console output shared by the REPL and the scenarios. All scenario output goes through out() so it can be recorded.
let sink: (line: string) => void = (l) => console.log(l);
export const setSink = (f: (line: string) => void) => { sink = f; };
export const out = (line = "") => sink(line);

const clip = (s: string, n = 110) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** One-line summary of a tool result, so the room can follow the loop. */
export function summarize(tool: string, result: any): string {
  if (result == null) return "";
  if (result.status === "approval_required") return `🛑 APPROVAL REQUIRED (${result.approval_id}), not executed`;
  if (result.status === "blocked") return `🛑 BLOCKED by ${result.gate}: ${clip(result.message ?? "", 80)}`;
  if (result.error) return `error: ${clip(String(result.error))}`;
  switch (tool) {
    case "list_emails": return `${result.count} emails`;
    case "read_email": return `${result.sender}: "${result.subject}"`;
    case "delete_email": return result.deleted ? `deleted (remaining ${result.remaining})` : "nothing deleted";
    case "send_message": return `sent to ${result.to}`;
    case "get_events": return `${result.events?.length ?? 0} events: ${(result.events ?? []).map((e: any) => e.title).join(", ")}`;
    case "list_issues": return `${result.issues?.length ?? 0} issues`;
    case "get_issue": return `${result.id} "${result.title}" owner ${result.owner}${result.blocked_by?.length ? ` blocked_by ${result.blocked_by.join(",")}` : ""}`;
    case "remember_fact": return `remembered${result.source ? ` [${result.source}/${result.trust}]` : ""}: ${clip(result.text ?? "", 70)}`;
    case "query_memory": return `${result.rules?.length ?? 0} rules, ${result.facts?.length ?? 0} facts, ${(result.events?.length ?? 0) + (result.issues?.length ?? 0)} entities${result.notice ? " (some withheld)" : ""}`;
    default: return clip(JSON.stringify(result));
  }
}

/** Print each tool call of a model step. Use as TurnOptions.onStep. */
export async function printStep(step: any) {
  const calls: any[] = step.toolCalls ?? [];
  const results: any[] = step.toolResults ?? [];
  for (const c of calls) {
    const p = c.payload ?? c;
    const r = results.find((x) => (x.payload ?? x).toolCallId === p.toolCallId);
    const res = r ? (r.payload ?? r).result : undefined;
    out(`  ⚙ ${p.toolName}(${clip(JSON.stringify(p.args ?? {}), 70)}) → ${summarize(p.toolName, res)}`);
  }
}
