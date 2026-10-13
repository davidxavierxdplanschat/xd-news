import "server-only";
import { ExpiringCache } from "../cache";
import { AppError } from "../errors";
import { normalizeArticles } from "../normalize";
import { demoArticles } from "../demo";
import { isSection, type Section, type NewsResponse } from "../types";
import { envNumber, newsMode } from "./config";
import { providerLimiter } from "./limits";
export const newsCache = new ExpiringCache<NewsResponse>(20);
let nextRequestAt = 0;
export function resetNewsThrottle() { nextRequestAt = 0; }
export async function getNews(section: Section): Promise<NewsResponse> {
  if (!isSection(section)) throw new AppError(400, "SECTION", "Categoria inválida.");
  const mode = newsMode();
  if (mode === "demo") return {
    articles: section === "home" ? demoArticles : demoArticles.filter(a => a.section === section),
    mode, fetchedAt: "2026-10-13T14:00:00.000Z", translationAvailable: true,
    copyright: "Conteúdo fictício para demonstração. Não são reportagens do New York Times."
  };
  const key = process.env.NYT_API_KEY?.trim();
  if (!key) throw new AppError(503, "CONFIG", "A fonte de notícias ainda não foi configurada.");
  return newsCache.load(`${mode}:${section}`, envNumber("NEWS_CACHE_SECONDS", 300, 60, 3600) * 1000, async () => {
    const now = Date.now();
    if (now < nextRequestAt) throw new AppError(429, "NYT_THROTTLE", "A fonte está em intervalo de atualização. Aguarde alguns segundos.", Math.ceil((nextRequestAt - now) / 1000));
    providerLimiter.take("nyt-daily", envNumber("NYT_DAILY_LIMIT", 500, 1, 4000), 86400000);
    nextRequestAt = now + envNumber("NYT_MIN_INTERVAL_MS", 12000, 6000, 60000);
    let response: Response;
    try {
      response = await fetch(`https://api.nytimes.com/svc/topstories/v2/${section}.json?api-key=${encodeURIComponent(key)}`, {
        signal: AbortSignal.timeout(10000), cache: "no-store", headers: { Accept: "application/json" }
      });
    } catch { throw new AppError(502, "NYT_NETWORK", "Não foi possível conectar à fonte de notícias. Tente novamente."); }
    if (response.status === 429) {
      nextRequestAt = Date.now() + 60000;
      throw new AppError(429, "NYT_RATE", "A fonte de notícias atingiu seu limite temporário. Tente novamente em um minuto.", 60);
    }
    if (!response.ok) throw new AppError(502, "NYT_RESPONSE", "A fonte de notícias está indisponível. Tente novamente mais tarde.");
    let body: Record<string, unknown>;
    try {
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || !Array.isArray((data as Record<string, unknown>).results)) throw new Error();
      body = data as Record<string, unknown>;
    } catch { throw new AppError(502, "NYT_FORMAT", "A fonte retornou uma resposta inesperada."); }
    return { articles: normalizeArticles(body), mode, fetchedAt: new Date().toISOString(),
      translationAvailable: Boolean(process.env.DEEPL_API_KEY?.trim()),
      copyright: typeof body.copyright === "string" ? body.copyright.slice(0, 500) : "The New York Times" };
  });
}
