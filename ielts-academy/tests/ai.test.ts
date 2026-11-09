import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const state = vi.hoisted(() => ({
  inserts: [] as { table: string; row: Record<string, unknown> }[],
  updates: [] as Record<string, unknown>[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/local/client", () => ({
  ApiError: class extends Error {
    constructor(
      public status: number,
      public code: string,
    ) {
      super(code);
    }
  },
  serviceDb: () => ({
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        state.inserts.push({ table, row });
        return { error: null };
      },
      update: (row: Record<string, unknown>) => ({
        eq: async () => {
          state.updates.push(row);
          return { error: null };
        },
      }),
    }),
  }),
}));
import { evaluateAi } from "@/server/ai";
function client(rejected = false) {
  return {
    rpc: vi.fn(async () => ({
      data: "usage-id",
      error: rejected ? { message: "Denied" } : null,
    })),
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                body: "Isolated student test response",
                writing_tasks: { prompt: "Fixture task", task_number: 2 },
              },
              error: null,
            }),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}
const valid = {
  criteria: { task_response: 7, coherence: 6.5, lexical: 7.5, grammar: 7 },
  feedback: "Estimated feedback",
  grammar_feedback: "Agreement",
  vocabulary_feedback: "Specificity",
  improvements: ["Develop examples"],
};
beforeEach(() => {
  state.inserts = [];
  state.updates = [];
  vi.stubEnv("OPENAI_API_KEY", "isolated-test-placeholder");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("AI provider boundary (mock provider, real response validation)", () => {
  it("stores a validated estimate and token usage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          choices: [{ message: { content: JSON.stringify(valid) } }],
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        }),
      ),
    );
    await expect(evaluateAi(client(), "u", "writing", "s")).resolves.toEqual({
      status: "succeeded",
      estimate: true,
    });
    expect(state.inserts[0].row.band).toBe(7);
    expect(state.inserts[0].row.source).toBe("ai");
    expect(state.updates[0].status).toBe("succeeded");
    expect(state.updates[0].input_tokens).toBe(100);
  });
  it("rejects malformed scores without storing an evaluation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ choices: [{ message: { content: '{"band":99}' } }] }),
      ),
    );
    await expect(evaluateAi(client(), "u", "writing", "s")).rejects.toThrow(
      "ai_unavailable",
    );
    expect(state.inserts).toHaveLength(0);
    expect(state.updates[0].status).toBe("failed");
  });
  it("does not call a provider after quota or consent denial", async () => {
    const provider = vi.fn();
    vi.stubGlobal("fetch", provider);
    await expect(evaluateAi(client(true), "u", "writing", "s")).rejects.toThrow(
      "ai_not_available_or_limit",
    );
    expect(provider).not.toHaveBeenCalled();
  });
  it("handles provider authentication failure without leaking provider text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response("sensitive provider detail", { status: 401 }),
      ),
    );
    await expect(evaluateAi(client(), "u", "writing", "s")).rejects.toThrow(
      "ai_unavailable",
    );
    expect(state.inserts).toHaveLength(0);
    expect(state.updates[0].status).toBe("failed");
  });
  it("fails closed when no API key exists", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const provider = vi.fn();
    vi.stubGlobal("fetch", provider);
    await expect(evaluateAi(client(), "u", "writing", "s")).rejects.toThrow(
      "ai_not_configured",
    );
    expect(provider).not.toHaveBeenCalled();
  });
});
