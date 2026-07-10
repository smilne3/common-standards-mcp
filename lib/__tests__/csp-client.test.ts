import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cspHeaders, cspFetch } from "@/lib/csp-client";

describe("cspHeaders", () => {
  afterEach(() => { delete process.env.CSP_API_KEY; });

  it("omits Api-Key when the env var is unset", () => {
    delete process.env.CSP_API_KEY;
    expect(cspHeaders()["Api-Key"]).toBeUndefined();
  });

  it("omits Api-Key when the env var is blank/whitespace", () => {
    process.env.CSP_API_KEY = "   ";
    expect(cspHeaders()["Api-Key"]).toBeUndefined();
  });

  it("sends Api-Key (trimmed) when the env var is set", () => {
    process.env.CSP_API_KEY = " abc123 ";
    expect(cspHeaders()["Api-Key"]).toBe("abc123");
  });
});

describe("cspFetch", () => {
  beforeEach(() => { delete process.env.CSP_API_KEY; });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("unwraps the top-level `data` envelope", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "X" }] }), { status: 200 })));
    const result = await cspFetch<Array<{ id: string }>>("/jurisdictions");
    expect(result).toEqual([{ id: "X" }]);
  });

  it("throws a descriptive error on a non-200 response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401, statusText: "Unauthorized" })));
    await expect(cspFetch("/jurisdictions")).rejects.toThrow(/401/);
  });

  it("calls the correct base URL and path", async () => {
    const spy = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 }));
    vi.stubGlobal("fetch", spy);
    await cspFetch("/standard_sets/ABC_D1_grade-04");
    expect(spy).toHaveBeenCalledWith(
      "https://api.commonstandardsproject.com/api/v1/standard_sets/ABC_D1_grade-04",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });
});
