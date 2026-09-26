import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("API CSRF client", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches one token in memory and sends it with mutations", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "token-1" }), {
        headers: { "content-type": "application/json" },
      }))
      .mockImplementation(async () => new Response("{}", {
        headers: { "content-type": "application/json" },
      }));
    const { api } = await import("@/lib/api");

    await api("/api/cards", { method: "POST", body: "{}" });
    await api("/api/cards/1", { method: "PATCH", body: "{}" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/csrf");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "include", cache: "no-store" });
    for (const call of fetchMock.mock.calls.slice(1)) {
      expect(new Headers(call[1]?.headers).get("x-csrf-token")).toBe("token-1");
      expect(call[1]?.credentials).toBe("include");
    }
  });

  it("does not request a token for reads", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { headers: { "content-type": "application/json" } })
    );
    const { api } = await import("@/lib/api");

    await api("/api/me");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/me");
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).has("x-csrf-token")).toBe(false);
  });

  it("invalidates a rejected token without repeating the mutation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "token-1" }), {
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "CSRF token invalid" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "token-2" }), {
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response("{}", { headers: { "content-type": "application/json" } }));
    const { api } = await import("@/lib/api");

    await expect(api("/api/cards", { method: "POST", body: "{}" })).rejects.toThrow("CSRF token invalid");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await api("/api/cards", { method: "POST", body: "{}" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(new Headers(fetchMock.mock.calls[3][1]?.headers).get("x-csrf-token")).toBe("token-2");
  });

  it("gets a new token after a successful login changes the session", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "before-login" }), {
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response("{}", { headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "after-login" }), {
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response("{}", { headers: { "content-type": "application/json" } }));
    const { api } = await import("@/lib/api");

    await api("/api/login", { method: "POST", body: "{}" });
    await api("/api/me", { method: "PATCH", body: "{}" });

    expect(fetchMock.mock.calls[2][0]).toBe("/api/csrf");
    expect(new Headers(fetchMock.mock.calls[3][1]?.headers).get("x-csrf-token")).toBe("after-login");
  });
});
