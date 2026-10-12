// STAGE 7: real implementations. These are stubs that throw until you wire them up.
// See README "Stage 7" for how to replace one with a real API call.
export class NotConfigured extends Error {
  constructor(what: string) {
    super(`${what}: real mode is not configured. Implement it in src/workshop/nsuite/real.ts (see README, stage 7).`);
  }
}

export const real = {
  delete_email: async (_args: { id: string }): Promise<never> => {
    throw new NotConfigured("delete_email");
  },
  send_message: async (_args: { to: string; text: string }): Promise<never> => {
    throw new NotConfigured("send_message");
  },
  update_event: async (_args: { id: string; time?: string; attendees?: string[] }): Promise<never> => {
    throw new NotConfigured("update_event");
  },
  update_issue: async (_args: { id: string; status?: string; owner?: string }): Promise<never> => {
    throw new NotConfigured("update_issue");
  },
  // Reads: only used when REAL_READS=1 and mode is "real".
  list_emails: async (_args: unknown): Promise<never> => {
    throw new NotConfigured("list_emails");
  },
  read_email: async (_args: unknown): Promise<never> => {
    throw new NotConfigured("read_email");
  },
  get_events: async (_args: unknown): Promise<never> => {
    throw new NotConfigured("get_events");
  },
  list_issues: async (_args: unknown): Promise<never> => {
    throw new NotConfigured("list_issues");
  },
  get_issue: async (_args: unknown): Promise<never> => {
    throw new NotConfigured("get_issue");
  },
} as const;
