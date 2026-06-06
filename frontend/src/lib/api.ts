// All requests go to same origin — Next.js proxies /api/* to the backend.
// This eliminates CORS entirely and ensures cookies work across all browsers.
export function apiUrl(path: string): string {
  return path;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json.data as T;
}
