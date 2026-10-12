// STAGE 6: provenance is resolved by CODE from what was actually in context, never from the model's claim.
import { internalDomains } from "../../../workshop.config.js";
import { runtime } from "../runtime.js";

export interface Provenance { source: string; trust: "high" | "medium" | "low"; emailId: string | null }

const tokens = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean));
/** Overlap coefficient: how much of the smaller set is contained in the other (robust to the model adding words). */
function jaccard(a: Set<string>, b: Set<string>) {
  if (Math.min(a.size, b.size) < 4) return 0; // too short to attribute reliably
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / Math.min(a.size, b.size);
}
/** Best sentence-level similarity between a fact and a block of text. */
export function bestOverlap(fact: string, text: string): number {
  const f = tokens(fact);
  return Math.max(0, ...text.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim()).map((s) => jaccard(f, tokens(s))));
}

const THRESHOLD = 0.8;
export const isExternalSender = (addr: string) => {
  const m = addr.match(/@([^>\s]+)/);
  return !(m && internalDomains.includes(m[1].toLowerCase()));
};

export function resolveProvenance(factText: string): Provenance {
  let best: { id: string; sender: string; score: number } | null = null;
  for (const e of runtime.emailsRead.values()) {
    const score = bestOverlap(factText, e.body);
    if (score >= THRESHOLD && (!best || score > best.score)) best = { id: e.id, sender: e.sender, score };
  }
  const userScore = bestOverlap(factText, runtime.userText);
  if (best && best.score > userScore) {
    return isExternalSender(best.sender)
      ? { source: "email:external", trust: "low", emailId: best.id }
      : { source: "email:internal", trust: "medium", emailId: best.id };
  }
  if (userScore >= THRESHOLD) return { source: "user", trust: "high", emailId: null };
  return { source: "agent:unverified", trust: "low", emailId: null };
}
