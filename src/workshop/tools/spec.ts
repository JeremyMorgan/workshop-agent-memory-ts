import type { z } from "zod";

/**
 * A tool as plain data. tools/index.ts turns specs into Mastra tools and wraps every call with
 * the audit log and the MODE switch (mock | dry-run | real) for writes.
 */
export interface ToolSpec<S extends z.ZodType = z.ZodType> {
  id: string;
  description: string;
  schema: S;
  /** WRITE tools go through the MODE switch. Reads are always allowed. */
  write: boolean;
  /** Runs against the seeded fake apps (or the graph for memory tools). */
  mock: (args: z.infer<S>) => unknown | Promise<unknown>;
  /** Optional hand-written dry-run result. Default: `{ ok: true, dryRun: true, ...args }`. */
  dryRun?: (args: z.infer<S>) => unknown;
  /** Real implementation (src/workshop/nsuite/real.ts). Omit when mock and real are the same thing. */
  real?: (args: z.infer<S>) => unknown | Promise<unknown>;
}
export const spec = <S extends z.ZodType>(s: ToolSpec<S>) => s;
