import { z } from "zod";
import { loadState, updateEvent } from "../nsuite/state.js";
import { real } from "../nsuite/real.js";
import { spec } from "./spec.js";

export const get_events = spec({
  id: "get_events",
  description:
    "Get calendar events for a day. `date` is an ISO date (YYYY-MM-DD) or a weekday name such as Tuesday. Returns title, description, attendees and linked ticket ids.",
  schema: z.object({ date: z.string() }),
  write: false,
  mock: ({ date }) => {
    const d = date.trim().toLowerCase();
    const events = loadState().events
      .filter((e) => e.date === date.trim() || e.day.toLowerCase() === d)
      .map((e) => ({ id: e.id, title: e.title, date: e.date, day: e.day, time: e.time, description: e.description, attendees: e.attendees, tickets: e.tickets }));
    return { events };
  },
});

export const update_event = spec({
  id: "update_event",
  description: "Change an event's time or attendee list.",
  schema: z.object({ id: z.string(), time: z.string().optional(), attendees: z.array(z.string()).optional() }),
  write: true,
  mock: ({ id, ...patch }) => updateEvent(id, patch) ?? { error: `No event with id ${id}` },
  real: (a) => real.update_event(a),
});
