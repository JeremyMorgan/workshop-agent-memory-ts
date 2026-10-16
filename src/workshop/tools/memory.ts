// STAGE 3+: the agent's long-term memory tools (graph backed).
import { z } from "zod";
import { config } from "../../../workshop.config.js";
import { upsertFact, listFacts, listRules } from "../graph/store.js";
import { lookupEntities } from "../graph/search.js";
import { getUserProfile } from "../graph/pole.js";
import { extractionInstructions } from "../hooks/extractUserStatements.js";
import { withheldNotice, type TrustedFact } from "../processors/trustFilter.js";
import type { Provenance } from "../graph/provenance.js";
import { runtime } from "../runtime.js";
import { spec } from "./spec.js";

/** STAGE 6 plugs its policies in here (see the STAGE 6 block in src/agent.ts). Without them memory is "flat". */
export const memoryPolicies: {
  provenance: ((text: string) => Provenance) | null;
  trustFilter: (<T extends TrustedFact>(facts: T[], questionText: string) => { kept: T[]; withheld: T[] }) | null;
} = { provenance: null, trustFilter: null };

export const remember_fact = spec({
  id: "remember_fact",
  description:
    "Save a fact to long-term memory so it is available in future sessions. `source` is where you learned it (for example 'user' or 'email e-017').",
  schema: z.object({ text: z.string(), source: z.string() }),
  write: true,
  // memory writes go to the graph in both "mock" and "real" mode; dry-run only logs.
  mock: async ({ text }) => {
    // STAGE 6: with provenance on, source/trust come from code, not from the model's claim.
    const prov = config.provenance && memoryPolicies.provenance ? memoryPolicies.provenance(text) : null;
    await upsertFact({ text, source: prov?.source ?? null, trust: prov?.trust ?? null, emailId: prov?.emailId ?? null });
    return { remembered: true, text, ...(prov ? { source: prov.source, trust: prov.trust } : {}) };
  },
});

export const query_memory = spec({
  id: "query_memory",
  description:
    "Look up long-term memory: saved facts, standing rules, and known events, tickets and people matching the question.",
  schema: z.object({ question: z.string() }),
  write: false,
  mock: async ({ question }) => {
    const rules = await listRules();
    const facts = await listFacts();
    const { kept, withheld } = config.trustFilter && memoryPolicies.trustFilter
      ? memoryPolicies.trustFilter(facts, `${question} ${runtime.userText}`)
      : { kept: facts, withheld: [] as typeof facts };
    const entities = await lookupEntities(question);
    const profile = config.onboarding ? await getUserProfile() : null;
    runtime.factsServed.push(...kept.map((f) => f.text));
    runtime.factsWithheld.push(...withheld.map((f) => f.text));
    const notice = withheldNotice(withheld.length);
    return {
      rules: rules.map((r) => ({ tool: r.tool, mode: r.mode, source: r.source })),
      facts: kept.map((f) => ({ text: f.text, ...(f.source ? { source: f.source, trust: f.trust } : {}) })),
      ...entities,
      ...(profile?.name || profile?.links.length ? { user: profile } : {}),
      ...(notice ? { notice } : {}),
    };
  },
});

export const show_extraction_prompt = spec({
  id: "show_extraction_prompt",
  description:
    "Show the exact instructions the memory extractor is given when it reads what the user says: the entity types, subtypes and relationships from ontology.ts, plus the rules for facts and standing rules. Use when the user asks what the agent extracts or why something was or was not saved.",
  schema: z.object({}),
  write: false,
  mock: () => ({ prompt: extractionInstructions() }),
});
