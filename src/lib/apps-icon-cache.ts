type FingerprintApp = {
  id: string;
  name: string;
  launchPath: string;
  version?: string | null;
  source: string;
  iconPath?: string | null;
};

type CacheRecord = {
  version: number;
  fingerprint: string;
  icons: Record<string, string | null>;
  updatedAt: number;
};

const DB_NAME = "searchie-cache";
const DB_VERSION = 1;
const STORE_NAME = "apps-icon-cache";
const CACHE_VERSION = 1;

const runtimeIcons = new Map<string, string | null>();
const hydratedFingerprints = new Set<string>();
let activeFingerprint: string | null = null;
let openDbPromise: Promise<IDBDatabase | null> | null = null;

function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function computeAppsIconFingerprint(apps: FingerprintApp[]): string {
  if (apps.length === 0) {
    return "apps-empty";
  }

  const normalized = [...apps]
    .map((app) => ({
      id: app.id,
      name: app.name,
      launchPath: app.launchPath,
      version: app.version ?? "",
      source: app.source,
      iconPath: app.iconPath ?? "",
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return `apps-${fnv1aHash(JSON.stringify(normalized))}`;
}

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
        db.createObjectStore(STORE_NAME, { keyPath: "fingerprint" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error("[apps-icon-cache] failed to open IndexedDB", request.error);
      resolve(null);
    };
  });

  return openDbPromise;
}

function readRecord(db: IDBDatabase, fingerprint: string): Promise<CacheRecord | null> {
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(fingerprint);

    request.onsuccess = () => {
      const value = request.result as CacheRecord | undefined;
      if (!value || value.version !== CACHE_VERSION) {
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

function writeRecord(db: IDBDatabase, record: CacheRecord): Promise<void> {
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    store.put(record);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

export async function ensureAppsIconCacheBucket(fingerprint: string): Promise<void> {
  if (!fingerprint) {
    return;
  }

  if (activeFingerprint !== fingerprint) {
    activeFingerprint = fingerprint;
    runtimeIcons.clear();
  }

  if (hydratedFingerprints.has(fingerprint)) {
    return;
  }

  const db = await openDb();
  if (!db) {
    hydratedFingerprints.add(fingerprint);
    return;
  }

  const record = await readRecord(db, fingerprint);
  if (record) {
    for (const [appId, icon] of Object.entries(record.icons)) {
      runtimeIcons.set(appId, icon);
    }
  }

  hydratedFingerprints.add(fingerprint);
}

export function hasCachedAppIcon(appId: string): boolean {
  return runtimeIcons.has(appId);
}

export function getCachedAppIcon(appId: string): string | null | undefined {
  return runtimeIcons.get(appId);
}

export async function cacheAppIcons(
  fingerprint: string,
  entries: Record<string, string | null>,
): Promise<void> {
  if (!fingerprint) {
    return;
  }

  if (activeFingerprint !== fingerprint) {
    activeFingerprint = fingerprint;
    runtimeIcons.clear();
  }

  for (const [appId, icon] of Object.entries(entries)) {
    runtimeIcons.set(appId, icon);
  }

  const db = await openDb();
  if (!db) {
    hydratedFingerprints.add(fingerprint);
    return;
  }

  const icons = Object.fromEntries(runtimeIcons.entries());
  await writeRecord(db, {
    version: CACHE_VERSION,
    fingerprint,
    icons,
    updatedAt: Date.now(),
  });

  hydratedFingerprints.add(fingerprint);
}
