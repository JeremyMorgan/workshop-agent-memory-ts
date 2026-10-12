// npm run reset: restore the fake apps byte-identically, clear the graph and the agent's message history.
import { rmSync } from "node:fs";
import { clearGraph, closeDriver } from "../graph/driver.js";
import { resetState } from "../nsuite/state.js";
import { MASTRA_DB_FILE } from "../paths.js";

export async function resetAll({ graph = true } = {}) {
  resetState();
  for (const suffix of ["", "-shm", "-wal", "-journal"]) rmSync(MASTRA_DB_FILE + suffix, { force: true });
  if (graph) return clearGraph();
  return 0;
}

if (process.argv[1]?.endsWith("reset.ts")) {
  try {
    const n = await resetAll();
    console.log(`reset: nsuite state restored from seed.json, audit log cleared, message history cleared, ${n} graph nodes removed`);
  } catch (err) {
    console.error("reset failed (is Neo4j running? try `npm run neo4j:up`):", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await closeDriver();
  }
}
