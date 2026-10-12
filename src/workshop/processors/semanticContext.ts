// STAGE 4 (baseline): flat semantic recall. Injects the top-k most similar chunks for the user's question.
import type { Processor, ProcessInputStepArgs } from "@mastra/core/processors";
import { config } from "../../../workshop.config.js";
import { isExternalSender } from "../graph/provenance.js";
import { isSensitiveQuestion } from "./trustFilter.js";
import { semanticSearch } from "../retrieval/semanticIndex.js";
import { runtime, type SystemMeta } from "../runtime.js";

export const TAG = "semantic-context";
export const TOP_K = 4; // Mastra's semantic recall default topK

export class SemanticContext implements Processor {
  id = "semantic-context";
  private cache = new Map<string, { text: string; retrieved: NonNullable<SystemMeta["retrieved"]> }>();
  async processInputStep({ messageList }: ProcessInputStepArgs) {
    if (config.retrieval !== "semantic" && config.retrieval !== "both") return;
    const q = runtime.userText;
    if (!q.trim()) return;
    const key = `${runtime.sessionId}:${runtime.turn}`; // retrieve once per user turn, not per step
    let text = this.cache.get(key)?.text;
    if (!text) {
      let hits = await semanticSearch(q, TOP_K);
      // STAGE 6: raw text from external senders is untrusted too, so withhold it for payment/account questions.
      if (config.trustFilter && isSensitiveQuestion(q)) {
        const untrusted = (h: (typeof hits)[number]) => !!h.chunk.sender && isExternalSender(h.chunk.sender);
        runtime.factsWithheld.push(...hits.filter(untrusted).map((h) => h.chunk.text));
        hits = hits.filter((h) => !untrusted(h));
      }
      runtime.factsServed.push(...hits.map((h) => h.chunk.text));
      const retrieved = hits.map((h) => ({ label: (h.chunk.kind === "email" ? "Email" : h.chunk.kind === "event" ? "Event" : "Issue") as "Email" | "Event" | "Issue", id: h.chunk.id, score: Number(h.score.toFixed(3)) }));
      text = `SEMANTIC RECALL (top ${TOP_K} most similar items to the question):\n` +
        hits.map((h) => `- [${h.chunk.kind} ${h.chunk.id}, similarity ${h.score.toFixed(2)}] ${h.chunk.text.replace(/\s+/g, " ").slice(0, 600)}`).join("\n");
      this.cache.set(key, { text, retrieved });
    }
    runtime.systemMeta[TAG] = { retrieved: this.cache.get(key)!.retrieved };
    messageList.clearSystemMessages(TAG);
    messageList.addSystem(text, TAG);
    if (!runtime.injected.includes(text)) runtime.injected.push(text);
    return;
  }
}
