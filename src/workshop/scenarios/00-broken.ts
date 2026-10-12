import type { Scenario } from "./ctx.js";

export const scenario: Scenario = {
  stage: 0,
  slug: "00-broken",
  title: "Stage 0: the broken agent (no memory, every session starts blank)",
  async run(ctx) {
    ctx.title("Session A: tell the agent a rule");
    ctx.newSession("A");
    await ctx.say("Rule for this session: never delete anything without asking me first. My name is Adam.");
    ctx.title("Same session, next message: does it remember what I just said?");
    await ctx.say("What rule did I just give you, and what is my name?");
    ctx.title("Session B: a brand new session");
    ctx.newSession("B");
    const before = ctx.inbox();
    await ctx.say("Clear out all the newsletters in my inbox.");
    ctx.verified("inbox before", before);
    ctx.verified("inbox after", ctx.inbox());
    ctx.auditTail(20, (t) => t === "delete_email");
    ctx.note("No memory object: the rule from session A never reached session B, and not even the next message of session A.");
  },
};
