// POLE+O entities plus the User node, written from what the user says. What gets extracted is defined in ontology.ts.
// Labels and relationship types are checked against that ontology (see graph/ontology.ts), so interpolating them into Cypher is safe.
import type { z } from "zod";
import { personKey } from "../hooks/mapToolResults.js";
import { buildExtractionSchema, ontology } from "./ontology.js";
import { run } from "./driver.js";
import { invalidateGraphSchema } from "./schema.js";

export const USER_ID = "workshop-user";

/** Built from the participant's ontology.ts: entity types, subtypes and relationship names are all theirs. */
export const poleSchema = buildExtractionSchema(ontology);
export type PoleExtraction = z.infer<typeof poleSchema>;
type PoleType = string;
type RelType = string;

type Ref = { label: "User" } | { label: PoleType; name: string };
export interface ResolvedRelation { from: Ref; type: RelType; to: Ref }

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The property a label is merged on, and its value. */
export function keyOf(ref: Ref): { label: string; prop: string; value: string } {
  if (!("name" in ref)) return { label: "User", prop: "id", value: USER_ID };
  if (ref.label === "Person") return { label: "Person", prop: "name", value: personKey(ref.name) }; // matches the email/calendar people
  if (ref.label === "Event") return { label: "Event", prop: "id", value: `user-event:${slug(ref.name)}` };
  return { label: ref.label, prop: "name", value: ref.name.trim() };
}

/** Turn name-based relations into typed endpoints. Relations that mention an unknown entity are dropped. */
export function resolveRelations(entities: PoleExtraction["entities"], relations: PoleExtraction["relations"]): ResolvedRelation[] {
  const byName = new Map(entities.map((e) => [e.name.trim().toLowerCase(), e]));
  const ref = (name: string): Ref | null => {
    const n = name.trim().toLowerCase();
    if (n === "user") return { label: "User" };
    const e = byName.get(n);
    return e ? { label: e.type, name: e.name } : null;
  };
  return relations.flatMap((r) => {
    const from = ref(r.from), to = ref(r.to);
    return from && to && to.label !== "User" ? [{ from, type: r.type, to }] : [];
  });
}

export const upsertUser = (u: { name?: string | null; funFact?: string | null; preferences?: string[] }) =>
  run(
    `MERGE (user:User {id:$id})
     SET user.name = coalesce($name, user.name), user.funFact = coalesce($funFact, user.funFact),
         user.preferences = reduce(acc = [], p IN coalesce(user.preferences, []) + $preferences | CASE WHEN p IN acc THEN acc ELSE acc + p END)`,
    { id: USER_ID, name: u.name ?? null, funFact: u.funFact ?? null, preferences: u.preferences ?? [] },
  );

export function upsertEntity(e: { type: PoleType; subtype?: string | null; name: string; description?: string | null }) {
  const k = keyOf({ label: e.type, name: e.name });
  const title = e.type === "Event" ? ", n.title = $name" : "";
  const subtype = e.subtype ? `, n:${e.subtype}` : ""; // the second label: (:Person:Employee)
  return run(`MERGE (n:${k.label} {${k.prop}:$key}) SET n.description = coalesce($description, n.description)${title}${subtype}`, {
    key: k.value, name: e.name.trim(), description: e.description ?? null,
  });
}

export function upsertRelation(r: ResolvedRelation) {
  const a = keyOf(r.from), b = keyOf(r.to);
  return run(`MATCH (a:${a.label} {${a.prop}:$a}), (b:${b.label} {${b.prop}:$b}) MERGE (a)-[:${r.type}]->(b)`, { a: a.value, b: b.value });
}

export const hasContent = (x: PoleExtraction) =>
  !!(x.user.name || x.user.funFact || x.user.preferences.length || x.entities.length || x.relations.length);

/** Write everything the extractor found. Entities first, so relations always have both ends. */
export async function applyExtraction(x: PoleExtraction) {
  const relations = resolveRelations(x.entities, x.relations);
  if (x.user.name || x.user.funFact || x.user.preferences.length || relations.some((r) => r.from.label === "User")) await upsertUser(x.user);
  for (const e of x.entities) await upsertEntity(e);
  for (const r of relations) await upsertRelation(r);
  invalidateGraphSchema();
}

export interface UserProfile {
  name: string | null; funFact: string | null; preferences: string[] | null;
  links: { rel: string; type: string; name: string }[];
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const rows = await run<UserProfile>(
    `MATCH (u:User {id:$id}) OPTIONAL MATCH (u)-[r]->(n)
     RETURN u.name AS name, u.funFact AS funFact, u.preferences AS preferences,
            collect(CASE WHEN n IS NULL THEN null ELSE {rel: type(r), type: head(labels(n)), name: coalesce(n.name, n.title)} END) AS links`,
    { id: USER_ID },
  );
  return rows[0] ?? null;
}
