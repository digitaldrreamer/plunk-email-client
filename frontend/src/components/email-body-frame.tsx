"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon, ImageOffIcon, SunIcon, MoonIcon, MonitorIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

type EmailTheme = "auto" | "light" | "dark";

// Build scoped CSS for the iframe body based on resolved dark/light
function buildBaseCss(isDark: boolean): string {
  const themeVars = isDark
    ? `html,body{background:#0a0a0a;color:#e5e7eb}a{color:#60a5fa}blockquote{border-color:#374151;color:#9ca3af}pre,code{background:#1f2937;color:#e5e7eb}`
    : `html,body{background:#ffffff;color:#111827}a{color:#2563eb}blockquote{border-color:#d1d5db;color:#6b7280}pre,code{background:#f3f4f6;color:#111827}`;

  return `<style>
*{box-sizing:border-box;-webkit-text-size-adjust:100%}
html,body{margin:0;padding:0;word-break:break-word;overflow-wrap:break-word}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;padding:0 2px 8px}
img{max-width:100%!important;height:auto!important;display:inline-block}
a{word-break:break-all}
table{border-collapse:collapse;max-width:100%!important}
td,th{vertical-align:top}
p{margin:0 0 0.75em}
blockquote{border-left:3px solid;padding-left:12px;margin:8px 0}
pre,code{font-family:ui-monospace,monospace;font-size:13px;border-radius:3px;padding:1px 4px}
pre{padding:10px;overflow-x:auto}
${themeVars}
</style>`;
}

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

function buildDoc(rawHtml: string, showImages: boolean, isDark: boolean): string {
  const html = showImages ? restoreRemoteImages(rawHtml) : stripRemoteImages(rawHtml);
  const baseCss = buildBaseCss(isDark);
  const t   = html.trim();
  const low = t.toLowerCase();

  if (low.startsWith("<!doctype") || low.startsWith("<html")) {
    const headClose = low.indexOf("</head>");
    if (headClose !== -1) return t.slice(0, headClose) + baseCss + t.slice(headClose);
    const bodyOpen  = low.indexOf("<body");
    if (bodyOpen  !== -1) return t.slice(0, bodyOpen) + `<head>${baseCss}</head>` + t.slice(bodyOpen);
    return t;
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${baseCss}</head><body>${html}</body></html>`;
}

interface Props {
  html: string;
  isDangerous?: boolean;
  threatUrls?: string[];
}

const THEME_CYCLE: EmailTheme[] = ["auto", "light", "dark"];

export function EmailBodyFrame({ html, isDangerous = false, threatUrls = [] }: Props) {
  const iframeRef  = useRef<HTMLIFrameElement>(null);
  const [height, setHeight]         = useState(160);
  const [loaded, setLoaded]         = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [emailTheme, setEmailTheme] = useState<EmailTheme>("auto");

  const { resolvedTheme } = useTheme();
  const appIsDark = resolvedTheme === "dark";
  const isDark = emailTheme === "dark" || (emailTheme === "auto" && appIsDark);

  const processedHtml = isDangerous ? applyDangerousOverlay(html, threatUrls) : html;
  const srcdoc = buildDoc(processedHtml, showImages, isDark);

  useEffect(() => {
    setHeight(160);
    setLoaded(false);
    setShowImages(false);
    setEmailTheme("auto");
  }, [html]);

  const onLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const h = Math.max(80, doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
    setHeight(h);
    setLoaded(true);
  }, []);

  const hasRemoteImages = /src=(["'])https?:\/\/[^"']+\1/i.test(html);

  const cycleTheme = () => {
    setEmailTheme((t) => {
      const idx = THEME_CYCLE.indexOf(t);
      return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    });
  };

  const themeIcon = emailTheme === "light"
    ? <SunIcon className="size-3" />
    : emailTheme === "dark"
    ? <MoonIcon className="size-3" />
    : <MonitorIcon className="size-3" />;

  const themeLabel = emailTheme === "light" ? "Light" : emailTheme === "dark" ? "Dark" : "Auto";

  return (
    <div className="relative">
      <div className="flex items-center justify-end gap-1 mb-2">
        {hasRemoteImages && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => {
              setShowImages((v) => !v);
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
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={cycleTheme}
          title={`Email theme: ${themeLabel} — click to cycle`}
        >
          {themeIcon}
          {themeLabel}
        </Button>
      </div>

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
