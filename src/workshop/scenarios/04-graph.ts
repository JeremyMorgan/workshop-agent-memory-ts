import { ingestSeed } from "../harness/ingest.js";
import { semanticSearch } from "../retrieval/semanticIndex.js";
import { config } from "../../../workshop.config.js";
import type { Scenario } from "./ctx.js";

const QUESTION = "Who should I chase before Tuesday's billing review?";
// Same suffix for every mode: the point is what retrieval put in context, not whether the agent goes exploring.
const PROMPT = `${QUESTION}\n\n(Answer from the context you have been given. No tools are available for this question.)`;

export const scenario: Scenario = {
  stage: 4,
  slug: "04-graph",
  title: "Stage 4: graph retrieval vs flat semantic recall",
  async run(ctx) {
    ctx.title("Setup: load the same data into both retrieval systems");
    ctx.verified("tool outputs ingested into the graph (deterministic mappers, no LLM)", await ingestSeed());
    ctx.title("What flat semantic recall retrieves for the question (top 4 by cosine similarity)");
    for (const h of await semanticSearch(QUESTION, 4)) ctx.note(`${h.chunk.kind} ${h.chunk.id} (${h.score.toFixed(2)}): ${h.chunk.text.replace(/\s+/g, " ").slice(0, 90)}...`);
    ctx.title("What the graph returns: the path Event -> Issue -> blocker -> owner");
    ctx.table(await ctx.query("eventToBlockerOwner"));

    const results: Record<string, { sam: boolean; thursday: boolean }> = {};
    for (const mode of ["semantic", "graph", "both"] as const) {
      ctx.title(`retrieval = "${mode}" (answering from retrieved context only; tools off)`);
      ctx.setConfig({ retrieval: mode });
      ctx.newSession(`S4-${mode}`);
      const answer = await ctx.say(PROMPT, { toolChoice: "none" });
      results[mode] = { sam: /\bSam\b/.test(answer), thursday: /thursday|06-12|June 12/i.test(answer) };
      ctx.verified(`names Sam`, String(results[mode].sam));
      ctx.verified(`notes the ETA is after the meeting (Thursday)`, String(results[mode].thursday));
    }
    ctx.setConfig({ retrieval: "both" });
    ctx.title("Summary");
    for (const [m, r] of Object.entries(results)) ctx.note(`${m.padEnd(8)} names Sam: ${r.sam ? "yes" : "NO"}   mentions Thursday ETA: ${r.thursday ? "yes" : "no"}`);
    void config;
  },
};
