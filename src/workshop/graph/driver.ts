import neo4j, { type Driver } from "neo4j-driver";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import "../env.js";
import { ROOT } from "../paths.js";

let driver: Driver | undefined;
let schemaReady = false;

export function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(
      process.env.NEO4J_URI || "bolt://localhost:7687",
      neo4j.auth.basic(process.env.NEO4J_USERNAME || "neo4j", process.env.NEO4J_PASSWORD || "workshop-password"),
    );
  }
  return driver;
}

/** Convert neo4j Integers (and nested structures) into plain JS values. */
export function plain(v: unknown): unknown {
  if (neo4j.isInt(v)) return (v as { toNumber(): number }).toNumber();
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("properties" in o && "labels" in o) return plain(o.properties);
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, plain(x)]));
  }
  return v;
}

// All queries go through one queue. Hooks (onStepFinish) and processors write concurrently, and overlapping
// MERGEs on the same Message nodes deadlock in Neo4j; one at a time is plenty fast for a workshop.
let queue: Promise<unknown> = Promise.resolve();
export function run<T = Record<string, unknown>>(cypher: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const result = queue.then(() => runNow<T>(cypher, params));
  queue = result.catch(() => undefined);
  return result;
}

async function runNow<T>(cypher: string, params: Record<string, unknown>): Promise<T[]> {
  if (!schemaReady) {
    await ensureSchema();
    schemaReady = true;
  }
  const session = getDriver().session({ database: process.env.NEO4J_DATABASE || "neo4j" });
  try {
    const res = await session.run(cypher, params);
    return res.records.map((r) => Object.fromEntries(r.keys.map((k) => [String(k), plain(r.get(k))])) as T);
  } finally {
    await session.close();
  }
}

export async function ensureSchema(): Promise<void> {
  const text = readFileSync(join(ROOT, "src", "workshop", "graph", "schema.cypher"), "utf8")
    .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  const session = getDriver().session({ database: process.env.NEO4J_DATABASE || "neo4j" });
  try {
    for (const stmt of text.split(";").map((s) => s.trim()).filter(Boolean)) await session.run(stmt);
  } finally {
    await session.close();
  }
}

export const GRAPH_LABELS = ["Session", "Message", "SystemMessage", "Step", "ToolCall", "Tool", "Rule", "Fact", "Email", "Event", "Issue", "Person", "User", "Location", "Organization", "Object"];

/** Remove only the nodes this workshop creates (safe on a shared Aura instance). */
export async function clearGraph(): Promise<number> {
  const rows = await run<{ n: number }>(
    "MATCH (n) WHERE any(l IN labels(n) WHERE l IN $labels) WITH n, count(*) AS c DETACH DELETE n RETURN count(*) AS n",
    { labels: GRAPH_LABELS },
  );
  return rows[0]?.n ?? 0;
}

export async function closeDriver(): Promise<void> {
  await driver?.close();
  driver = undefined;
}
