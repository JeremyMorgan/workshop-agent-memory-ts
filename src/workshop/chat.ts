// npm run chat: interactive REPL.  Commands: /new /state /approve /flags /quit
import { createInterface } from "node:readline/promises";
import { config } from "../../workshop.config.js";
import { runTurn } from "../agent.js";
import { closeDriver } from "./graph/driver.js";
import { formatAudit, readAudit } from "./nsuite/audit.js";
import { loadState } from "./nsuite/state.js";
import { approvals } from "./processors/approvalGate.js";
import { newSession } from "./runtime.js";
import { out, printStep } from "./ui.js";
import { randomUUID } from "node:crypto";

const startSession = () => {
  const id = `s-${randomUUID().slice(0, 8)}`;
  newSession(id);
  out(`── new session ${id} ──`);
};

out("Workshop agent. Flags:\n" + JSON.stringify(config, null, 2));
out("Commands: /new (fresh session)  /state  /approve [id]  /flags  /quit\n");
startSession();

const rl = createInterface({ input: process.stdin, output: process.stdout });
try {
  while (true) {
    const line = (await rl.question("\nyou> ")).trim();
    if (!line) continue;
    if (line === "/quit" || line === "/exit") break;
    if (line === "/new") { startSession(); continue; }
    if (line === "/flags") { out(JSON.stringify(config, null, 2)); continue; }
    if (line === "/state") {
      const s = loadState();
      out(`inbox: ${s.emails.length}  sent: ${s.sent_messages.length}\n` + readAudit().slice(-10).map(formatAudit).join("\n"));
      continue;
    }
    if (line.startsWith("/approve")) {
      const id = line.split(/\s+/)[1];
      const tools = approvals.approve(id);
      out(tools.length ? `approved: ${tools.join(", ")} (the agent can retry now)` : "nothing pending");
      continue;
    }
    try {
      const res = await runTurn(line, { onStep: printStep });
      out(`\nagent> ${res.text}`);
    } catch (err) {
      out(`error: ${err instanceof Error ? err.message : err}`);
    }
  }
} finally {
  rl.close();
  await closeDriver();
}
