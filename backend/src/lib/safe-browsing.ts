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

  let res: Response;
  try {
    res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: { clientId: "reclear-email", clientVersion: "1.0.0" },
          threatInfo: {
            threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: urls.map((url) => ({ url })),
          },
        }),
      }
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

  const data = await res.json() as { matches?: { threat: { url: string }; threatType: string }[] };
  return (data.matches ?? []).map((m) => ({
    url: m.threat.url,
    threatTypes: [m.threatType],
  }));
}
