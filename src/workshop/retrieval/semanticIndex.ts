// STAGE 4 baseline: "flat" semantic recall. A vector index over the SAME data the graph sees
// (emails, events, tickets), embedded locally with fastembed (no API key needed) and searched by cosine.
// Honest by construction: plain chunks, plain top-k, no tricks.
import { fastembed } from "@mastra/fastembed";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { WORKSHOP_DIR } from "../paths.js";
import { loadSeed, withWeekday } from "../nsuite/state.js";

export interface Chunk { id: string; kind: "email" | "event" | "issue"; text: string; sender?: string }

/** One chunk per email, event and ticket, built from the seed (deterministic). */
export function buildChunks(): Chunk[] {
  const s = loadSeed();
  return [
    ...s.emails.map((e) => ({ id: e.id, kind: "email" as const, text: `Email ${e.id} from ${e.from}, to ${e.to.join(", ")}${e.cc.length ? `, cc ${e.cc.join(", ")}` : ""}: ${e.subject}\n${e.body}`, sender: e.sender })),
    ...s.events.map((e) => ({
      id: e.id, kind: "event" as const,
      text: `Calendar event ${e.id}: ${e.title}, ${e.day} ${e.date} ${e.time}. ${e.description}. Attendees: ${e.attendees.join(", ")}. Tickets: ${e.tickets.join(", ") || "none"}.`,
    })),
    ...s.issues.map((i) => ({
      id: i.id, kind: "issue" as const,
      text: `Ticket ${i.id}: ${i.title}. Owner: ${i.owner}. Status: ${i.status}.${i.eta ? ` ETA: ${withWeekday(i.eta)}.` : ""} ${i.blocked_by.length ? `Blocked by ${i.blocked_by.join(", ")}.` : ""} ${i.description}`,
    })),
  ];
}

const model = fastembed.small;
async function embed(values: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < values.length; i += 16) {
    const { embeddings } = await model.doEmbed({ values: values.slice(i, i + 16) });
    out.push(...embeddings);
  }
  return out;
}
const cosine = (a: number[], b: number[]) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na) * Math.sqrt(nb) || 1);
};

let index: { chunk: Chunk; vector: number[] }[] | undefined;
export async function getIndex() {
  if (index) return index;
  const chunks = buildChunks();
  const hash = createHash("sha256").update(JSON.stringify(chunks)).digest("hex").slice(0, 16);
  const cache = join(WORKSHOP_DIR, `semantic-index-${hash}.json`);
  let vectors: number[][];
  if (existsSync(cache)) vectors = JSON.parse(readFileSync(cache, "utf8"));
  else {
    vectors = await embed(chunks.map((c) => c.text));
    mkdirSync(WORKSHOP_DIR, { recursive: true });
    writeFileSync(cache, JSON.stringify(vectors));
  }
  return (index = chunks.map((chunk, i) => ({ chunk, vector: vectors[i] })));
}

export type Hit = { chunk: Chunk; score: number };

// One question is searched by both the semantic and the graph processor ("both" mode), so embed it once.
const searches = new Map<string, Promise<Hit[]>>();
export function semanticSearch(question: string, k = 4): Promise<Hit[]> {
  const key = `${k}:${question}`;
  let hits = searches.get(key);
  if (!hits) searches.set(key, (hits = search(question, k)));
  return hits;
}

async function search(question: string, k: number): Promise<Hit[]> {
  const idx = await getIndex();
  // bge models are trained to embed queries with this instruction prefix; omitting it would handicap the baseline.
  const [q] = await embed([`Represent this sentence for searching relevant passages: ${question}`]);
  return idx
    .map(({ chunk, vector }) => ({ chunk, score: cosine(q, vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
