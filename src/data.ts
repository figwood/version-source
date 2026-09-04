import { validateCatalog } from "./catalog";
import type { Catalog } from "./types";

export const catalog = [
  {
    id: "payments-api",
    name: "payments-api",
    versions: [
      { id: "v2.4.1", name: "v2.4.1", createdAt: "2026-09-01T08:00:00Z" },
      { id: "v2.4.0", name: "v2.4.0", createdAt: "2026-08-20T08:00:00Z" },
    ],
  },
  {
    id: "orders-api",
    name: "orders-api",
    versions: [{ id: "v1.8.0", name: "v1.8.0", createdAt: "2026-08-28T08:00:00Z" }],
  },
  {
    id: "customer-portal",
    name: "customer-portal",
    versions: [
      { id: "v26.09", name: "v26.09", createdAt: "2026-09-01T01:00:00Z" },
      { id: "v26.10", name: "v26.10", createdAt: "2026-09-01T02:00:00Z" },
    ],
  },
  {
    id: "users-api",
    name: "users-api",
    versions: [
      { id: "v26.09", name: "v26.09", createdAt: "2026-09-01T01:00:00Z" },
      { id: "v26.10", name: "v26.10", createdAt: "2026-09-01T02:00:00Z" },
    ],
  },
  {
    id: "stores-api",
    name: "stores-api",
    versions: [
      { id: "v26.09", name: "v26.09", createdAt: "2026-09-01T01:00:00Z" },
      { id: "v26.12", name: "v26.12", createdAt: "2026-09-01T02:00:00Z" },
      { id: "v26.13", name: "v26.13", createdAt: "2026-09-01T03:00:00Z" },
    ],
  },
  {
    id: "admin-api",
    name: "admin-api",
    versions: [
      { id: "v26.20", name: "v26.20", createdAt: "2026-09-01T01:00:00Z" },
      { id: "v26.22", name: "v26.22", createdAt: "2026-09-01T02:00:00Z" },
      { id: "v26.23", name: "v26.23", createdAt: "2026-09-01T03:00:00Z" },
      { id: "v26.24", name: "v26.24", createdAt: "2026-09-01T01:00:00Z" },
      { id: "v26.25", name: "v26.25", createdAt: "2026-09-01T02:00:00Z" },
      { id: "v26.26", name: "v26.26", createdAt: "2026-09-01T03:00:00Z" },
      { id: "v26.27", name: "v26.27", createdAt: "2026-09-01T04:00:00Z" },
      { id: "v26.28", name: "v26.28", createdAt: "2026-09-01T05:00:00Z" },
      { id: "v26.29", name: "v26.29", createdAt: "2026-09-01T06:00:00Z" },
      { id: "v26.30", name: "v26.30", createdAt: "2026-09-01T07:00:00Z" },
    ],
  },
] as const satisfies Catalog;

validateCatalog(catalog);
