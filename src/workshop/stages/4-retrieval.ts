// STAGE 4: similarity, graph walks and exact queries.
// Flag: retrieval = "none" | "semantic" | "graph" | "both".
// The processors put context in front of the model on every question. query_graph is the exact-query route the
// model can choose for counts, absences and exact values, which no amount of similarity can answer.
import { config } from "../../../workshop.config.js";
import { GraphContext } from "../processors/graphContext.js";
import { SemanticContext } from "../processors/semanticContext.js";
import { graphTools } from "../tools/index.js";
import type { Stage } from "./types.js";

const hasRetrieval = config.retrieval !== "none";

export const stage4: Stage = {
  tools: hasRetrieval ? { ...graphTools } : {},
  instructions: hasRetrieval
    ? `\nRetrieved context may be added to the conversation for each question. It is a starting point, not a full answer. For counts, lists, things that have no meeting or owner, or exact values, call query_graph, which runs a read-only query over the saved graph.`
    : "",
  inputProcessors: [new SemanticContext(), new GraphContext()],
};
