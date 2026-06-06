import { type NextRequest } from "next/server";

const API_URL = process.env.API_URL || "https://api.mail.reclear.io";

export const dynamic = "force-dynamic";

// Next.js rewrites() buffers the entire response before forwarding it to the
// browser — SSE streams never finish, so events are silently swallowed and the
// client only sees new emails after a manual refresh. This Route Handler takes
// precedence over the rewrite and pipes the upstream body directly, so events
// arrive in real-time. req.signal is wired to the upstream fetch so the
// backend connection closes as soon as the browser navigates away.
export async function GET(req: NextRequest) {
  const upstream = await fetch(`${API_URL}/api/emails/stream`, {
    signal: req.signal,
    headers: {
      cookie: req.headers.get("cookie") ?? "",
      accept: "text/event-stream",
      "cache-control": "no-cache",
    },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response("upstream unavailable", { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
