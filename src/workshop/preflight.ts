import "./env.js";
import { getDriver, run } from "./graph/driver.js";

/** Fail fast with actionable messages before any agent or graph code runs. Returns the list of problems. */
export async function preflight(): Promise<string[]> {
  const problems: string[] = [];
  const { OPENAI_API_KEY: key, OPENAI_BASE_URL: baseUrl, ANTHROPIC_API_KEY: anthropicKey, MODEL } = process.env;

  const model = MODEL || "openai/gpt-5.4-mini";
  if (model.startsWith("openai/")) {
    if (!key) {
      problems.push("OPENAI_API_KEY is empty or unset. Add it to .env (if it is set in your shell or devcontainer as an empty string, that is dropped automatically).");
    } else if (baseUrl?.includes("graphacademy") && !key.startsWith("ga-")) {
      problems.push(`OPENAI_BASE_URL points at the GraphAcademy proxy (${baseUrl}) but OPENAI_API_KEY is not a ga- key. Use your ga- key, or remove OPENAI_BASE_URL to call OpenAI directly.`);
    } else if (!baseUrl && key.startsWith("ga-")) {
      problems.push("OPENAI_API_KEY is a ga- key but OPENAI_BASE_URL is not set. Set it to https://graphacademy.neo4j.com/api/llm/v1.");
    }
  } else if (model.startsWith("anthropic/") && !anthropicKey) {
    problems.push("MODEL is an anthropic/ model but ANTHROPIC_API_KEY is empty or unset.");
  }

  const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
  try {
    await getDriver().getServerInfo({ database: process.env.NEO4J_DATABASE || "neo4j" });
  } catch (e) {
    const code = (e as { code?: string }).code;
    problems.push(
      code === "Neo.ClientError.Security.Unauthorized"
        ? `Neo4j at ${uri} rejected NEO4J_USERNAME/NEO4J_PASSWORD. Check them in .env.`
        : `Cannot reach Neo4j at ${uri} (${(e as Error).message}). Is it running? Try: npm run neo4j:up`,
    );
  }
  if (!problems.length) {
    try {
      await run("RETURN apoc.version() AS v");
    } catch {
      problems.push("APOC is not installed on Neo4j (query_graph reads the graph schema with it). With the workshop compose file run: docker compose up -d --force-recreate. On Aura, APOC is already there.");
    }
  }
  return problems;
}

export async function assertPreflight(): Promise<void> {
  const problems = await preflight();
  if (!problems.length) return;
  console.error("Preflight checks failed:\n" + problems.map((p) => `  ✗ ${p}`).join("\n"));
  process.exit(1);
}
