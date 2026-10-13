// npm run test:llm: live calls to the configured LLM endpoint (OPENAI_API_KEY / OPENAI_BASE_URL).
// Kept out of `npm test`, which makes no LLM calls.
import assert from "node:assert/strict";
import { test } from "node:test";
import { Agent } from "@mastra/core/agent";
import { MODEL, EXTRACTION_MODEL, modelConfig } from "../../src/workshop/env.js";

const baseURL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const apiKey = process.env.OPENAI_API_KEY;
const bareModel = (m: string) => m.replace(/^openai\//, "");

test("OPENAI_API_KEY is loaded from .env", () => {
  assert.ok(apiKey, "OPENAI_API_KEY is not set");
});

test("chat completions endpoint accepts the API key", async () => {
  const res = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: bareModel(EXTRACTION_MODEL),
      messages: [{ role: "user", content: "Reply with the single word: pong" }],
    }),
  });
  const body = await res.text();
  assert.equal(res.status, 200, `${baseURL} returned ${res.status}: ${body.slice(0, 300)}`);
  const json = JSON.parse(body);
  assert.ok(json.choices?.[0]?.message?.content, "no completion content returned");
});

test("Mastra agent completes using MODEL", async () => {
  const agent = new Agent({
    id: "llm-smoke",
    name: "llm-smoke",
    instructions: "Reply with one word.",
    model: modelConfig(MODEL),
  });
  const out = await agent.generate("Say: pong");
  assert.ok(out.text.trim().length > 0, "empty agent response");
});
