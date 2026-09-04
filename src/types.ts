export interface Env {
  readonly MOCK_CATALOG_TOKEN?: string;
}

export interface Service {
  readonly id: string;
  readonly name: string;
}

export interface Version extends Service {
  readonly createdAt?: string;
}

export interface CatalogService extends Service {
  readonly versions: readonly Version[];
}

export type Catalog = readonly CatalogService[];

export interface ListResponse<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}
