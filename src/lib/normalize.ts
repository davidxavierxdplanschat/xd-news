import { createHash } from "node:crypto";
import type { Article } from "./types";
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}
function text(value: unknown, max: number): string { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
export function safeNytUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "nytimes.com" || url.hostname.endsWith(".nytimes.com")) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function safeImage(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try { const u = new URL(value); return u.protocol === "https:" && u.hostname === "static01.nyt.com" ? u.href : null; } catch { return null; }
}
export function normalizeArticles(raw: unknown): Article[] {
  const body = record(raw);
  if (!Array.isArray(body.results)) return [];
  const seen = new Set<string>();
  return body.results.slice(0, 100).flatMap(item => {
    const r = record(item);
    const title = text(r.title, 500);
    const url = safeNytUrl(r.url);
    if (!title || !url || seen.has(url)) return [];
    seen.add(url);
    const media = (Array.isArray(r.multimedia) ? r.multimedia : []).map(record)
      .filter(m => safeImage(m.url) && (!m.type || m.type === "image"))
      .sort((a, b) => (Number(b.width) || 0) - (Number(a.width) || 0))[0];
    const date = text(r.published_date, 40);
    return [{
      id: createHash("sha256").update(url).digest("hex").slice(0, 24),
      title, abstract: text(r.abstract, 3000), url,
      byline: text(r.byline, 300), section: text(r.section, 60) || "home",
      publishedAt: date && Number.isFinite(Date.parse(date)) ? new Date(date).toISOString() : null,
      image: media ? { url: safeImage(media.url)!, caption: text(media.caption, 1000), credit: text(media.copyright, 300) } : null,
      demo: false
    }];
  });
}
