type InstalledAppSnapshot = {
  id: string;
  name: string;
  launchPath: string;
  launchArgs: string[];
  iconPath?: string | null;
  version?: string | null;
  publisher?: string | null;
  installLocation?: string | null;
  uninstallCommand?: string | null;
  source: string;
};

type AppsListCacheRecord = {
  version: number;
  key: string;
  apps: InstalledAppSnapshot[];
  updatedAt: number;
};

const DB_NAME = "searchie-cache";
const DB_VERSION = 2;
const STORE_NAME = "apps-list-cache";
const CACHE_KEY = "installed-apps";
const CACHE_VERSION = 1;

let openDbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }

  if (openDbPromise) {
    return openDbPromise;
  }

  openDbPromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error("[apps-list-cache] failed to open IndexedDB", request.error);
      resolve(null);
    };
  });

  return openDbPromise;
}

function readRecord(db: IDBDatabase): Promise<AppsListCacheRecord | null> {
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(CACHE_KEY);

    request.onsuccess = () => {
      const value = request.result as AppsListCacheRecord | undefined;
      if (!value || value.version !== CACHE_VERSION || !Array.isArray(value.apps)) {
        resolve(null);
        return;
      }

      resolve(value);
    };

    request.onerror = () => {
      resolve(null);
    };
  });
}

function writeRecord(db: IDBDatabase, apps: InstalledAppSnapshot[]): Promise<void> {
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    store.put({
      version: CACHE_VERSION,
      key: CACHE_KEY,
      apps,
      updatedAt: Date.now(),
    } satisfies AppsListCacheRecord);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

export async function loadCachedAppsList<T = InstalledAppSnapshot>(): Promise<T[]> {
  const db = await openDb();
  if (!db) {
    return [];
  }

  const record = await readRecord(db);
  if (!record) {
    return [];
  }

  return record.apps as T[];
}

export async function cacheAppsList<T = InstalledAppSnapshot>(apps: T[]): Promise<void> {
  const db = await openDb();
  if (!db) {
    return;
  }

  await writeRecord(db, apps as InstalledAppSnapshot[]);
}

export function resetAppsListCacheForTests(): void {
  openDbPromise = null;
}
