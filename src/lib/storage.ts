import type { Article, Section } from "./types";
import { isSection } from "./types";
export const FAVORITES_KEY = "panorama:favorites:v1";
export const PREFERENCES_KEY = "panorama:preferences:v1";
export type SavedArticle = { article: Article; sourceSection: Section; savedAt: string };
export type Preferences = { theme: "light" | "dark"; section: Section };
function validArticle(value: unknown): value is Article {
  if (!value || typeof value !== "object") return false;
  const a = value as Article;
  if (typeof a.id !== "string" || !/^(demo-\d{1,2}|[a-f0-9]{24})$/.test(a.id) || typeof a.title !== "string" || a.title.length > 500 || typeof a.abstract !== "string" || a.abstract.length > 3000 || typeof a.section !== "string" || typeof a.byline !== "string" || typeof a.demo !== "boolean") return false;
  if (a.publishedAt !== null && (typeof a.publishedAt !== "string" || !Number.isFinite(Date.parse(a.publishedAt)))) return false;
  if (a.demo ? a.url !== null : !validUrl(a.url, "nytimes.com")) return false;
  if (a.image !== null && (!a.image || typeof a.image.credit !== "string" || typeof a.image.caption !== "string" || !(a.demo ? /^\/images\/[a-z]+\.svg$/.test(a.image.url) : validUrl(a.image.url, "static01.nyt.com")))) return false;
  return true;
}
function validUrl(value: unknown, host: string): boolean {
  if (typeof value !== "string") return false;
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password && (u.hostname === host || (host === "nytimes.com" && u.hostname.endsWith(".nytimes.com"))); } catch { return false; }
}
export function parseFavorites(raw: string | null): SavedArticle[] {
  try {
    const values: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(values)) return [];
    const seen = new Set<string>();
    return values.slice(0, 100).filter((value): value is SavedArticle => {
      if (!value || !validArticle(value.article) || !isSection(value.sourceSection) || typeof value.savedAt !== "string" || seen.has(value.article.id)) return false;
      seen.add(value.article.id); return true;
    });
  } catch { return []; }
}
export function toggleFavorite(saved: SavedArticle[], article: Article, sourceSection: Section): SavedArticle[] {
  return saved.some(s => s.article.id === article.id) ? saved.filter(s => s.article.id !== article.id) : [{ article, sourceSection, savedAt: new Date().toISOString() }, ...saved].slice(0, 100);
}
export function parsePreferences(raw: string | null): Preferences {
  const fallback: Preferences = { theme: "light", section: "home" };
  try { const p = JSON.parse(raw ?? "{}"); return { theme: p?.theme === "dark" ? "dark" : "light", section: isSection(p?.section) ? p.section : "home" }; } catch { return fallback; }
}
