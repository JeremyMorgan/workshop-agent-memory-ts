// Helpers shared by every scenario. Anything a scenario wants the room to see goes through out().
import { randomUUID } from "node:crypto";
import { config, type WorkshopConfig } from "../../../workshop.config.js";
import { runQuery, type QueryName } from "../graph/queries.js";
import { formatAudit, readAudit } from "../nsuite/audit.js";
import { loadState } from "../nsuite/state.js";
import { newSession, runtime } from "../runtime.js";
import { out, printStep } from "../ui.js";
import type { TurnOptions } from "../turn.js";

export interface Ctx {
  title(t: string): void;
  note(t: string): void;
  newSession(label?: string): string;
  say(prompt: string, opts?: Omit<TurnOptions, "onStep">): Promise<string>;
  inbox(): number;
  sent(): { to: string; text: string }[];
  /** A fact straight from the harness. Never the agent's own account. */
  verified(label: string, value: string | number): void;
  auditTail(n?: number, filter?: (tool: string) => boolean): void;
  setConfig(patch: Partial<WorkshopConfig>): void;
  query(name: QueryName, params?: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  table(rows: Record<string, unknown>[]): void;
  injected(): string[];
  /** What memory handed to the model during the last say(), and what the trust filter held back. */
  memoryServed(): { served: string[]; withheld: string[] };
}

export async function makeCtx(): Promise<Ctx> {
  const { runTurn } = await import("../../agent.js");
  return {
    title: (t) => { out(""); out(`━━ ${t} ━━`); },
    note: (t) => out(`  # ${t}`),
    newSession(label) {
      const id = `${label ?? "s"}-${randomUUID().slice(0, 6)}`;
      newSession(id);
      out(`\n── session ${id} ──`);
      return id;
    },
    async say(prompt, opts = {}) {
      runtime.factsServed = [];
      runtime.factsWithheld = [];
      out(`\nyou> ${prompt}`);
      const res = await runTurn(prompt, { ...opts, onStep: printStep });
      out(`agent> ${res.text.trim()}`);
      return res.text;
    },
    inbox: () => loadState().emails.length,
    sent: () => loadState().sent_messages,
    verified: (label, value) => out(`  ✔ HARNESS ${label}: ${value}`),
    auditTail(n = 20, filter) {
      const entries = readAudit().filter((e) => !filter || filter(e.tool)).slice(-n);
      out(`  audit log${entries.length ? "" : " (no matching entries)"}:`);
      entries.forEach((e) => out("    " + formatAudit(e)));
    },
    setConfig: (patch) => { Object.assign(config, patch); },
    query: (name, params) => runQuery(name, params) as Promise<Record<string, unknown>[]>,
    table(rows) {
      if (!rows.length) return out("    (no rows)");
      const cols = Object.keys(rows[0]);
      out("    " + cols.join(" | "));
      for (const r of rows) out("    " + cols.map((c) => String(r[c] ?? "")).join(" | "));
    },
    injected: () => [...runtime.injected],
    memoryServed: () => ({ served: [...runtime.factsServed], withheld: [...runtime.factsWithheld] }),
  };
}

export interface Scenario {
  stage: number;
  slug: string;
  title: string;
  /** Preset applied before the scenario runs (default: the stage preset). */
  preset?: number;
  /** Model override for scenarios that need a specific behaviour (env POISON_MODEL wins). */
  model?: string;
  run(ctx: Ctx): Promise<void>;
}
