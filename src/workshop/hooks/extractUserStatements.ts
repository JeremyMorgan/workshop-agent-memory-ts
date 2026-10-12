// STAGE 3: one structured-output LLM call per user turn that pulls out durable facts and standing rules
// the user stated, and persists them to the graph. Runs before the first model step of the turn so a rule
// stated in this turn is already pinned for this turn.
import { Agent } from "@mastra/core/agent";
import type { Processor, ProcessInputArgs } from "@mastra/core/processors";
import { z } from "zod";
import { config } from "../../../workshop.config.js";
import { EXTRACTION_MODEL } from "../env.js";
import { applyExtraction, hasContent, poleSchema } from "../graph/pole.js";
import { upsertFact, upsertMessage, upsertRule } from "../graph/store.js";
import { runtime } from "../runtime.js";

export const TOOL_NAMES = ["delete_email", "send_message", "update_event", "update_issue"] as const;

export const extractionSchema = z.object({
  facts: z.array(z.string()).describe("Other durable facts the user stated about their work or their world (not preferences, not things captured as entities). Not questions, not one-off requests."),
  rules: z.array(z.object({
    tool: z.enum(TOOL_NAMES),
    mode: z.enum(["require_approval", "forbid"]),
    statement: z.string().describe("The user's own words for the rule"),
  })).describe("Standing instructions about how tools may be used, for example 'never delete anything without asking me first'."),
  ...poleSchema.shape,
});

let extractor: Agent | undefined;
const getExtractor = () =>
  (extractor ??= new Agent({
    id: "statement-extractor",
    name: "statement-extractor",
    model: EXTRACTION_MODEL as any,
    instructions: `You extract what a user STATES, from a single message sent to their assistant.
Return user: the user's own name, a fun fact they share about themselves, and preferences about how they like things done ("I prefer short summaries").
Return entities and relations using POLE+O: Person, Object, Location, Event, Organization. Entities are things the user mentions other than themself. Relations connect the user (write "user") or an entity to another entity, with type LIVES_IN, WORKS_AT, KNOWS, OWNS, PARTICIPATES_IN, LOCATED_IN or RELATED_TO. Examples: "I live in Leeds" gives entity Location "Leeds" and relation user LIVES_IN Leeds; "I work at Neo4j" gives Organization "Neo4j" and user WORKS_AT Neo4j; "my manager Priya" gives Person "Priya" and user KNOWS Priya; "Dana works at Contoso" gives Person "Dana", Organization "Contoso" and Dana WORKS_AT Contoso. Every relation endpoint must also appear in entities (except "user").
Return facts: other durable things the user says about their team or their situation that are not preferences or entities (for example "Dana is our biggest customer").
Return rules: standing instructions about how the assistant may use its tools (tools: ${TOOL_NAMES.join(", ")}). "Never delete anything without asking me first" is {tool: delete_email, mode: require_approval}. "Don't ever message customers" is {tool: send_message, mode: forbid}.
A rule exists ONLY when the user explicitly states a standing restriction or requirement about future behaviour (words like never, always, don't ever, from now on, rule). A request to do something now is NOT a rule, and neither is permission or instructions about THIS request: "send it now, no need to confirm" is not a rule. Never turn a request to use a tool into a forbid rule.
Do NOT extract: questions, one-off task requests ("clear out the newsletters", "read Dana's emails"), or anything the user did not say. If there is nothing, return empty arrays.`,
  }));

export async function extractStatements(text: string) {
  const res = await getExtractor().generate(text, { structuredOutput: { schema: extractionSchema } });
  return (res.object ?? { facts: [], rules: [], user: { preferences: [] }, entities: [], relations: [] }) as z.infer<typeof extractionSchema>;
}

export class ExtractUserStatements implements Processor {
  id = "extract-user-statements";
  async processInput({ messageList }: ProcessInputArgs) {
    if (!config.extractUserStatements || !runtime.userText.trim() || !runtime.userMessageId) return messageList;
    const { facts, rules, ...pole } = await extractStatements(runtime.userText);
    if (!facts.length && !rules.length && !hasContent(pole)) return messageList;
    await upsertMessage({ id: runtime.userMessageId, role: "user", text: runtime.userText, turn: runtime.turn, sessionId: runtime.sessionId });
    for (const r of rules) {
      await upsertRule({ tool: r.tool, mode: r.mode, source: "user", turn: runtime.turn, text: r.statement, messageId: runtime.userMessageId });
    }
    await applyExtraction(pole);
    for (const f of facts) {
      await upsertFact({ text: f, source: "user", trust: "high", messageId: runtime.userMessageId });
    }
    return messageList;
  }
}
