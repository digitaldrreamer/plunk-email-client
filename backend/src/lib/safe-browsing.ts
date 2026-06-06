export interface ThreatMatch {
  url: string;
  threatTypes: string[];
}

function extractUrls(html: string): string[] {
  const seen = new Set<string>();
  const regex = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const url = new URL(match[1]);
      if (url.protocol === "http:" || url.protocol === "https:") seen.add(match[1]);
    } catch {
      // skip relative / malformed
    }
  }
  return [...seen];
}

export async function checkUrlSafety(html: string): Promise<ThreatMatch[]> {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  if (!apiKey) return [];

  const urls = extractUrls(html);
  if (!urls.length) return [];

  const params = new URLSearchParams({ key: apiKey, "$alt": "json" });
  for (const url of urls) params.append("urls", url);

  let res: Response;
  try {
    res = await fetch(
      `https://safebrowsing.googleapis.com/v5alpha1/urls:search?${params.toString()}`
    );
  } catch (err) {
    console.warn("[safe-browsing] fetch failed:", (err as Error).message);
    return [];
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn(`[safe-browsing] API error ${res.status}: ${text}`);
    return [];
  }

  const data = await res.json() as { threats?: { url: string; threatTypes: string[] }[] };
  return data.threats ?? [];
}
