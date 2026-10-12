// npm run step -- N : apply the preset for stage N to workshop.config.ts (comments are preserved).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { config, type WorkshopConfig } from "../../../workshop.config.js";
import { ROOT } from "../paths.js";

const base: WorkshopConfig = {
  mode: "mock", maxSteps: 8, history: false, historyWindow: 6, traces: false,
  extractUserStatements: false, mapToolResults: false, pinnedRules: false, onboarding: false, retrieval: "none",
  approvalGate: false, recipientAllowlist: false, provenance: false, trustFilter: false,
};

export const presets: Record<number, WorkshopConfig> = {
  0: { ...base },
  1: { ...base, history: true },
  2: { ...base, history: true, traces: true },
  3: { ...base, history: true, traces: true, extractUserStatements: true, mapToolResults: true, pinnedRules: true, onboarding: true },
  4: { ...base, history: true, traces: true, extractUserStatements: true, mapToolResults: true, pinnedRules: true, onboarding: true, retrieval: "both" },
  5: { ...base, history: true, traces: true, extractUserStatements: true, mapToolResults: true, pinnedRules: true, onboarding: true, retrieval: "both", approvalGate: true, recipientAllowlist: true },
  6: { ...base, history: true, traces: true, extractUserStatements: true, mapToolResults: true, pinnedRules: true, onboarding: true, retrieval: "both", approvalGate: true, recipientAllowlist: true, provenance: true, trustFilter: true },
  7: { ...base, history: true, traces: true, extractUserStatements: true, mapToolResults: true, pinnedRules: true, onboarding: true, retrieval: "both", approvalGate: true, recipientAllowlist: true, provenance: true, trustFilter: true },
};

/** Override the live config object (used by scenarios; does not touch the file). */
export function applyPresetInMemory(stage: number) {
  Object.assign(config, presets[stage]);
}

/** Rewrite `key: value,` lines in the config file, keeping every comment. */
export function rewriteConfigSource(source: string, values: WorkshopConfig): string {
  let out = source;
  for (const [key, value] of Object.entries(values)) {
    const re = new RegExp(`^(\\s{2}${key}:\\s*)(?:"[^"]*"|[^,\\n]+)(,.*)$`, "m");
    if (!re.test(out)) throw new Error(`workshop.config.ts: could not find "${key}: ..." line to rewrite`);
    out = out.replace(re, (_m, pre, post) => `${pre}${JSON.stringify(value)}${post}`);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const n = Number(process.argv[2]);
  if (!(n in presets)) {
    console.error("Usage: npm run step -- <0..7>");
    process.exit(1);
  }
  const file = join(ROOT, "workshop.config.ts");
  writeFileSync(file, rewriteConfigSource(readFileSync(file, "utf8"), presets[n]));
  console.log(`workshop.config.ts set to the stage ${n} preset:`);
  for (const [k, v] of Object.entries(presets[n])) console.log(`  ${k}: ${JSON.stringify(v)}`);
}
