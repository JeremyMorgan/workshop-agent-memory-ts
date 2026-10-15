// STAGE 4: graph retrieval. LINK the question to nodes, then WALK the relationships around them
// (Email -> Customer -> Project -> Issue -> blocker -> owner, Event -> Issue). Flat recall finds similar text;
// the graph follows the structure.
//
// Linking has two sources:
//   - names in the question: an Event title or day, an Issue id, a Customer or Project name (plain string match)
//   - in "both" mode, the items the similarity search found, which is how a vague question gets a starting point
// With "graph" alone a question that names nothing links to nothing, and nothing is retrieved.
import type { Processor, ProcessInputStepArgs } from "@mastra/core/processors";
import { config } from "../../../workshop.config.js";
import { run } from "../graph/driver.js";
import { withWeekday } from "../nsuite/state.js";
import { runtime, type SystemMeta } from "../runtime.js";
import { similarItems } from "./semanticContext.js";

export const TAG = "graph-context";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// The model miscounts weekdays from a bare date, so the weekday is attached in code.
const when = (eta: unknown) => (typeof eta === "string" && ISO_DATE.test(eta) ? withWeekday(eta) : eta);

interface Meeting { title: string; day?: string; time?: string; attendees?: string[] }
interface Row {
  event?: any; issue?: any; blocker?: any; blockerOwner?: string | null; issueOwner?: string | null;
  project?: string | null; customer?: string | null; meetings?: Meeting[];
}
interface Extra {
  customers?: { customer: string; contacts: string[]; projects: string[] }[];
  emails?: { id: string; subject: string; sender?: string; mentions: string[] }[];
}

/** Pure rendering of retrieved paths. Exported for tests. */
export function renderGraphContext(rows: Row[], extra: Extra = {}): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  const add = (l: string) => { if (!seen.has(l)) { seen.add(l); lines.push(l); } };
  for (const e of extra.emails ?? []) add(`- Email ${e.id} "${e.subject}"${e.sender ? ` from ${e.sender}` : ""} mentions ${e.mentions.join(", ")}.`);
  for (const c of extra.customers ?? []) add(`- Customer ${c.customer}: contacts ${c.contacts.join(", ") || "none known"}; projects ${c.projects.join(", ") || "none"}.`);
  for (const r of rows) {
    if (r.event) add(`- Event "${r.event.title}" (${r.event.day} ${r.event.date} ${r.event.time}), attendees: ${(r.event.attendees ?? []).join(", ") || "none"}. About: ${(r.event.tickets ?? []).join(", ") || "n/a"}.`);
    if (r.issue) {
      const project = r.project ? `, project ${r.project}${r.customer ? ` (${r.customer})` : ""}` : "";
      const meetings = (r.meetings ?? []).map((m) => `${m.title}${m.day ? ` (${m.day}${m.time ? ` ${m.time}` : ""})` : ""}, attendees ${(m.attendees ?? []).join(", ") || "none"}`);
      add(`- ${r.issue.id} "${r.issue.title}": owner ${r.issueOwner ?? "unknown"}, status ${r.issue.status ?? "unknown"}${r.issue.eta ? `, ETA ${when(r.issue.eta)}` : ""}${project}.${meetings.length ? ` Discussed in: ${meetings.join("; ")}.` : ""}`);
    }
    if (r.issue && r.blocker) add(`- ${r.issue.id} is BLOCKED BY ${r.blocker.id} "${r.blocker.title ?? ""}": owner ${r.blockerOwner ?? "unknown"}, status ${r.blocker.status ?? "unknown"}${r.blocker.eta ? `, ETA ${when(r.blocker.eta)}` : ""}.`);
  }
  if (!lines.length) return "";
  return `GRAPH CONTEXT (entities linked to the question, plus the relationships around them):\n${lines.join("\n")}`;
}

// 1) LINK: the nodes the question names, plus the nodes the similarity search returned ($seedIds).
const LINK = `
CALL () {
  MATCH (e:Event)
  WHERE toLower($q) CONTAINS toLower(e.title)
     OR (e.day IS NOT NULL AND toLower($q) CONTAINS toLower(e.day))
  RETURN 'Event' AS label, e.id AS key
  UNION
  MATCH (i:Issue) WHERE toLower($q) CONTAINS toLower(i.id)
  RETURN 'Issue' AS label, i.id AS key
  UNION
  MATCH (c:Customer) WHERE toLower($q) CONTAINS toLower(c.name)
  RETURN 'Customer' AS label, c.name AS key
  UNION
  MATCH (p:Project) WHERE toLower($q) CONTAINS toLower(p.name)
  RETURN 'Project' AS label, p.name AS key
  UNION
  MATCH (n) WHERE n.id IN $seedIds AND (n:Email OR n:Event OR n:Issue)
  RETURN head([l IN labels(n) WHERE l IN ['Email', 'Event', 'Issue']]) AS label, n.id AS key
}
RETURN label, collect(DISTINCT key) AS keys`;

