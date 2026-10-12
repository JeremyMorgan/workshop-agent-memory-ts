import type { Scenario } from "./ctx.js";
import { runForgetfulScript } from "./shared.js";

export const scenario: Scenario = {
  stage: 1,
  slug: "01-forgetful",
  title: "Stage 1: short-term memory, and the rule that falls out of the window",
  async run(ctx) {
    ctx.newSession("S1");
    const { before, after } = await runForgetfulScript(ctx);
    ctx.note(after < before
      ? "FAILURE REPRODUCED: the rule was stated in turn 1, fell out of the history window, and the agent deleted emails."
      : "Failure did not trigger this run: the agent kept the emails. Lower historyWindow or add reads (see docs/DECISIONS.md).");
  },
};
