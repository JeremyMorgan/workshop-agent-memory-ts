import type { Scenario } from "./ctx.js";
import { runForgetfulScript } from "./shared.js";

export const scenario: Scenario = {
  stage: 2,
  slug: "02-traces",
  title: "Stage 2: context traces show exactly when the rule left the window",
  async run(ctx) {
    const sessionId = ctx.newSession("S2");
    await runForgetfulScript(ctx);
    ctx.title("Neo4j: was the rule's Message in context at each step?");
    ctx.table(await ctx.query("ruleInContextByStep", { sessionId }));
    ctx.title("Neo4j: first delete_email step, and the last step that still had the rule");
    ctx.table(await ctx.query("firstDeleteStep", { sessionId }));
    const [row] = await ctx.query("ruleAtFirstDelete", { sessionId });
    ctx.table(row ? [row] : []);
    if (row) {
      ctx.verified("last step with the rule in context", String(row.lastStepWithRule));
      ctx.verified("first delete_email step", String(row.firstDeleteStep));
      ctx.note(row.ruleHadLeftContext
        ? `The rule was in context up to step ${row.lastStepWithRule} and gone by step ${row.firstDeleteStep}, the first delete_email.`
        : "The rule was still in context at the first delete (failure did not reproduce this run).");
    }
  },
};
