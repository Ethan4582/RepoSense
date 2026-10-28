import { app } from "./app";
import { getDb } from "./db";
import { dispatchIndexingJobs } from "./indexing-dispatcher";

export { IndexingWorkflow } from "./workflows/indexing";

interface WorkerEnv {
  DATABASE_URL: string;
  INDEXING_WORKFLOW: {
    create(options: {
      id?: string;
      params: { projectId: string; jobId: string; userId: string };
    }): Promise<unknown>;
  };
}

export default {
  fetch: app.fetch,
  scheduled(
    _controller: unknown,
    env: WorkerEnv,
    ctx: { waitUntil(promise: Promise<unknown>): void },
  ) {
    ctx.waitUntil(
      dispatchIndexingJobs(getDb(env.DATABASE_URL), env.INDEXING_WORKFLOW),
    );
  },
};
