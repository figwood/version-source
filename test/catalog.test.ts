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
    expect(catalog).toHaveLength(6);
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
      page: 1,
      pageSize: 50,
      total: 1,
      totalPages: 1,
    });
  });

  it("paginates services with one-based page numbers", () => {
    const options = parseListOptions(new URL("https://example.test/?page=2&pageSize=2"));
    expect(listServices(catalog, options!)).toEqual({
      items: [
        { id: "customer-portal", name: "customer-portal" },
        { id: "users-api", name: "users-api" },
      ],
      page: 2,
      pageSize: 2,
      total: 6,
      totalPages: 3,
    });
  });

  it("defaults service pages to 50 items and caps requested page sizes", () => {
    expect(parseListOptions(new URL("https://example.test/"))).toEqual({
      query: "",
      page: 1,
      pageSize: 50,
    });
    expect(parseListOptions(new URL("https://example.test/?pageSize=999"))).toEqual({
      query: "",
      page: 1,
      pageSize: 50,
    });
  });

  it("returns an empty page while preserving pagination metadata", () => {
    const options = parseListOptions(new URL("https://example.test/?page=99&pageSize=2"));
    expect(listServices(catalog, options!)).toEqual({
      items: [],
      page: 99,
      pageSize: 2,
      total: 6,
      totalPages: 3,
    });
  });

  it.each(["page=0", "page=-1", "page=1.5", "page=x", "pageSize=0", "pageSize=-1", "pageSize=1.5", "pageSize=x"])(
    "rejects invalid pagination: %s",
    (search) => expect(parseListOptions(new URL(`https://example.test/?${search}`))).toBeNull(),
  );

  it("filters versions and preserves creation time", () => {
    const options = parseListOptions(new URL("https://example.test/?query=2.4.1"));
    expect(listVersions(catalog[0]!, options!)).toEqual({
      items: [{ id: "v2.4.1", name: "v2.4.1", createdAt: "2026-09-01T08:00:00Z" }],
      page: 1,
      pageSize: 50,
      total: 1,
      totalPages: 1,
    });
  });
});
