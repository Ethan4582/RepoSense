// Encrypted GitHub credentials and the repo skeleton must never reach the
// browser. The skeleton is also large enough to bloat every project response.
export function withoutProjectSecrets<T extends object>(project: T): T {
  const safe = { ...project } as Record<string, unknown>;
  delete safe.encryptedGithubToken;
  delete safe.githubTokenIv;
  delete safe.repoSkeleton;
  delete safe.canonicalRepoKey;
  return safe as T;
}
