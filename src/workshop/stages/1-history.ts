// STAGE 1: short-term memory (message history window).
// Flag: history, historyWindow. Mastra keeps the last N stored messages in context; older ones fall out.
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import { config } from "../../../workshop.config.js";
import { MASTRA_DB_FILE } from "../paths.js";
import type { Stage } from "./types.js";

export const stage1: Stage = {
  memory: config.history
    ? new Memory({
        storage: new LibSQLStore({ id: "workshop-memory", url: `file:${MASTRA_DB_FILE}` }),
        options: {
          lastMessages: config.historyWindow, // tool calls and results count as messages
          semanticRecall: false,
          workingMemory: { enabled: false },
          generateTitle: false,
        },
      })
    : undefined,
};
