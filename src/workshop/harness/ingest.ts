// npm run ingest: load everything the fake apps know into the graph, using the SAME deterministic mappers
// the agent's mapToolResults hook uses (no LLM). Used as the "warm-up" for stage 4 so both retrieval
// strategies see the same data.
import { closeDriver } from "../graph/driver.js";
import { applyDelta, mapToolResult } from "../hooks/mapToolResults.js";
import { loadSeed, loadState } from "../nsuite/state.js";
import { specs } from "../tools/index.js";

export async function ingestSeed() {
  const world = loadSeed(); // static dictionaries: people, customers, projects
  const days = [...new Set(loadState().events.map((e) => e.day))];
  const calls: [string, unknown][] = [
    ["list_emails", await specs.list_emails.mock({})],
    // read_email carries to/cc/thread headers, so ingest every email the way the agent would see it when reading
    ...(await Promise.all(loadState().emails.map(async (e) => ["read_email", await specs.read_email.mock({ id: e.id })] as [string, unknown]))),
    ["list_issues", await specs.list_issues.mock({})],
    ...(await Promise.all(days.map(async (d) => ["get_events", await specs.get_events.mock({ date: d })] as [string, unknown]))),
  ];
  for (const [tool, output] of calls) await applyDelta(mapToolResult(tool, output, world.people, world));
  return calls.length;
}

if (process.argv[1]?.endsWith("ingest.ts")) {
  try {
    console.log(`ingested ${await ingestSeed()} tool outputs into the graph`);
  } finally {
    await closeDriver();
  }
}
