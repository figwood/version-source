import { describe, expect, it } from "vitest";
import {
  listServices,
  listVersions,
  parseListOptions,
  validateCatalog,
} from "../src/catalog";
import { catalog } from "../src/data";
import type { CatalogService } from "../src/types";

describe("catalog validation", () => {
  it("accepts the bundled catalog", () => {
    expect(() => validateCatalog(catalog)).not.toThrow();
    expect(catalog).toHaveLength(4);
    expect(catalog[0]?.versions[0]?.id).toBe("v2.4.1");
  });

  it("rejects duplicate service IDs", () => {
    const services: CatalogService[] = [
      { id: "same", name: "A", versions: [] },
      { id: "same", name: "B", versions: [] },
    ];
    expect(() => validateCatalog(services)).toThrow('duplicate id "same"');
  });

  it("rejects duplicate version IDs within a service", () => {
    const services: CatalogService[] = [{
      id: "service",
      name: "Service",
      versions: [
        { id: "v1", name: "First" },
        { id: "v1", name: "Second" },
      ],
    }];
    expect(() => validateCatalog(services)).toThrow('duplicate id "v1"');
  });

  it.each([
    [[{ id: "", name: "Service", versions: [] }]],
    [[{ id: "service", name: " ", versions: [] }]],
    [[{ id: "service", name: "Service", versions: [{ id: "", name: "Version" }] }]],
    [[{ id: "service", name: "Service", versions: [{ id: "v1", name: " " }] }]],
  ] satisfies [CatalogService[]][])("rejects incomplete entries", (services) => {
    expect(() => validateCatalog(services)).toThrow("id and name must not be empty");
  });
});

describe("catalog listing", () => {
  it("filters services case-insensitively and omits versions", () => {
    const options = parseListOptions(new URL("https://example.test/?query=%20PAYMENTS%20"));
    expect(options).not.toBeNull();
    expect(listServices(catalog, options!)).toEqual({
      items: [{ id: "payments-api", name: "payments-api" }],
      nextCursor: null,
    });
  });

  it("paginates results with string cursors", () => {
    const options = parseListOptions(new URL("https://example.test/?limit=2"));
    expect(listServices(catalog, options!)).toEqual({
      items: [
        { id: "payments-api", name: "payments-api" },
        { id: "orders-api", name: "orders-api" },
      ],
      nextCursor: "2",
    });
  });

  it("caps the page size and clamps oversized cursors", () => {
    expect(parseListOptions(new URL("https://example.test/?limit=999"))).toEqual({
      query: "",
      cursor: 0,
      limit: 50,
    });
    const options = parseListOptions(new URL("https://example.test/?cursor=99"));
    expect(listServices(catalog, options!)).toEqual({ items: [], nextCursor: null });
  });

  it.each(["limit=0", "limit=-1", "limit=1.5", "limit=x", "cursor=-1", "cursor=1.5", "cursor=x"])(
    "rejects invalid pagination: %s",
    (search) => expect(parseListOptions(new URL(`https://example.test/?${search}`))).toBeNull(),
  );

  it("filters versions and preserves creation time", () => {
    const options = parseListOptions(new URL("https://example.test/?query=2.4.1"));
    expect(listVersions(catalog[0]!, options!)).toEqual({
      items: [{ id: "v2.4.1", name: "v2.4.1", createdAt: "2026-09-01T08:00:00Z" }],
      nextCursor: null,
    });
  });
});
