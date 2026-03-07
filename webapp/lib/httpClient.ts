import { DEFAULT_USER_AGENT } from "./config";

/**
 * Fetch wrapper with timeout and error handling. Returns null on failure.
 */
export async function get(
  url: string,
  options: {
    params?: Record<string, string>;
    headers?: Record<string, string>;
    timeout?: number;
  } = {},
): Promise<Response | null> {
  const { params, headers, timeout = 15_000 } = options;

  let fullUrl = url;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    fullUrl += (url.includes("?") ? "&" : "?") + qs;
  }

  try {
    const resp = await fetch(fullUrl, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        ...headers,
      },
      signal: AbortSignal.timeout(timeout),
    });
    return resp;
  } catch (err) {
    console.error(`[httpClient] GET ${fullUrl} failed:`, err);
    return null;
  }
}

/**
 * Convenience: GET and parse JSON. Returns null on failure.
 */
export async function getJson<T = unknown>(
  url: string,
  options: {
    params?: Record<string, string>;
    headers?: Record<string, string>;
    timeout?: number;
  } = {},
): Promise<T | null> {
  const resp = await get(url, options);
  if (!resp || !resp.ok) return null;
  try {
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Convenience: GET and parse text. Returns null on failure.
 */
export async function getText(
  url: string,
  options: {
    params?: Record<string, string>;
    headers?: Record<string, string>;
    timeout?: number;
  } = {},
): Promise<string | null> {
  const resp = await get(url, options);
  if (!resp || !resp.ok) return null;
  try {
    return await resp.text();
  } catch {
    return null;
  }
}
