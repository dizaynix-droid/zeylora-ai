type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const dashboardCache = new Map<string, CacheEntry<unknown>>();

export function getDashboardCache<T>(key: string): T | null {
  const entry = dashboardCache.get(key);

  if (!entry) return null;

  if (entry.expiresAt < Date.now()) {
    dashboardCache.delete(key);
    return null;
  }

  return entry.value as T;
}

export function setDashboardCache<T>(key: string, value: T, ttlMs: number) {
  dashboardCache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value
  });
}

export function deleteDashboardCache(key: string) {
  dashboardCache.delete(key);
}

export function deleteDashboardCachePrefix(prefix: string) {
  for (const key of dashboardCache.keys()) {
    if (key.startsWith(prefix)) {
      dashboardCache.delete(key);
    }
  }
}

export function getOrSetDashboardCache<T>(key: string, createValue: () => T, ttlMs: number) {
  const cached = getDashboardCache<T>(key);

  if (cached) {
    return {
      cacheHit: true,
      value: cached
    };
  }

  const value = createValue();
  setDashboardCache(key, value, ttlMs);

  return {
    cacheHit: false,
    value
  };
}
