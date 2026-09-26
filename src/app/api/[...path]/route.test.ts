describe("API proxy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("API_URL", "http://backend.example.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("forwards the explicit data-environment switch header to Rails", async () => {
    const backendFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ environment: "supabase" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const { NextRequest } = await import("next/server");
    const { POST } = await import("@/app/api/[...path]/route");
    const request = new NextRequest("http://frontend.example.test/api/data_environment/switch", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-finch-data-environment-switch": "confirmed",
        "x-csrf-token": "csrf-example",
        origin: "http://frontend.example.test",
        referer: "http://frontend.example.test/settings",
        "x-unrelated": "not-forwarded",
      },
      body: JSON.stringify({ environment: "supabase" }),
    });

    await POST(request, { params: Promise.resolve({ path: ["data_environment", "switch"] }) });

    expect(backendFetch).toHaveBeenCalledWith(
      new URL("http://backend.example.test/api/data_environment/switch"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({}),
      })
    );
    const requestInit = backendFetch.mock.calls[0][1];
    const forwardedHeaders = new Headers(requestInit?.headers);
    expect(forwardedHeaders.get("x-finch-data-environment-switch")).toBe("confirmed");
    expect(forwardedHeaders.get("x-csrf-token")).toBe("csrf-example");
    expect(forwardedHeaders.get("origin")).toBeNull();
    expect(forwardedHeaders.get("referer")).toBeNull();
    expect(forwardedHeaders.get("x-unrelated")).toBeNull();
  });
});
