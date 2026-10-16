// `npm run search -- "your question"`: the flat semantic search on its own, with no agent and no graph.
// Prints the top four entries by cosine similarity, which is what the agent adds to the context at stage 4.
import { fileURLToPath } from "node:url";
import { semanticSearch } from "./semanticIndex.js";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const question = process.argv.slice(2).join(" ").trim() || "Who should I chase before Tuesday's billing review?";
  console.log(`Question: ${question}\n`);
  const hits = await semanticSearch(question, 4);
  console.table(hits.map((h) => ({ kind: h.chunk.kind, id: h.chunk.id, score: Number(h.score.toFixed(2)), text: h.chunk.text.replace(/\s+/g, " ").slice(0, 70) + "..." })));
}
