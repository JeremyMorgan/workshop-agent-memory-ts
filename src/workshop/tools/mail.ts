import { z } from "zod";
import { deleteEmail, loadState, recordSent } from "../nsuite/state.js";
import { real } from "../nsuite/real.js";
import { runtime } from "../runtime.js";
import { spec } from "./spec.js";

export const list_emails = spec({
  id: "list_emails",
  description: "List emails in the inbox. Optionally filter by sender (name or address substring) or unread status.",
  schema: z.object({ sender: z.string().optional(), unread: z.boolean().optional() }),
  write: false,
  mock: ({ sender, unread }) => {
    const emails = loadState().emails
      .filter((e) => !sender || `${e.sender_name} ${e.sender}`.toLowerCase().includes(sender.toLowerCase()))
      .filter((e) => unread === undefined || e.unread === unread)
      .map((e) => ({ id: e.id, sender: e.sender, subject: e.subject, snippet: e.snippet }));
    return { count: emails.length, emails };
  },
});

export const read_email = spec({
  id: "read_email",
  description: "Read one email by id: headers (from, to, cc, thread) and full body.",
  schema: z.object({ id: z.string() }),
  write: false,
  mock: ({ id }) => {
    const e = loadState().emails.find((x) => x.id === id);
    if (!e) return { error: `No email with id ${id}` };
    runtime.emailsRead.set(e.id, { id: e.id, sender: e.sender, subject: e.subject, body: e.body });
    return {
      id: e.id, sender: e.sender, from: e.from, to: e.to, cc: e.cc, bcc: e.bcc, subject: e.subject, date: e.date,
      message_id: e.message_id, thread_id: e.thread_id, in_reply_to: e.in_reply_to, body: e.body,
    };
  },
});

export const delete_email = spec({
  id: "delete_email",
  description: "Permanently delete one email by id.",
  schema: z.object({ id: z.string() }),
  write: true,
  mock: ({ id }) => deleteEmail(id),
  dryRun: ({ id }) => ({ deleted: true, remaining: loadState().emails.length, dryRun: true, id }),
  real: (a) => real.delete_email(a),
});

export const send_message = spec({
  id: "send_message",
  description: "Send a message to a person by email address.",
  schema: z.object({ to: z.string(), text: z.string() }),
  write: true,
  mock: ({ to, text }) => ({ ...recordSent(to, text), to }),
  real: (a) => real.send_message(a),
});
