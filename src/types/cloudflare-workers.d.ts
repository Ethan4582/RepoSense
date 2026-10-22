declare module 'cloudflare:workers' {
  export interface WorkflowStepConfig {
    retries?: {
      limit: number;
      delay?: string;
      backoff?: 'constant' | 'linear' | 'exponential';
    };
    timeout?: string;
  }

  export interface WorkflowStep {
    do<T>(name: string, fn: () => Promise<T>): Promise<T>;
    do<T>(name: string, config: WorkflowStepConfig, fn: () => Promise<T>): Promise<T>;
    sleep(name: string, duration: string): Promise<void>;
  }

  export interface WorkflowEvent<T> {
    payload: T;
    timestamp: Date;
    instanceId: string;
    workflowName: string;
  }

  export class WorkflowEntrypoint<Env = unknown, Params = unknown> {
    protected ctx: unknown;
    protected env: Env;
    constructor(ctx: unknown, env: Env);
    run(event: WorkflowEvent<Params>, step: WorkflowStep): Promise<unknown>;
  }
}
