import { config as loadEnv } from "dotenv";
import { join } from "node:path";
import { ROOT } from "./paths.js";

loadEnv({ path: join(ROOT, ".env"), quiet: true });

export const MODEL = process.env.MODEL || "openai/gpt-5.4-mini";
export const EXTRACTION_MODEL = process.env.EXTRACTION_MODEL || "openai/gpt-5.4-nano";

/**
 * Model config for Mastra. OpenAI-compatible proxies (OPENAI_BASE_URL, e.g. the GraphAcademy proxy) only
 * serve /chat/completions, while Mastra's `openai/*` default is the Responses API, so force chat there.
 * OPENAI_BASE_URL and OPENAI_API_KEY themselves are read from the environment by the OpenAI provider.
 *
 * TODO(GRAC-600): once the proxy serves /v1/responses, remove this chat override and use the Responses API
 * (Mastra's default) everywhere. Also point test/llm/llm.test.ts at /responses and drop the chat-only note.
 */
export function modelConfig(id: string): any {
  if (process.env.OPENAI_BASE_URL && id.startsWith("openai/")) {
    return { id, url: process.env.OPENAI_BASE_URL, apiKey: process.env.OPENAI_API_KEY, api: "chat" };
  }
  return id;
}
