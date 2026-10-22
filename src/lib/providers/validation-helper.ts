/**
 * Shared HTTP Key Validation & Error Parsing
 *
 * Normalizes HTTP errors across AI providers into ProviderError types.
 */

import { ProviderError, type ProviderErrorCode, type VerifyResult } from './types';

export interface HttpValidateOptions {
  url: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  providerName: string;
}

/**
 * Parses response body or message to accurately identify quota/credit exhaustion
 * vs transient rate limits (concurrency, RPM, TPM).
 */
function isQuotaExhausted(status: number, bodyText: string): boolean {
  if (status === 402) return true;

  try {
    const json = JSON.parse(bodyText) as unknown;
    const err =
      typeof json === 'object' && json !== null && 'error' in json
        ? (json as { error?: unknown }).error
        : json;
    const errObj =
      typeof err === 'object' && err !== null
        ? (err as { code?: unknown; type?: unknown; status?: unknown; message?: unknown })
        : null;

    const asText = (value: unknown) => (typeof value === 'string' ? value : '');
    const errCode =
      [errObj?.code, errObj?.type, errObj?.status].map(asText).find(Boolean) ?? '';
    const errMessage = typeof err === 'string' ? err : asText(errObj?.message);
    const combined = `${errCode} ${errMessage}`.toLowerCase();

    // Explicit quota / balance exhaustion identifiers
    if (
      errCode === 'insufficient_quota' ||
      errCode === 'credit_balance_too_low' ||
      errCode === 'quota_exceeded' ||
      errCode === 'RESOURCE_EXHAUSTED' ||
      combined.includes('insufficient_quota') ||
      combined.includes('credit_balance_too_low') ||
      combined.includes('exceeded your current quota') ||
      combined.includes('check your plan and billing') ||
      combined.includes('billing account') ||
      combined.includes('purchase credits') ||
      combined.includes('zero credit') ||
      combined.includes('balance is depleted')
    ) {
      return true;
    }

    // If it is explicitly a concurrency or rate limit with available quota, not exhausted
    if (
      errCode === 'rate_limit_exceeded' ||
      errCode === 'requests' ||
      combined.includes('requests per min') ||
      combined.includes('tokens per min') ||
      combined.includes('try again in') ||
      combined.includes('concurrency')
    ) {
      return false;
    }
  } catch {
    // If not JSON, fall back to string inspection
  }

  const lower = bodyText.toLowerCase();
  if (
    lower.includes('insufficient_quota') ||
    lower.includes('credit_balance_too_low') ||
    lower.includes('exceeded your current quota') ||
    lower.includes('check your plan and billing details')
  ) {
    return true;
  }

  return false;
}

/**
 * Converts HTTP status and body into a normalized ProviderError.
 */
export function mapHttpError(
  status: number,
  bodyText: string,
  providerName: string
): ProviderError {
  let code: ProviderErrorCode;
  let message: string;

  if (status === 401 || status === 403) {
    code = 'INVALID_KEY';
    message = `Invalid or unauthorized API key for ${providerName} (HTTP ${status}).`;
  } else if (status === 404) {
    code = 'MODEL_NOT_AVAILABLE';
    message = `Model or endpoint not found on ${providerName} (HTTP 404).`;
  } else if (status === 429) {
    if (isQuotaExhausted(status, bodyText)) {
      code = 'QUOTA_EXHAUSTED';
      message = `Account quota or billing credits exhausted for ${providerName}.`;
    } else {
      code = 'RATE_LIMITED';
      message = `Rate limit exceeded on ${providerName}. Transient concurrency limit reached; please retry shortly.`;
    }
  } else if (status === 402) {
    code = 'QUOTA_EXHAUSTED';
    message = `Payment required or credits exhausted for ${providerName}.`;
  } else if (status >= 500) {
    code = 'PROVIDER_ERROR';
    message = `${providerName} upstream server error (HTTP ${status}).`;
  } else {
    // Other 4xx client errors (e.g. 400 Bad Request with API_KEY_INVALID)
    const lower = bodyText.toLowerCase();
    if (lower.includes('api_key_invalid') || lower.includes('invalid_api_key')) {
      code = 'INVALID_KEY';
      message = `Invalid API key for ${providerName}.`;
    } else {
      code = 'PROVIDER_ERROR';
      message = `Unexpected response from ${providerName} (HTTP ${status}): ${bodyText.slice(0, 150)}`;
    }
  }

  return new ProviderError(code, message, {
    statusCode: status,
    details: bodyText.slice(0, 500),
  });
}

/**
 * Performs a timed HTTP validation request with proper signal aborting and normalized error handling.
 */
export async function performHttpKeyValidation(
  opts: HttpValidateOptions
): Promise<VerifyResult> {
  const timeout = opts.timeoutMs ?? 7000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(opts.url, {
      method: 'GET',
      headers: opts.headers,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (res.ok) {
      return { valid: true };
    }

    const bodyText = await res.text().catch(() => '');

    // A transient 429 rate limit proves the key authenticated successfully.
    // Only explicit quota/billing signals should mark the key as exhausted.
    if (res.status === 429 && !isQuotaExhausted(res.status, bodyText)) {
      return {
        valid: true,
        warning: `The ${opts.providerName} key is valid but currently rate limited. Please retry shortly.`,
      };
    }

    const error = mapHttpError(res.status, bodyText, opts.providerName);
    return { valid: false, error };
  } catch (err: unknown) {
    clearTimeout(timer);

    if (err instanceof Error && err.name === 'AbortError') {
      return {
        valid: false,
        error: new ProviderError(
          'PROVIDER_ERROR',
          `Validation timeout after ${timeout}ms connecting to ${opts.providerName}.`,
          { cause: err }
        ),
      };
    }

    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      error: new ProviderError(
        'PROVIDER_ERROR',
        `Network error verifying ${opts.providerName} key: ${message}`,
        { cause: err }
      ),
    };
  }
}
