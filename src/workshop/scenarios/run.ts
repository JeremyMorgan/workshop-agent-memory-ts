// npm run scenario -- N [--record] [--replay] [--no-preset] [--fast]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "../../../workshop.config.js";
import { RECORDINGS_DIR } from "../paths.js";
import { out, setSink } from "../ui.js";
import { applyPresetInMemory } from "../harness/presets.js";
import type { Scenario } from "./ctx.js";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const n = Number(args.find((a) => !a.startsWith("--")));
const SLUGS = ["00-broken", "01-forgetful", "02-traces", "03-pinned", "04-graph", "05-guardrails", "06-poisoning"];

if (!Number.isInteger(n) || n < 0 || n >= SLUGS.length) {
  console.error(`Usage: npm run scenario -- <0..6> [--record] [--replay] [--no-preset] [--fast]\n  ${SLUGS.join("\n  ")}`);
  process.exit(1);
}
const slug = SLUGS[n];
const recordingFile = join(RECORDINGS_DIR, `${slug}.json`);

if (flags.has("--replay")) {
  if (!existsSync(recordingFile)) {
    console.error(`No recording at ${recordingFile}. Run once with --record first.`);
    process.exit(1);
  }
  const rec = JSON.parse(readFileSync(recordingFile, "utf8")) as { title: string; recordedAt: string; model: string; lines: string[] };
  console.log(`[REPLAY of a recorded run, ${rec.recordedAt}, model ${rec.model}. No model or Neo4j calls are made.]\n${rec.title}`);
  for (const line of rec.lines) {
    console.log(line);
    if (!flags.has("--fast")) await new Promise((r) => setTimeout(r, line.startsWith("  ⚙") ? 350 : line.startsWith("agent>") ? 900 : 60));
  }
  process.exit(0);
}

const { scenario } = (await import(`./${slug}.js`)) as { scenario: Scenario };
if (scenario.model || (n === 6 && process.env.POISON_MODEL)) process.env.MODEL = (n === 6 && process.env.POISON_MODEL) || scenario.model!; // before env.ts is loaded
const { resetAll } = await import("../harness/reset.js");
const { closeDriver } = await import("../graph/driver.js");
const { makeCtx } = await import("./ctx.js");
const { MODEL } = await import("../env.js");

if (!flags.has("--no-preset")) {
  applyPresetInMemory(scenario.preset ?? scenario.stage);
  config.onboarding = false; // scripted runs start with a task, not an introduction
}
const lines: string[] = [];
setSink((l) => { lines.push(l); console.log(l); });

try {
  out(scenario.title);
  out(`config: ${JSON.stringify(config)}`);
  await resetAll();
  out("(reset: nsuite state restored, graph and message history cleared)");
  const ctx = await makeCtx();
  await scenario.run(ctx);
  if (flags.has("--record")) {
    mkdirSync(RECORDINGS_DIR, { recursive: true });
    writeFileSync(recordingFile, JSON.stringify({ title: scenario.title, recordedAt: new Date().toISOString(), model: MODEL, config, lines }, null, 2) + "\n");
    console.log(`\nrecorded -> ${recordingFile}`);
  }
} finally {
  await closeDriver();
}
