// STAGE 3: onboarding. Pins what the graph knows about the user (the User node and what it links to).
// While nothing is known, adds a nudge to introduce yourself instead.
import type { Processor, ProcessInputStepArgs } from "@mastra/core/processors";
import { config } from "../../../workshop.config.js";
import { getUserProfile, type UserProfile } from "../graph/pole.js";
import { runtime } from "../runtime.js";

export const TAG = "about-user";

export const ONBOARDING_NUDGE = `You have not met this user yet. Greet them briefly and ask their name, where they live and one fun fact about them, then still help with whatever they asked. Ask once only: when they have answered (or declined) carry on normally.`;

export const isKnown = (p: UserProfile | null): p is UserProfile =>
  !!p && !!(p.name || p.funFact || p.preferences?.length || p.links.length);

export function renderAbout(p: UserProfile): string {
  const lines: string[] = [];
  if (p.name) lines.push(`- Name: ${p.name}`);
  const byRel = new Map<string, string[]>();
  for (const l of p.links) byRel.set(l.rel, [...(byRel.get(l.rel) ?? []), l.name]);
  for (const [rel, names] of byRel) lines.push(`- ${rel.toLowerCase().replace(/_/g, " ")}: ${names.join(", ")}`);
  if (p.preferences?.length) lines.push(`- Preferences: ${p.preferences.join("; ")}`);
  if (p.funFact) lines.push(`- Fun fact: ${p.funFact}`);
  return `ABOUT THE USER (pinned; use it to personalise replies and recall it when asked):\n${lines.join("\n")}`;
}

export class AboutUser implements Processor {
  id = "about-user";
  async processInputStep({ messageList }: ProcessInputStepArgs) {
    if (!config.onboarding) return;
    const profile = await getUserProfile();
    messageList.clearSystemMessages(TAG);
    const text = isKnown(profile) ? renderAbout(profile) : ONBOARDING_NUDGE;
    messageList.addSystem(text, TAG);
    runtime.systemMeta[TAG] = {};
    if (!runtime.injected.includes(text)) runtime.injected.push(text);
    return;
  }
}
