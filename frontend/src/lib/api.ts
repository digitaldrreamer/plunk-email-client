const BACKEND = process.env.NEXT_PUBLIC_API_URL || "https://api.mail.reclear.io";

export function apiUrl(path: string): string {
  return `${BACKEND}${path}`;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(apiUrl(path), {
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
