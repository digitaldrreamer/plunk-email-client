"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon, ImageOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Baseline CSS injected into every email ────────────────────────────────────
// Normalises fonts, resets margins, constrains images and tables.
// The dark-mode block inverts backgrounds that are pure white / near-black
// so bright emails don't blind the user in dark mode.
const BASE_CSS = `
<style>
*{box-sizing:border-box;-webkit-text-size-adjust:100%}
html,body{margin:0;padding:0;word-break:break-word;overflow-wrap:break-word}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#111827;padding:0 2px 8px}
img{max-width:100%!important;height:auto!important;display:inline-block}
a{color:#2563eb;word-break:break-all}
table{border-collapse:collapse;max-width:100%!important}
td,th{vertical-align:top}
p{margin:0 0 0.75em}
blockquote{border-left:3px solid #d1d5db;padding-left:12px;color:#6b7280;margin:8px 0}
pre,code{font-family:ui-monospace,monospace;font-size:13px;background:#f3f4f6;border-radius:3px;padding:1px 4px}
pre{padding:10px;overflow-x:auto}
@media(prefers-color-scheme:dark){
  html,body{background:#0a0a0a;color:#e5e7eb}
  a{color:#60a5fa}
  blockquote{border-color:#374151;color:#9ca3af}
  pre,code{background:#1f2937}
}
</style>`;

// ── Dangerous-email link processing ──────────────────────────────────────────
function applyDangerousOverlay(html: string, threatUrls: string[]): string {
  const threatSet = new Set(threatUrls);
  return html.replace(/<a(\s[^>]*)>([\s\S]*?)<\/a>/gi, (_, attrs, content) => {
    const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
    const url = hrefMatch?.[1] ?? "";
    if (threatSet.has(url)) {
      const display = url.length > 60 ? url.slice(0, 57) + "…" : url;
      return `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(239,68,68,.12);color:#dc2626;padding:1px 6px;border-radius:4px;text-decoration:underline;text-decoration-color:#dc2626;cursor:not-allowed;font-weight:500;" title="Dangerous URL blocked: ${url.replace(/"/g, "&quot;")}">⚠ ${content} <span style="font-size:.75em;opacity:.8;">(${display})</span></span>`;
    }
    return `<span style="text-decoration:line-through;color:#9ca3af;cursor:not-allowed;pointer-events:none;" title="Link disabled in dangerous email">${content}</span>`;
  });
}

// ── Remote image handling ─────────────────────────────────────────────────────
// Replaces remote src with a transparent placeholder and stores the real URL
// in data-src so we can restore them when the user clicks "Load images".
const BLANK_IMG = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function stripRemoteImages(html: string): string {
  return html.replace(
    /(<img[^>]*)\ssrc=(["'])(https?:\/\/[^"']+)\2/gi,
    (_, pre, q, url) => `${pre} data-src=${q}${url}${q} src="${BLANK_IMG}"`,
  );
}

function restoreRemoteImages(html: string): string {
  return html.replace(
    /(<img[^>]*)\sdata-src=(["'])([^"']+)\2([^>]*)\ssrc=(["'])data:image\/gif[^"']*\5/gi,
    (_, pre, q, url, mid) => `${pre} src=${q}${url}${q}${mid}`,
  );
}

// ── Full-document builder ─────────────────────────────────────────────────────
// Mirrors Tranche's buildDoc: if the email is already a full HTML document,
// inject our CSS into its <head> rather than wrapping it again (which would
// produce malformed HTML with duplicate body/html tags).
function buildDoc(rawHtml: string, showImages: boolean): string {
  const html = showImages ? restoreRemoteImages(rawHtml) : stripRemoteImages(rawHtml);
  const t   = html.trim();
  const low = t.toLowerCase();

  if (low.startsWith("<!doctype") || low.startsWith("<html")) {
    const headClose = low.indexOf("</head>");
    if (headClose !== -1) return t.slice(0, headClose) + BASE_CSS + t.slice(headClose);
    const bodyOpen  = low.indexOf("<body");
    if (bodyOpen  !== -1) return t.slice(0, bodyOpen) + `<head>${BASE_CSS}</head>` + t.slice(bodyOpen);
    return t;
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${BASE_CSS}</head><body>${html}</body></html>`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  html: string;
  isDangerous?: boolean;
  threatUrls?: string[];
}

export function EmailBodyFrame({ html, isDangerous = false, threatUrls = [] }: Props) {
  const iframeRef  = useRef<HTMLIFrameElement>(null);
  const [height, setHeight]         = useState(160);
  const [loaded, setLoaded]         = useState(false);
  const [showImages, setShowImages] = useState(false);

  // Process dangerous emails first (replaces links with spans)
  const processedHtml = isDangerous ? applyDangerousOverlay(html, threatUrls) : html;

  const srcdoc = buildDoc(processedHtml, showImages);

  // Reset on new email
  useEffect(() => {
    setHeight(160);
    setLoaded(false);
    setShowImages(false);
  }, [html]);

  const onLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const h = Math.max(80, doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
    setHeight(h);
    setLoaded(true);
  }, []);

  // Check whether the email actually has remote images to show the toggle
  const hasRemoteImages = /src=(["'])https?:\/\/[^"']+\1/i.test(html);

  return (
    <div className="relative">
      {/* Image privacy toggle */}
      {hasRemoteImages && (
        <div className="flex items-center justify-end mb-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => {
              setShowImages((v) => !v);
              // Re-trigger height measurement after images load
              setTimeout(() => {
                const doc = iframeRef.current?.contentDocument;
                if (!doc) return;
                setHeight(Math.max(80, doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0));
              }, 400);
            }}
          >
            {showImages
              ? <><ImageOffIcon className="size-3" /> Hide images</>
              : <><ImageIcon    className="size-3" /> Load images</>
            }
          </Button>
        </div>
      )}

      {/* Skeleton shown until iframe fires onload */}
      {!loaded && (
        <div className="absolute inset-0 z-10 animate-pulse space-y-3 pt-1 pointer-events-none">
          <div className="h-3 w-3/4 rounded bg-muted" />
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-5/6 rounded bg-muted" />
          <div className="h-3 w-2/3 rounded bg-muted" />
        </div>
      )}

      <iframe
        ref={iframeRef}
        srcDoc={srcdoc}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        className="w-full border-0 block transition-opacity duration-200"
        style={{ height, minHeight: 80, opacity: loaded ? 1 : 0 }}
        title="Email message"
        onLoad={onLoad}
      />
    </div>
  );
}
