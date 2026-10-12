// STAGE 4: graph retrieval vs flat semantic recall.
// Flag: retrieval = "none" | "semantic" | "graph" | "both".
import { GraphContext } from "../processors/graphContext.js";
import { SemanticContext } from "../processors/semanticContext.js";
import type { Stage } from "./types.js";

export const stage4: Stage = {
  inputProcessors: [new SemanticContext(), new GraphContext()],
};
