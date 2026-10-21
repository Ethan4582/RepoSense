import type { Context } from 'hono';

export const PUBLIC_WIKI_CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=86400';

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

export async function cachedJson(
  c: Context,
  key: string,
  build: () => Promise<unknown>,
  maxAge = 3600
): Promise<Response> {
  const cache = getEdgeCache();
  const cacheKey = new Request(new URL(`/__edge-cache/${encodeURIComponent(key)}`, c.req.url).toString());

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

export async function purgeWikiCache(projectId: string): Promise<void> {
  const cache = getEdgeCache();
  if (!cache) return;

  const base = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
  const keys = [
    `public-project-${projectId}`,
    `explore-all`,
  ];

  await Promise.all(
    keys.map(async (key) => {
      try {
        await cache.delete(
          new Request(new URL(`/__edge-cache/${encodeURIComponent(key)}`, base).toString())
        );
      } catch {
        // ignore
      }
    })
  );
}
