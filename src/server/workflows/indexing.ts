import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { runIndexingWorkflow } from '~/lib/indexing-workflow';

export interface IndexingWorkflowParams {
  projectId: string;
  jobId: string;
  userId: string;
}

export interface IndexingWorkflowEnv {
  DATABASE_URL: string;
  ENCRYPTION_KEY?: string;
}

export class IndexingWorkflow extends WorkflowEntrypoint<
  IndexingWorkflowEnv,
  IndexingWorkflowParams
> {
  async run(event: WorkflowEvent<IndexingWorkflowParams>, step: WorkflowStep) {
    return runIndexingWorkflow({
      projectId: event.payload.projectId,
      jobId: event.payload.jobId,
      userId: event.payload.userId,
      step: {
        do: (name, fn) => step.do(name, fn),
      },
    });
  }
}
