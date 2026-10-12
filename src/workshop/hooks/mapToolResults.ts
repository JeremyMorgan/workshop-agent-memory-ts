// STAGE 3: deterministic mappers from tool output to graph entities. No LLM involved.
// `mapToolResult` is pure (easy to test); `applyDelta` writes the result to Neo4j.
import { run } from "../graph/driver.js";

export type Label = "Email" | "Event" | "Issue" | "Person";
export interface GraphNode { label: Label; key: string; props: Record<string, unknown> }
export interface GraphRel { from: { label: Label; key: string }; type: string; to: { label: Label; key: string } }
export interface GraphDelta { nodes: GraphNode[]; rels: GraphRel[] }

type People = Record<string, { name: string; email: string; role: string }>;

/** "Dana Whitfield" -> "Dana". People are keyed by first name so calendar, tickets and email agree. */
export const personKey = (name: string) => name.trim().split(/\s+/)[0];

export function mapToolResult(tool: string, output: any, people: People = {}): GraphDelta {
  const d: GraphDelta = { nodes: [], rels: [] };
  const person = (name: string, extra: Record<string, unknown> = {}) => {
    const key = personKey(name);
    const known = Object.values(people).find((p) => personKey(p.name) === key);
    d.nodes.push({ label: "Person", key, props: { name: key, ...(known ? { role: known.role, email: known.email } : {}), ...extra } });
    return key;
  };
  const email = (e: any) => {
    d.nodes.push({
      label: "Email", key: e.id,
      props: {
        id: e.id, sender: e.sender, subject: e.subject,
        ...(e.snippet ? { snippet: e.snippet } : {}), ...(e.date ? { date: e.date } : {}),
        ...(e.from ? { from: e.from } : {}), ...(e.to ? { to: e.to } : {}), ...(e.cc ? { cc: e.cc } : {}),
        ...(e.thread_id ? { thread_id: e.thread_id } : {}), ...(e.message_id ? { message_id: e.message_id } : {}),
      },
    });
    const link = (addrOrHeader: string, type: string) => {
      const address = (addrOrHeader.match(/<([^>]+)>/)?.[1] ?? addrOrHeader).toLowerCase();
      const known = Object.values(people).find((p) => p.email.toLowerCase() === address);
      if (known) d.rels.push({ from: { label: "Email", key: e.id }, type, to: { label: "Person", key: person(known.name) } });
    };
    link(e.sender, "SENT_BY");
    for (const t of e.to ?? []) link(t, "TO");
    for (const c of e.cc ?? []) link(c, "CC");
    if (e.in_reply_to) {
      const parent = String(e.in_reply_to).match(/<(e-\d+)@/)?.[1];
      if (parent) {
        d.nodes.push({ label: "Email", key: parent, props: { id: parent } });
        d.rels.push({ from: { label: "Email", key: e.id }, type: "REPLY_TO", to: { label: "Email", key: parent } });
      }
    }
  };
  const issue = (i: any) => {
    d.nodes.push({
      label: "Issue", key: i.id,
      props: { id: i.id, ...(i.title ? { title: i.title } : {}), ...(i.status ? { status: i.status } : {}), ...(i.eta ? { eta: i.eta } : {}), ...(i.description ? { description: i.description } : {}) },
    });
    if (i.owner) d.rels.push({ from: { label: "Issue", key: i.id }, type: "OWNED_BY", to: { label: "Person", key: person(i.owner) } });
    for (const b of i.blocked_by ?? []) {
      d.nodes.push({ label: "Issue", key: b, props: { id: b } });
      d.rels.push({ from: { label: "Issue", key: i.id }, type: "BLOCKED_BY", to: { label: "Issue", key: b } });
    }
  };

  switch (tool) {
    case "list_emails": (output?.emails ?? []).forEach(email); break;
    case "read_email": if (output?.id) email(output); break;
    case "get_events":
      for (const ev of output?.events ?? []) {
        d.nodes.push({ label: "Event", key: ev.id, props: { id: ev.id, title: ev.title, date: ev.date, day: ev.day, time: ev.time, description: ev.description } });
        for (const a of ev.attendees ?? []) d.rels.push({ from: { label: "Event", key: ev.id }, type: "ATTENDED_BY", to: { label: "Person", key: person(a) } });
        for (const t of ev.tickets ?? []) {
          d.nodes.push({ label: "Issue", key: t, props: { id: t } });
          d.rels.push({ from: { label: "Event", key: ev.id }, type: "ABOUT", to: { label: "Issue", key: t } });
        }
      }
      break;
    case "list_issues": (output?.issues ?? []).forEach(issue); break;
    case "get_issue": if (output?.id) issue(output); break;
  }
  return d;
}

const KEY_PROP: Record<Label, string> = { Email: "id", Event: "id", Issue: "id", Person: "name" };
/** Every entity also carries its POLE+O label, so tool results and user statements share one model. */
export const POLE_LABEL: Record<Label, "Person" | "Object" | "Location" | "Event" | "Organization"> = { Email: "Object", Event: "Event", Issue: "Object", Person: "Person" };

export async function applyDelta(d: GraphDelta): Promise<void> {
  for (const label of Object.keys(KEY_PROP) as Label[]) {
    const rows = d.nodes.filter((n) => n.label === label).map((n) => ({ key: n.key, props: n.props }));
    if (!rows.length) continue;
    await run(`UNWIND $rows AS r MERGE (n:${label} {${KEY_PROP[label]}: r.key}) SET n += r.props${POLE_LABEL[label] === label ? "" : `, n:${POLE_LABEL[label]}`}`, { rows });
  }
  const byType = new Map<string, GraphRel[]>();
  for (const r of d.rels) {
    const k = `${r.from.label}|${r.type}|${r.to.label}`;
    byType.set(k, [...(byType.get(k) ?? []), r]);
  }
  for (const [k, rels] of byType) {
    const [fl, type, tl] = k.split("|") as [Label, string, Label];
    await run(
      `UNWIND $rows AS r MATCH (a:${fl} {${KEY_PROP[fl]}: r.from}) MATCH (b:${tl} {${KEY_PROP[tl]}: r.to}) MERGE (a)-[:${type}]->(b)`,
      { rows: rels.map((r) => ({ from: r.from.key, to: r.to.key })) },
    );
  }
}
