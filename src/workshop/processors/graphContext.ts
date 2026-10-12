// STAGE 4: graph retrieval. Link entities named in the question to nodes, then FOLLOW relationships
// (Event -> Issue -> blocking Issue -> owner). Flat recall finds similar text; the graph follows the structure.
import type { Processor, ProcessInputStepArgs } from "@mastra/core/processors";
import { config } from "../../../workshop.config.js";
import { run } from "../graph/driver.js";
import { runtime, type SystemMeta } from "../runtime.js";

export const TAG = "graph-context";

/** Pure rendering of retrieved paths. Exported for tests. */
export function renderGraphContext(rows: {
  event?: any; issue?: any; blocker?: any; blockerOwner?: string | null; issueOwner?: string | null;
}[]): string {
  if (!rows.length) return "";
  const seen = new Set<string>();
  const lines: string[] = [];
  const add = (l: string) => { if (!seen.has(l)) { seen.add(l); lines.push(l); } };
  for (const r of rows) {
    if (r.event) add(`- Event "${r.event.title}" (${r.event.day} ${r.event.date} ${r.event.time}), attendees: ${(r.event.attendees ?? []).join(", ") || "none"}. About: ${(r.event.tickets ?? []).join(", ") || "n/a"}.`);
    if (r.issue) add(`- ${r.issue.id} "${r.issue.title}": owner ${r.issueOwner ?? "unknown"}, status ${r.issue.status ?? "unknown"}${r.issue.eta ? `, ETA ${r.issue.eta}` : ""}.`);
    if (r.issue && r.blocker) add(`- ${r.issue.id} is BLOCKED BY ${r.blocker.id} "${r.blocker.title ?? ""}": owner ${r.blockerOwner ?? "unknown"}, status ${r.blocker.status ?? "unknown"}${r.blocker.eta ? `, ETA ${r.blocker.eta}` : ""}.`);
  }
  return `GRAPH CONTEXT (entities in the question, plus the relationships around them):\n${lines.join("\n")}`;
}

export async function graphRetrieve(question: string): Promise<{ text: string; retrieved: NonNullable<SystemMeta["retrieved"]> }> {
  const rows = await run(
    `// 1) link the question to Event nodes (by title or day) and Issue nodes (by id)
     CALL () {
       MATCH (e:Event)
       WHERE toLower($q) CONTAINS toLower(e.title)
          OR (e.day IS NOT NULL AND toLower($q) CONTAINS toLower(e.day))
       OPTIONAL MATCH (e)-[:ATTENDED_BY]->(p:Person)
       OPTIONAL MATCH (e)-[:ABOUT]->(i:Issue)
       WITH e, collect(DISTINCT p.name) AS attendees, collect(DISTINCT i) AS issues
       UNWIND CASE WHEN size(issues) = 0 THEN [null] ELSE issues END AS issue
       RETURN e{.*, attendees: attendees, tickets: [x IN issues | x.id]} AS event, issue
       UNION
       MATCH (issue:Issue) WHERE toLower($q) CONTAINS toLower(issue.id)
       RETURN null AS event, issue
     }
     // 2) walk the relationships around each linked Issue
     OPTIONAL MATCH (issue)-[:OWNED_BY]->(io:Person)
     OPTIONAL MATCH (issue)-[:BLOCKED_BY]->(blocker:Issue)
     OPTIONAL MATCH (blocker)-[:OWNED_BY]->(bo:Person)
     RETURN event, issue{.*} AS issue, io.name AS issueOwner, blocker{.*} AS blocker, bo.name AS blockerOwner`,
    { q: question },
  );
  const retrieved: NonNullable<SystemMeta["retrieved"]> = [];
  const seen = new Set<string>();
  const add = (label: "Event" | "Issue" | "Person", id?: string | null) => {
    if (id && !seen.has(`${label}:${id}`)) { seen.add(`${label}:${id}`); retrieved.push({ label, id }); }
  };
  for (const r of rows as any[]) {
    add("Event", r.event?.id); add("Issue", r.issue?.id); add("Issue", r.blocker?.id);
    add("Person", r.issueOwner); add("Person", r.blockerOwner);
  }
  return { text: renderGraphContext(rows as any), retrieved };
}

export class GraphContext implements Processor {
  id = "graph-context";
  private cache = new Map<string, Awaited<ReturnType<typeof graphRetrieve>>>();
  async processInputStep({ messageList }: ProcessInputStepArgs) {
    if (config.retrieval !== "graph" && config.retrieval !== "both") return;
    const q = runtime.userText;
    if (!q.trim()) return;
    const key = `${runtime.sessionId}:${runtime.turn}`; // retrieve once per user turn, not per step
    let hit = this.cache.get(key);
    if (hit === undefined) {
      hit = await graphRetrieve(q);
      this.cache.set(key, hit);
    }
    messageList.clearSystemMessages(TAG);
    if (!hit.text) return;
    messageList.addSystem(hit.text, TAG);
    runtime.systemMeta[TAG] = { retrieved: hit.retrieved };
    if (!runtime.injected.includes(hit.text)) runtime.injected.push(hit.text);
    return;
  }
}
