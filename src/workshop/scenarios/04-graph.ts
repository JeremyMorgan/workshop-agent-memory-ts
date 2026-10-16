import { ingestSeed } from "../harness/ingest.js";
import { semanticSearch } from "../retrieval/semanticIndex.js";
import type { Scenario } from "./ctx.js";

// Where similarity works, where it cannot answer, and what the graph adds when similarity picks the starting point.
const WORKS = "Are any customers behind on paying us?";
const ABSENCE = "Which open tickets haven't come up in any meeting?";
const FUZZY_THEN_WALK = "Are any customers behind on paying us, and is anything on our side holding it up?";
const FUZZY_START = "What is blocking the issue Dana escalated?";

// Same suffix for every mode: the point is what retrieval put in context, not whether the agent goes exploring.
const suffix = "\n\n(Answer from the context you have been given, including any dates that matter. No tools are available for this question.)";

const CUSTOMERS = ["Contoso", "Fabrikam", "Tailspin"];
const namesSam = (a: string) => /\bSam\b/.test(a);
const mentionsThursday = (a: string) => /thursday|06-12|June 12/i.test(a);
const namesCustomers = (a: string) => CUSTOMERS.every((c) => a.includes(c));

export const scenario: Scenario = {
  stage: 4,
  slug: "04-graph",
  title: "Stage 4: similarity, graph walks, and both",
  async run(ctx) {
    ctx.title("Setup: load the same data into the graph (deterministic mappers, no LLM)");
    ctx.verified("tool outputs ingested into the graph", await ingestSeed());

    ctx.title(`Where similarity works: "${WORKS}"`);
    for (const h of await semanticSearch(WORKS, 4)) ctx.note(`${h.chunk.kind} ${h.chunk.id} (${h.score.toFixed(2)}): ${h.chunk.text.replace(/\s+/g, " ").slice(0, 90)}...`);

    ctx.title(`Where similarity cannot answer: "${ABSENCE}"`);
    for (const h of await semanticSearch(ABSENCE, 4)) ctx.note(`${h.chunk.kind} ${h.chunk.id} (${h.score.toFixed(2)}): ${h.chunk.text.replace(/\s+/g, " ").slice(0, 90)}...`);
    ctx.note("The closest items are meetings and nothing says which tickets are missing from them. An exact query answers it:");
    ctx.table(await ctx.query("unscheduledTickets"));

    ctx.title("From the overdue emails to the work behind them");
    ctx.table(await ctx.query("overdueToWork"));

    const results: Record<string, Record<string, { sam: boolean; thursday: boolean; customers: boolean }>> = {};
    for (const [label, question] of [["overdue-then-walk", FUZZY_THEN_WALK], ["fuzzy-start", FUZZY_START]] as const) {
      results[label] = {};
      for (const mode of ["semantic", "graph", "both"] as const) {
        ctx.title(`"${question}" with retrieval = "${mode}" (answering from retrieved context only; tools off)`);
        ctx.setConfig({ retrieval: mode });
        ctx.newSession(`S4-${label}-${mode}`);
        const answer = await ctx.say(question + suffix, { toolChoice: "none" });
        const r = { sam: namesSam(answer), thursday: mentionsThursday(answer), customers: namesCustomers(answer) };
        results[label][mode] = r;
        ctx.verified("names the overdue customers", String(r.customers));
        ctx.verified("names Sam", String(r.sam));
        ctx.verified("notes the ETA is Thursday", String(r.thursday));
      }
    }
    ctx.setConfig({ retrieval: "both" });

    ctx.title("Summary");
    for (const [label, byMode] of Object.entries(results)) {
      ctx.note(label);
      for (const [m, r] of Object.entries(byMode)) {
        ctx.note(`  ${m.padEnd(8)} names the customers: ${r.customers ? "yes" : "no "}   names Sam: ${r.sam ? "yes" : "no "}   mentions Thursday ETA: ${r.thursday ? "yes" : "no"}`);
      }
    }
  },
};
