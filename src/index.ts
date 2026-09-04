import { listServices, listVersions, parseListOptions } from "./catalog";
import { catalog } from "./data";
import type { Catalog, CatalogService, Env } from "./types";

interface Worker {
  fetch(request: Request, env: Env): Response;
}

export function createWorker(services: Catalog): Worker {
  const servicesById = new Map<string, CatalogService>(
    services.map((service) => [service.id, service]),
  );

  return {
    fetch(request, env) {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);

      const url = new URL(request.url);
      if (url.pathname === "/catalog/v1/health") return json({ status: "ok" });

      const token = env.MOCK_CATALOG_TOKEN?.trim()?env.MOCK_CATALOG_TOKEN?.trim():"dev-token";
      if (!token || request.headers.get("Authorization") !== `Bearer ${token}`) {
        return json({ error: "unauthorized" }, 401);
      }

      if (url.pathname === "/catalog/v1/services") {
        const options = parseListOptions(url, 50);
        return options
          ? json(listServices(services, options))
          : json({ error: "invalid_pagination" }, 400);
      }

      const match = url.pathname.match(/^\/catalog\/v1\/services\/([^/]+)\/versions$/);
      if (!match) return json({ error: "not_found" }, 404);

      let serviceId: string;
      try {
        serviceId = decodeURIComponent(match[1]!);
      } catch {
        return json({ error: "not_found" }, 404);
      }

      const service = servicesById.get(serviceId);
      if (!service) return json({ error: "service_not_found" }, 404);

      const options = parseListOptions(url, 10);
      return options
        ? json(listVersions(service, options))
        : json({ error: "invalid_pagination" }, 400);
    },
  };
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export default createWorker(catalog);
