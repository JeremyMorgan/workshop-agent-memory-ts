// Append-only log of every tool call the harness actually received.
// This is the ground truth scenarios print, never the agent's own account of what it did.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { AUDIT_FILE, WORKSHOP_DIR } from "../paths.js";

export interface AuditEntry {
  seq: number;
  tool: string;
  args: unknown;
  write: boolean;
  mode: string;
  outcome: string; // "ok" | "dry-run" | "blocked:<gate>" | "error"
}

export function readAudit(): AuditEntry[] {
  if (!existsSync(AUDIT_FILE)) return [];
  return readFileSync(AUDIT_FILE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

export function appendAudit(e: Omit<AuditEntry, "seq">): AuditEntry {
  mkdirSync(WORKSHOP_DIR, { recursive: true });
  const entry = { seq: readAudit().length + 1, ...e };
  appendFileSync(AUDIT_FILE, JSON.stringify(entry) + "\n");
  return entry;
}

export function formatAudit(e: AuditEntry): string {
  return `#${e.seq} ${e.tool}(${JSON.stringify(e.args)}) mode=${e.mode} -> ${e.outcome}`;
}
