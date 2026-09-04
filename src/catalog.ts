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
  readonly page: number;
  readonly pageSize: number;
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

export function parseListOptions(url: URL, defaultPageSize = MAX_PAGE_SIZE): ListOptions | null {
  const page = parseInteger(url.searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER, 1);
  const pageSize = parseInteger(
    url.searchParams.get("pageSize"),
    1,
    MAX_PAGE_SIZE,
    defaultPageSize,
  );
  if (page === null || pageSize === null) return null;

  return {
    query: (url.searchParams.get("query") ?? "").trim().toLowerCase(),
    page,
    pageSize,
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
  const total = items.length;
  const start = Math.min((options.page - 1) * options.pageSize, total);
  const end = Math.min(start + options.pageSize, total);
  return {
    items: items.slice(start, end),
    page: options.page,
    pageSize: options.pageSize,
    total,
    totalPages: Math.ceil(total / options.pageSize),
  };
}
