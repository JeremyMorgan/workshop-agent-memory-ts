// Harness side of the fake apps ("Nsuite"). NOT exposed to the agent.
// State lives in .workshop/state.json. `resetState()` rewrites it from seed.json
// byte-identically, so a reset always restores exactly the same world.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { AUDIT_FILE, SEED_FILE, STATE_FILE, WORKSHOP_DIR } from "../paths.js";

export interface Email {
  id: string; sender: string; sender_name: string;
  /** "Name <address>" */ from: string; to: string[]; cc: string[]; bcc: string[];
  message_id: string; thread_id: string; in_reply_to: string | null;
  subject: string; date: string; unread: boolean; snippet: string; body: string; category: string;
}
export interface CalEvent {
  id: string; title: string; date: string; day: string; time: string;
  description: string; attendees: string[]; tickets: string[];
}
export interface Issue {
  id: string; title: string; owner: string; status: string; eta: string | null;
  blocked_by: string[]; description: string;
}
export interface SentMessage { to: string; text: string; ts: number }
/** A customer account, matched to people and emails by domain and name. */
export interface Customer { id: string; name: string; domains: string[] }
/** A customer's project, and the tickets that are worked on for it. */
export interface Project { id: string; name: string; customer: string; issues: string[] }
export interface NsuiteState {
  today: string; today_name: string;
  people: Record<string, { name: string; email: string; role: string }>;
  emails: Email[]; sent_messages: SentMessage[]; events: CalEvent[]; issues: Issue[];
  customers: Customer[]; projects: Project[];
}

/** The seed text exactly as it is on disk; reset copies it verbatim. */
export function seedText(): string {
  return readFileSync(SEED_FILE, "utf8");
}
export function loadSeed(): NsuiteState {
  return JSON.parse(seedText());
}

export function resetState(): void {
  mkdirSync(WORKSHOP_DIR, { recursive: true });
  writeFileSync(STATE_FILE, seedText());
  rmSync(AUDIT_FILE, { force: true });
}

export function loadState(): NsuiteState {
  if (!existsSync(STATE_FILE)) resetState();
  return JSON.parse(readFileSync(STATE_FILE, "utf8"));
}
export function saveState(s: NsuiteState): void {
  mkdirSync(WORKSHOP_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + "\n");
}

// ── Real (mock-mode) mutations ───────────────────────────────────────────────
export function deleteEmail(id: string): { deleted: boolean; remaining: number } {
  const s = loadState();
  const before = s.emails.length;
  s.emails = s.emails.filter((e) => e.id !== id);
  saveState(s);
  return { deleted: s.emails.length < before, remaining: s.emails.length };
}
export function recordSent(to: string, text: string): { sent: boolean } {
  const s = loadState();
  s.sent_messages.push({ to, text, ts: s.sent_messages.length });
  saveState(s);
  return { sent: true };
}
export function updateEvent(id: string, patch: { time?: string; attendees?: string[] }): CalEvent | null {
  const s = loadState();
  const ev = s.events.find((e) => e.id === id);
  if (!ev) return null;
  if (patch.time !== undefined) ev.time = patch.time;
  if (patch.attendees !== undefined) ev.attendees = patch.attendees;
  saveState(s);
  return ev;
}
export function updateIssue(id: string, patch: { status?: string; owner?: string }): Issue | null {
  const s = loadState();
  const it = s.issues.find((i) => i.id === id);
  if (!it) return null;
  if (patch.status !== undefined) it.status = patch.status;
  if (patch.owner !== undefined) it.owner = patch.owner;
  saveState(s);
  return it;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** "2025-06-12" -> "Thursday 2025-06-12". Models are bad at weekday arithmetic, so we do it in code. */
export const withWeekday = (iso: string | null): string | null =>
  iso ? `${DAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()]} ${iso}` : null;
