import type { Context } from 'hono';

export const PUBLIC_WIKI_CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=86400';

// Cache keys must be identical from every hostname (preview, apex, www) and from
// background workflows, otherwise purges miss entries written through another origin.
const EDGE_CACHE_ORIGIN = 'https://edge-cache.reposense.internal';

interface EdgeCacheLike {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
  delete(request: Request): Promise<boolean>;
}

function getEdgeCache(): EdgeCacheLike | null {
  if (typeof caches === 'undefined') return null;
  const cache = (caches as unknown as { default?: EdgeCacheLike }).default;
  return cache ?? null;
}

function edgeCacheKey(key: string): Request {
  return new Request(new URL(`/__edge-cache/${encodeURIComponent(key)}`, EDGE_CACHE_ORIGIN).toString());
}

export async function cachedJson(
  c: Context,
  key: string,
  build: () => Promise<unknown>,
  maxAge = 3600
): Promise<Response> {
  const cache = getEdgeCache();
  const cacheKey = edgeCacheKey(key);

  if (cache) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
    } catch {
      // Cache API unavailable in this runtime; fall through to origin.
    }
  }

  const body = await build();
  const response = c.json(body, 200, {
    'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=86400`,
  });

  if (cache) {
    try {
      await cache.put(cacheKey, response.clone());
    } catch {
      // Ignore cache write failures.
    }
  }

  return response;
}

export async function purgeWikiCache(projectId: string, slugs: readonly string[] = []): Promise<void> {
  const cache = getEdgeCache();
  if (!cache) return;

  const keys = [
    `public-project-${projectId}`,
    'explore-all',
    ...slugs.map((slug) => `public-page-${projectId}-${slug}`),
  ];

  await Promise.all(
    Array.from(new Set(keys)).map(async (key) => {
      try {
        await cache.delete(edgeCacheKey(key));
      } catch {
        // ignore
      }
    })
  );
}
