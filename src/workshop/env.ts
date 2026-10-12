import { config as loadEnv } from "dotenv";
import { join } from "node:path";
import { ROOT } from "./paths.js";

loadEnv({ path: join(ROOT, ".env"), quiet: true });

export const MODEL = process.env.MODEL || "openai/gpt-5.6-sol";
export const EXTRACTION_MODEL = process.env.EXTRACTION_MODEL || "openai/gpt-5.4-mini";
