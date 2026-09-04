import type {
  Catalog,
  CatalogService,
  ListResponse,
  Service,
  Version,
} from "./types";

const MAX_PAGE_SIZE = 50;

export interface ListOptions {
  readonly query: string;
  readonly cursor: number;
  readonly limit: number;
}

export function validateCatalog(services: Catalog): void {
  const serviceIds = new Set<string>();

  services.forEach((service, serviceIndex) => {
    if (!service.id.trim() || !service.name.trim()) {
      throw new Error(`services[${serviceIndex}]: id and name must not be empty`);
    }
    if (serviceIds.has(service.id)) {
      throw new Error(`services[${serviceIndex}]: duplicate id "${service.id}"`);
    }
    serviceIds.add(service.id);

    const versionIds = new Set<string>();
    service.versions.forEach((version, versionIndex) => {
      if (!version.id.trim() || !version.name.trim()) {
        throw new Error(
          `services[${serviceIndex}].versions[${versionIndex}]: id and name must not be empty`,
        );
      }
      if (versionIds.has(version.id)) {
        throw new Error(
          `services[${serviceIndex}].versions[${versionIndex}]: duplicate id "${version.id}"`,
        );
      }
      versionIds.add(version.id);
    });
  });
}

export function parseListOptions(url: URL): ListOptions | null {
  const limit = parseInteger(url.searchParams.get("limit"), 1, MAX_PAGE_SIZE, MAX_PAGE_SIZE);
  const cursor = parseInteger(url.searchParams.get("cursor"), 0, Number.MAX_SAFE_INTEGER, 0);
  if (limit === null || cursor === null) return null;

  return {
    query: (url.searchParams.get("query") ?? "").trim().toLowerCase(),
    cursor,
    limit,
  };
}

export function listServices(catalog: Catalog, options: ListOptions): ListResponse<Service> {
  const services = catalog
    .filter((service) => matches(service, options.query))
    .map(({ id, name }) => ({ id, name }));
  return page(services, options);
}

export function listVersions(
  service: CatalogService,
  options: ListOptions,
): ListResponse<Version> {
  return page(service.versions.filter((version) => matches(version, options.query)), options);
}

function parseInteger(
  raw: string | null,
  minimum: number,
  maximum: number,
  fallback: number,
): number | null {
  if (raw === null || raw === "") return fallback;
  if (!/^\d+$/.test(raw)) return null;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) return null;
  return Math.min(value, maximum);
}

function matches(item: Service, query: string): boolean {
  return !query || item.id.toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
}

function page<T>(items: readonly T[], options: ListOptions): ListResponse<T> {
  const start = Math.min(options.cursor, items.length);
  const end = Math.min(start + options.limit, items.length);
  return {
    items: items.slice(start, end),
    nextCursor: end < items.length ? String(end) : null,
  };
}
