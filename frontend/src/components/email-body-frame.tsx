"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon, ImageOffIcon, SunIcon, MoonIcon, MonitorIcon, EllipsisIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

type EmailTheme = "auto" | "light" | "dark";

const DR_STYLE_ID = "__darkreader__";

// Comprehensive dark-mode stylesheet injected into the iframe document imperatively.
// Modelled after Dark Reader's dynamic theme approach — overrides background/text/link/border
// colours with HSL-shifted values while preserving image fidelity.
const DARK_MODE_CSS = `
  html, body {
    background: #181a1b !important;
    color: #e8e6e3 !important;
  }
  body > * { color: #e8e6e3 !important; }
  a { color: #3391ff !important; }
  a:visited { color: #c07fef !important; }
  blockquote {
    border-color: #4a4a4a !important;
    color: #b0aea9 !important;
  }
  pre, code {
    background: #242729 !important;
    color: #e8e6e3 !important;
  }
  table { border-color: #3a3d3f !important; }
  td, th { border-color: #3a3d3f !important; }
  hr { border-color: #3a3d3f !important; }

  /* Invert dark text on light backgrounds — the most common email pattern */
  [style*="background:#fff"],
  [style*="background: #fff"],
  [style*="background:#ffffff"],
  [style*="background: #ffffff"],
  [style*="background-color:#fff"],
  [style*="background-color: #fff"],
  [style*="background-color:#ffffff"],
  [style*="background-color: #ffffff"],
  [style*="background-color: white"],
  [style*="background-color:white"] {
    background-color: #181a1b !important;
  }
  [style*="background:#f"],
  [style*="background: #f"],
  [style*="background-color:#f"] {
    background-color: #242729 !important;
  }
  [style*="color:#000"],
  [style*="color: #000"],
  [style*="color:#111"],
  [style*="color: #111"],
  [style*="color:#222"],
  [style*="color: #222"],
  [style*="color:#333"],
  [style*="color: #333"],
  [style*="color:#444"],
  [style*="color: #444"],
  [style*="color:black"],
  [style*="color: black"] {
    color: #e8e6e3 !important;
  }
  [style*="color:#555"],
  [style*="color: #555"],
  [style*="color:#666"],
  [style*="color: #666"],
  [style*="color:#777"],
  [style*="color: #777"],
  [style*="color:#888"],
  [style*="color: #888"],
  [style*="color:#999"],
  [style*="color: #999"] {
    color: #b0aea9 !important;
  }
  /* Images stay as-is — do not invert */
  img, video, picture, canvas, svg { filter: none !important; }
`;

// Build scoped base CSS for the iframe (always light — dark mode applied imperatively)
function buildBaseCss(): string {
  return `<style>
*{box-sizing:border-box;-webkit-text-size-adjust:100%}
html,body{margin:0;padding:0;word-break:break-word;overflow-wrap:break-word;background:#ffffff;color:#111827}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;padding:0 2px 8px}
img{max-width:100%!important;height:auto!important;display:inline-block}
a{color:#2563eb;word-break:break-all}
table{border-collapse:collapse;max-width:100%!important}
td,th{vertical-align:top}
p{margin:0 0 0.75em}
blockquote{border-left:3px solid #d1d5db;padding-left:12px;margin:8px 0;color:#6b7280}
pre,code{font-family:ui-monospace,monospace;font-size:13px;border-radius:3px;padding:1px 4px;background:#f3f4f6;color:#111827}
pre{padding:10px;overflow-x:auto}
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

// Detect and split quoted reply history from the new message content.
// Handles Gmail (div.gmail_quote), Outlook (div#divRplyFwdMsg), RFC blockquote[cite],
// and the plain-text "On Mon, Jun 6... wrote:" separator.
function splitEmailQuote(html: string): { body: string; quote: string | null } {
  const markers: RegExp[] = [
    /<div[^>]+class=["'][^"']*gmail_quote[^"']*["']/i,
    /<div[^>]+id=["']divRplyFwdMsg["']/i,
    /<blockquote[^>]+type=["']cite["']/i,
  ];
  for (const marker of markers) {
    const idx = html.search(marker);
    if (idx !== -1) {
      const body = html.slice(0, idx).replace(/(<br\s*\/?>\s*){2,}$/i, "").trimEnd();
      return { body, quote: html.slice(idx) };
    }
  }
  // Plain-text fallback: "On Mon, Jun 6, 2026, Name <email> wrote:"
  const textIdx = html.search(/On\s+\w+,\s+\w{3}\s+\d{1,2},\s+\d{4}/);
  if (textIdx !== -1) {
    const body = html.slice(0, textIdx).replace(/(<br\s*\/?>\s*){2,}$/i, "").trimEnd();
    return { body, quote: html.slice(textIdx) };
  }
  return { body: html, quote: null };
}

function buildDoc(rawHtml: string, showImages: boolean): string {
  const html = showImages ? restoreRemoteImages(rawHtml) : stripRemoteImages(rawHtml);
  const baseCss = buildBaseCss();
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
  const [showQuote, setShowQuote] = useState(false);

  const { resolvedTheme } = useTheme();
  const appIsDark = resolvedTheme === "dark";
  const isDark = emailTheme === "dark" || (emailTheme === "auto" && appIsDark);

  const processedHtml = isDangerous ? applyDangerousOverlay(html, threatUrls) : html;
  const { body: quoteBody, quote: quotedHtml } = splitEmailQuote(processedHtml);
  const hasQuote = quotedHtml !== null;
  const displayHtml = hasQuote && !showQuote ? quoteBody : processedHtml;
  // srcdoc never changes on theme toggle — dark mode is applied imperatively via DOM
  const srcdoc = buildDoc(displayHtml, showImages);

  useEffect(() => {
    setHeight(160);
    setLoaded(false);
    setShowImages(false);
    setEmailTheme("auto");
    setShowQuote(false);
  }, [html]);

  // Inject / remove the dark-mode stylesheet into the iframe's document imperatively.
  // Requires allow-same-origin (already set). No srcdoc change = no iframe reload.
  useEffect(() => {
    if (!loaded) return;
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    const existing = doc.getElementById(DR_STYLE_ID);
    if (isDark) {
      if (!existing) {
        const style = doc.createElement("style");
        style.id = DR_STYLE_ID;
        style.textContent = DARK_MODE_CSS;
        doc.head.appendChild(style);
      }
    } else {
      existing?.remove();
    }
  }, [isDark, loaded]);

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

      {hasQuote && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-6 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => setShowQuote((v) => !v)}
        >
          <EllipsisIcon className="size-3" />
          {showQuote ? "Hide quoted text" : "Show quoted text"}
        </Button>
      )}
    </div>
  );
}