// 2) WALK, once per kind of thing. These do not depend on each other, so they run together.
const ISSUES = `
CALL () {
  MATCH (i:Issue) WHERE i.id IN $issues RETURN i
  UNION
  MATCH (e:Event)-[:ABOUT]->(i:Issue) WHERE e.id IN $events RETURN i
  UNION
  MATCH (p:Project)<-[:PART_OF]-(i:Issue) WHERE p.name IN $projects RETURN i
  UNION
  MATCH (c:Customer)<-[:FOR]-(:Project)<-[:PART_OF]-(i:Issue) WHERE c.name IN $customers RETURN i
  UNION
  MATCH (m:Email)-[:MENTIONS]->(:Project)<-[:PART_OF]-(i:Issue) WHERE m.id IN $emails RETURN i
  UNION
  MATCH (m:Email)-[:MENTIONS]->(:Customer)<-[:FOR]-(:Project)<-[:PART_OF]-(i:Issue) WHERE m.id IN $emails RETURN i
}
WITH DISTINCT i
OPTIONAL MATCH (i)-[:OWNED_BY]->(io:Person)
OPTIONAL MATCH (i)-[:BLOCKED_BY]->(blocker:Issue)
OPTIONAL MATCH (blocker)-[:OWNED_BY]->(bo:Person)
OPTIONAL MATCH (i)-[:PART_OF]->(p:Project)-[:FOR]->(c:Customer)
RETURN i{.*} AS issue, io.name AS issueOwner, blocker{.*} AS blocker, bo.name AS blockerOwner, p.name AS project, c.name AS customer,
       [(ev:Event)-[:ABOUT]->(i) | ev{.title, .day, .time, attendees: [(ev)-[:ATTENDED_BY]->(a:Person) | a.name]}] AS meetings`;

const CUSTOMERS = `
CALL () {
  MATCH (c:Customer) WHERE c.name IN $customers RETURN c
  UNION
  MATCH (p:Project)-[:FOR]->(c:Customer) WHERE p.name IN $projects RETURN c
  UNION
  MATCH (m:Email)-[:MENTIONS]->(c:Customer) WHERE m.id IN $emails RETURN c
  UNION
  MATCH (m:Email)-[:MENTIONS]->(:Project)-[:FOR]->(c:Customer) WHERE m.id IN $emails RETURN c
}
WITH DISTINCT c
RETURN c.name AS customer, [(c)<-[:WORKS_FOR]-(p:Person) | p.name] AS contacts, [(c)<-[:FOR]-(pr:Project) | pr.name] AS projects`;

const EMAILS = `
MATCH (m:Email) WHERE m.id IN $emails
OPTIONAL MATCH (m)-[:MENTIONS]->(x) WHERE x:Customer OR x:Project
WITH m, collect(x.name) AS mentions WHERE size(mentions) > 0
RETURN m.id AS id, m.subject AS subject, m.sender AS sender, mentions`;

const EVENTS = `
MATCH (e:Event) WHERE e.id IN $events
OPTIONAL MATCH (e)-[:ATTENDED_BY]->(p:Person)
OPTIONAL MATCH (e)-[:ABOUT]->(i:Issue)
WITH e, collect(DISTINCT p.name) AS attendees, collect(DISTINCT i.id) AS tickets
RETURN e{.*, attendees: attendees, tickets: tickets} AS event`;

export async function graphRetrieve(question: string, seedIds: string[] = []): Promise<{ text: string; retrieved: NonNullable<SystemMeta["retrieved"]> }> {
  const linked = await run(LINK, { q: question, seedIds });
  const keys = (label: string): string[] => (linked as any[]).find((r) => r.label === label)?.keys ?? [];
  const ids = { events: keys("Event"), issues: keys("Issue"), emails: keys("Email"), customers: keys("Customer"), projects: keys("Project") };
  if (!Object.values(ids).some((k) => k.length)) return { text: "", retrieved: [] };

  const [issueRows, customers, emails, events] = (await Promise.all([run(ISSUES, ids), run(CUSTOMERS, ids), run(EMAILS, ids), run(EVENTS, ids)])) as any[][];
  const rows: Row[] = [...events.map((e) => ({ event: e.event })), ...issueRows];
  const text = renderGraphContext(rows, { customers, emails });

  const retrieved: NonNullable<SystemMeta["retrieved"]> = [];
  const seen = new Set<string>();
  const add = (label: NonNullable<SystemMeta["retrieved"]>[number]["label"], id?: string | null) => {
    if (id && !seen.has(`${label}:${id}`)) { seen.add(`${label}:${id}`); retrieved.push({ label, id }); }
  };
  for (const e of events) add("Event", e.event?.id);
  for (const e of emails) add("Email", e.id);
  for (const c of customers) { add("Customer", c.customer); for (const p of c.projects) add("Project", p); }
  for (const r of issueRows) { add("Issue", r.issue?.id); add("Issue", r.blocker?.id); add("Person", r.issueOwner); add("Person", r.blockerOwner); }
  return { text, retrieved };
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
      // Only "both" lets similarity choose the starting points. The same filtered items the semantic processor uses.
      const seedIds = config.retrieval === "both" ? (await similarItems(q)).hits.map((h) => h.chunk.id) : [];
      hit = await graphRetrieve(q, seedIds);
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
