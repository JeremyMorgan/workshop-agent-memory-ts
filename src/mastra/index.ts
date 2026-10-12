import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { agent, customTools } from "../agent";
import { STUDIO_DB_FILE } from "../workshop/paths";
import { baseTools, memoryTools } from "../workshop/tools";
import { MastraEditor } from "@mastra/editor";

// Register every agent and tool here so `npm run dev` (Mastra Studio) can see them.
export const mastra = new Mastra({
  agents: { agent },
  tools: { ...baseTools, ...memoryTools, ...customTools },
  storage: new LibSQLStore({ id: "mastra-storage", url: `file:${STUDIO_DB_FILE}` }),
  editor: new MastraEditor(),
});
