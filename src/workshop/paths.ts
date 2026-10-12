import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Project root, found by walking up to this project's package.json. Not a fixed `..`, because
 * `mastra dev` bundles the code into .mastra/output, where the file sits at a different depth.
 */
function findRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg)) {
      try {
        if (JSON.parse(readFileSync(pkg, "utf8")).name === "agent-memory-workshop") return dir;
      } catch {}
    }
    dir = dirname(dir);
  }
  return process.cwd();
}

export const ROOT = findRoot();
export const WORKSHOP_DIR = join(ROOT, ".workshop");
mkdirSync(WORKSHOP_DIR, { recursive: true });
export const STATE_FILE = join(WORKSHOP_DIR, "state.json");
export const AUDIT_FILE = join(WORKSHOP_DIR, "audit.jsonl");
export const MASTRA_DB_FILE = join(WORKSHOP_DIR, "mastra.db");
export const STUDIO_DB_FILE = join(WORKSHOP_DIR, "mastra-studio.db");
export const SEED_FILE = join(ROOT, "src", "workshop", "nsuite", "seed.json");
export const RECORDINGS_DIR = join(ROOT, "recordings");
