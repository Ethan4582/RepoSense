import { Hono } from 'hono';
import type { AuthContext } from '../auth';
import { getPullRequestsForProject } from '~/lib/github';

export const pullsRoutes = new Hono<AuthContext>().get('/:id/pulls', async (c) => {
  const db = c.get('db');
  const projectId = c.req.param('id');

  const project = await db.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      OR: [
        { userToProjects: { some: { userId: c.get('userId') } } },
        { isPublicWiki: true },
      ],
    },
    select: { id: true },
  });

  if (!project) return c.json({ error: 'Project not found' }, 404);

  try {
    const pullRequests = await getPullRequestsForProject(projectId);
    return c.json({ pullRequests });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load pull requests.';
    return c.json({ error: message }, 502);
  }
});
