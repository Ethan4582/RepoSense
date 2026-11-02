export function isRetryableIndexingCode(code: string): boolean {
  return /RATE_LIMIT|TIMEOUT|WORKFLOW_START|PROVIDER|GITHUB/i.test(code);
}

export function retryDelayMs(attemptCount: number): number {
  const attempt = Math.max(0, Math.floor(attemptCount));
  return Math.min(30, 2 ** attempt) * 60_000;
}
