import { describe, expect, it } from "vitest";
import { getStagingBranch } from "./index-generations";
import { isRetryableIndexingCode, retryDelayMs } from "./indexing-reliability";

describe("indexing reliability policy", () => {
  it("keeps staging namespaces isolated and retry delays bounded", () => {
    expect(getStagingBranch("generation-1")).toBe(
      "__reposense_generation__/generation-1",
    );
    expect(retryDelayMs(0)).toBe(60_000);
    expect(retryDelayMs(20)).toBe(30 * 60_000);
  });

  it("only retries known transient failures", () => {
    expect(isRetryableIndexingCode("GITHUB_RATE_LIMIT")).toBe(true);
    expect(isRetryableIndexingCode("PROVIDER_TIMEOUT")).toBe(true);
    expect(isRetryableIndexingCode("INVALID_REPOSITORY")).toBe(false);
  });
});
