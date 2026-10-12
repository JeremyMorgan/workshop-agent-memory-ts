// STAGE 5: a tool gate for send_message. Only allowlisted recipients can be contacted.
import { allowedRecipients, config } from "../../../workshop.config.js";
import type { Guard, GuardBlock } from "../tools/guards.js";

const address = (to: string) => (to.match(/<([^>]+)>/)?.[1] ?? to).trim().toLowerCase();

export function checkRecipient(tool: string, args: { to?: string }, allowed = allowedRecipients): GuardBlock | null {
  if (tool !== "send_message") return null;
  const to = address(String(args?.to ?? ""));
  if (allowed.map((a) => a.toLowerCase()).includes(to)) return null;
  return {
    status: "blocked",
    gate: "recipient_allowlist",
    tool,
    message: `Recipient "${to}" is not on the allowlist, so nothing was sent. Tell the user; do not try another route.`,
  };
}

export const recipientAllowlist: Guard = ({ tool, args }) => (config.recipientAllowlist ? checkRecipient(tool, args) : null);
