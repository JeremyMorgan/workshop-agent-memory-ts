import type { Scenario } from "./ctx.js";
import { OVERFLOW_SCRIPT, CLEAR_OUT, RULE } from "./shared.js";

export const scenario: Scenario = {
  stage: 3,
  slug: "03-pinned",
  title: "Stage 3: long-term memory and pinned rules",
  async run(ctx) {
    ctx.title("Part 1: the SAME script as stage 1, with the rule persisted and pinned");
    ctx.newSession("S3a");
    const before = ctx.inbox();
    for (const p of OVERFLOW_SCRIPT) await ctx.say(p);
    ctx.title("Rules now in the graph");
    ctx.table(await ctx.query("allRules"));
    await ctx.say(CLEAR_OUT);
    ctx.verified("inbox before", before);
    ctx.verified("inbox after", ctx.inbox());
    ctx.auditTail(20, (t) => t === "delete_email");
    ctx.note(ctx.inbox() === before ? "The agent suggested but deleted nothing: inbox unchanged." : "Emails were deleted this run (failure not fixed).");

    ctx.title("Part 2: warm-up run writes facts and entities to the graph");
    ctx.newSession("S3b");
    await ctx.say("Look at what is on my calendar on Tuesday and the tickets it relates to. Remember what matters for that meeting.");
    ctx.title("Graph after warm-up");
    ctx.table(await ctx.query("allFacts"));

    ctx.title("Part 3: a FRESH session, memory tools only");
    ctx.newSession("S3c");
    const answer = await ctx.say("What should I prep for Tuesday?", { activeTools: ["query_memory"] });
    ctx.verified("answer mentions the Billing review", String(/billing review/i.test(answer)));
    ctx.verified("answer mentions ENG-142", String(/ENG-142/i.test(answer)));
    void RULE;
  },
};
