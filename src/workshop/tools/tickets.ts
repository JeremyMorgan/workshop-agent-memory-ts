import { z } from "zod";
import { loadState, updateIssue, withWeekday } from "../nsuite/state.js";
import { real } from "../nsuite/real.js";
import { spec } from "./spec.js";

const view = (i: ReturnType<typeof loadState>["issues"][number]) => ({
  id: i.id, title: i.title, owner: i.owner, status: i.status, eta: withWeekday(i.eta), blocked_by: i.blocked_by, description: i.description,
});

export const list_issues = spec({
  id: "list_issues",
  description: "List tickets, optionally filtered by owner or status (todo, in_progress, done).",
  schema: z.object({ owner: z.string().optional(), status: z.string().optional() }),
  write: false,
  mock: ({ owner, status }) => ({
    issues: loadState().issues
      .filter((i) => !owner || i.owner.toLowerCase() === owner.toLowerCase())
      .filter((i) => !status || i.status === status)
      .map(view),
  }),
});

export const get_issue = spec({
  id: "get_issue",
  description: "Get one ticket by id, including its owner and the tickets blocking it (blocked_by).",
  schema: z.object({ id: z.string() }),
  write: false,
  mock: ({ id }) => {
    const i = loadState().issues.find((x) => x.id.toLowerCase() === id.toLowerCase());
    return i ? view(i) : { error: `No issue with id ${id}` };
  },
});

export const update_issue = spec({
  id: "update_issue",
  description: "Change a ticket's status or owner.",
  schema: z.object({ id: z.string(), status: z.string().optional(), owner: z.string().optional() }),
  write: true,
  mock: ({ id, ...patch }) => updateIssue(id, patch) ?? { error: `No issue with id ${id}` },
  real: (a) => real.update_issue(a),
});
