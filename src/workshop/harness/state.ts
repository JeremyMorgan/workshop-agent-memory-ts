// npm run state: what is actually true in the fake apps, straight from the harness (not from the agent).
import { formatAudit, readAudit } from "../nsuite/audit.js";
import { loadState } from "../nsuite/state.js";

export function stateSummary() {
  const s = loadState();
  const audit = readAudit();
  return { inbox: s.emails.length, sent: s.sent_messages, audit };
}

if (process.argv[1]?.endsWith("state.ts")) {
  const { inbox, sent, audit } = stateSummary();
  console.log(`inbox: ${inbox} emails`);
  console.log(`messages sent: ${sent.length}${sent.map((m) => `\n  -> ${m.to}: ${m.text}`).join("")}`);
  console.log(`audit log (last 20 of ${audit.length}):`);
  audit.slice(-20).forEach((e) => console.log("  " + formatAudit(e)));
}
