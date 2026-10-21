import { Hono } from 'hono';
import { db } from '~/server/db';
import { getFullFileContent } from '~/lib/embeddings';
import { cachedJson } from '~/lib/cache';

export const publicRoutes = new Hono()
  .get('/explore', async (c) => {
    const query = c.req.query('q')?.trim().toLowerCase() ?? 'all';

    return cachedJson(c, `explore-${query}`, async () => {
      const projects = await db.project.findMany({
        where: {
          isPublicWiki: true,
          deletedAt: null,
          lastIndexedAt: { not: null },
          ...(query !== 'all'
            ? {
                OR: [
                  { name: { contains: query, mode: 'insensitive' } },
                  { repoOwner: { contains: query, mode: 'insensitive' } },
                  { repoName: { contains: query, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: { lastIndexedAt: 'desc' },
        take: 60,
        select: {
          id: true,
          name: true,
          repoOwner: true,
          repoName: true,
          repoUrl: true,
          lastIndexedAt: true,
          lastIndexedCommitSha: true,
          _count: { select: { wikiPages: true } },
          wikiPages: {
            where: { slug: 'overview' },
            select: { content: true },
          },
        },
      });

      return {
        projects: projects.map((project) => ({
          id: project.id,
          name: project.name,
          repoOwner: project.repoOwner,
          repoName: project.repoName,
          repoUrl: project.repoUrl,
          lastIndexedAt: project.lastIndexedAt,
          lastIndexedCommitSha: project.lastIndexedCommitSha,
          pageCount: project._count.wikiPages,
          summary: project.wikiPages[0]?.content?.slice(0, 280) ?? null,
        })),
      };
    });
  })
  .get('/projects/:id', async (c) => {
    const projectId = c.req.param('id');

    return cachedJson(c, `public-project-${projectId}`, async () => {
      const project = await db.project.findFirst({
        where: { id: projectId, isPublicWiki: true, deletedAt: null },
        select: {
          id: true,
          name: true,
          repoOwner: true,
          repoName: true,
          repoUrl: true,
          lastIndexedAt: true,
          lastIndexedCommitSha: true,
          chatModel: true,
          chatProvider: true,
          wikiPages: {
            orderBy: [{ sectionOrder: 'asc' }, { pageOrder: 'asc' }],
            select: {
              id: true,
              slug: true,
              title: true,
              sectionTitle: true,
              sectionOrder: true,
              pageOrder: true,
              headings: true,
            },
          },
        },
      });

      if (!project) throw new Error('Wiki not found');
      return { project };
    }).catch(() => c.json({ error: 'Wiki not found' }, 404));
  })
  .get('/projects/:id/pages/:slug', async (c) => {
    const projectId = c.req.param('id');
    const slug = c.req.param('slug');

    return cachedJson(c, `public-page-${projectId}-${slug}`, async () => {
      const page = await db.wikiPage.findFirst({
        where: {
          slug,
          projectId,
          project: { isPublicWiki: true, deletedAt: null },
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              repoOwner: true,
              repoName: true,
              repoUrl: true,
              lastIndexedAt: true,
              lastIndexedCommitSha: true,
            },
          },
        },
      });

      if (!page) throw new Error('Page not found');
      return { page };
    }).catch(() => c.json({ error: 'Page not found' }, 404));
  })
  .get('/projects/:id/file', async (c) => {
    const projectId = c.req.param('id');
    const filePath = c.req.query('path');

    if (!filePath) return c.json({ error: 'path is required' }, 400);

    const project = await db.project.findFirst({
      where: { id: projectId, isPublicWiki: true, deletedAt: null },
      select: { id: true },
    });
    if (!project) return c.json({ error: 'Wiki not found' }, 404);

    const content = await getFullFileContent(db, projectId, filePath);
    if (content === null) return c.json({ error: 'File not found' }, 404);

    return c.json({
      filePath,
      content,
      lines: content.split('\n').length,
    });
  });
