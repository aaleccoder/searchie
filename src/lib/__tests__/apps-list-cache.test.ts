import { beforeEach, describe, expect, it, vi } from "vitest";
import { cacheAppsList, loadCachedAppsList, resetAppsListCacheForTests } from "@/lib/apps-list-cache";

type IndexedDbMock = {
  open: ReturnType<typeof vi.fn>;
};

function createIndexedDbMock(): IndexedDbMock {
  const stores = new Map<string, Map<string, unknown>>();

  const open = vi.fn((_dbName: string, _version?: number) => {
    const request: {
      result: IDBDatabase;
      error: Error | null;
      onupgradeneeded: (() => void) | null;
      onsuccess: (() => void) | null;
      onerror: (() => void) | null;
    } = {
      result: null as unknown as IDBDatabase,
      error: null,
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
    };

    queueMicrotask(() => {
      const db = {
        objectStoreNames: {
          contains: (storeName: string) => stores.has(storeName),
        },
        createObjectStore: (storeName: string) => {
          stores.set(storeName, new Map());
          return {} as IDBObjectStore;
        },
        transaction: (storeName: string) => {
          const store = stores.get(storeName) ?? new Map<string, unknown>();
          stores.set(storeName, store);

          const transaction: {
            objectStore: (name: string) => {
              get: (key: string) => {
                result?: unknown;
                onsuccess: (() => void) | null;
                onerror: (() => void) | null;
              };
              put: (value: unknown) => void;
            };
            oncomplete: (() => void) | null;
            onerror: (() => void) | null;
            onabort: (() => void) | null;
          } = {
            objectStore: () => ({
              get: (key: string) => {
                const getRequest: {
                  result?: unknown;
                  onsuccess: (() => void) | null;
                  onerror: (() => void) | null;
                } = {
                  result: undefined,
                  onsuccess: null,
                  onerror: null,
                };

                queueMicrotask(() => {
                  getRequest.result = store.get(key);
                  getRequest.onsuccess?.();
                });

                return getRequest;
              },
              put: (value: unknown) => {
                const record = value as { key: string };
                store.set(record.key, value);
              },
            }),
            oncomplete: null,
            onerror: null,
            onabort: null,
          };

          queueMicrotask(() => {
            transaction.oncomplete?.();
          });

          return transaction as unknown as IDBTransaction;
        },
      } as unknown as IDBDatabase;

      request.result = db;
      request.onupgradeneeded?.();
      request.onsuccess?.();
    });

    return request as unknown as IDBOpenDBRequest;
  });

  return { open };
}

describe("apps-list-cache", () => {
  beforeEach(() => {
    resetAppsListCacheForTests();
  });

  it("returns empty list when IndexedDB is unavailable", async () => {
    vi.stubGlobal("indexedDB", undefined);

    await expect(loadCachedAppsList()).resolves.toEqual([]);
    await expect(cacheAppsList([{ id: "app-1" }])).resolves.toBeUndefined();
  });

  it("writes and reads cached app snapshots", async () => {
    const indexedDb = createIndexedDbMock();
    vi.stubGlobal("indexedDB", indexedDb);

    const payload = [
      {
        id: "app-1",
        name: "Notepad",
        launchPath: "C:/Windows/notepad.exe",
        launchArgs: [],
        source: "desktop",
      },
    ];

    await cacheAppsList(payload);
    await expect(loadCachedAppsList()).resolves.toEqual(payload);
    expect(indexedDb.open).toHaveBeenCalled();
  });
});
