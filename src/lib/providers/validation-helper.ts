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
 * Parses response body or message to identify quota exhaustion vs transient rate limits.
 */
function isQuotaExhausted(status: number, bodyText: string): boolean {
  if (status === 402) return true;
  const lower = bodyText.toLowerCase();
  return (
    lower.includes('quota') ||
    lower.includes('insufficient_quota') ||
    lower.includes('credit_balance_too_low') ||
    lower.includes('billing') ||
    lower.includes('exceeded your current quota') ||
    lower.includes('usage limit')
  );
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
      message = `Rate limit exceeded on ${providerName}. Please retry shortly.`;
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
