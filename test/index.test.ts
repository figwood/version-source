import { describe, expect, it } from "vitest";
import worker, { createWorker } from "../src/index";

const env = { MOCK_CATALOG_TOKEN: "secret" };

function request(path: string, token?: string, method = "GET") {
  const headers = token === undefined ? undefined : { Authorization: `Bearer ${token}` };
  return worker.fetch(new Request(`https://example.test${path}`, { method, headers }), env);
}

describe("catalog worker", () => {
  it("serves health without authentication", async () => {
    const response = await request("/catalog/v1/health");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it.each([undefined, "wrong"])("rejects a missing or incorrect token", async (token) => {
    const response = await request("/catalog/v1/services", token);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("fails closed when the secret is blank", async () => {
    const response = await worker.fetch(
      new Request("https://example.test/catalog/v1/services"),
      { MOCK_CATALOG_TOKEN: " " },
    );
    expect(response.status).toBe(401);
  });

  it("lists filtered and paginated services", async () => {
    const response = await request("/catalog/v1/services?query=api&pageSize=1", "secret");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [{ id: "payments-api", name: "payments-api" }],
      page: 1,
      pageSize: 1,
      total: 5,
      totalPages: 5,
    });
  });

  it("defaults version pages to 10 items", async () => {
    const versions = Array.from({ length: 11 }, (_, index) => ({
      id: `v${index + 1}`,
      name: `Version ${index + 1}`,
    }));
    const versionWorker = createWorker([{ id: "service", name: "Service", versions }]);
    const response = await versionWorker.fetch(
      new Request("https://example.test/catalog/v1/services/service/versions", {
        headers: { Authorization: "Bearer secret" },
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: versions.slice(0, 10),
      page: 1,
      pageSize: 10,
      total: 11,
      totalPages: 2,
    });
  });

  it("lists versions for an encoded service ID", async () => {
    const slashWorker = createWorker([{ id: "a/b", name: "Slash", versions: [{ id: "v1", name: "V1" }] }]);
    const response = await slashWorker.fetch(
      new Request("https://example.test/catalog/v1/services/a%2Fb/versions", {
        headers: { Authorization: "Bearer secret" },
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [{ id: "v1", name: "V1" }],
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it("distinguishes unknown services, bad pagination, and unknown routes", async () => {
    const missing = await request("/catalog/v1/services/missing/versions", "secret");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "service_not_found" });

    const invalid = await request("/catalog/v1/services?page=0", "secret");
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "invalid_pagination" });

    const unknown = await request("/missing", "secret");
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: "not_found" });
  });

  it("rejects non-GET methods before routing", async () => {
    const response = await request("/catalog/v1/health", undefined, "POST");
    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: "method_not_allowed" });
  });
});
