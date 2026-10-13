import "server-only";
import { createHash } from "node:crypto";
import { ExpiringCache } from "../cache";
import { AppError } from "../errors";
import { demoTranslations } from "../demo";
import type { Section, Translation } from "../types";
import { getNews } from "./news";
import { translateWithDeepL, type TranslationProvider } from "./deepl";
import { providerLimiter } from "./limits";
import { envNumber } from "./config";
export const translationCache = new ExpiringCache<Translation>(500);
export async function translateArticle(id: string, section: Section, provider: TranslationProvider = translateWithDeepL): Promise<Translation> {
  const news = await getNews(section);
  const article = news.articles.find(a => a.id === id);
  if (!article) throw new AppError(404, "ARTICLE", "Esta notícia não está mais disponível nesta categoria. Atualize a lista.");
  if (article.demo) {
    const example = demoTranslations.get(id);
    if (!example) throw new AppError(404, "EXAMPLE", "Tradução de exemplo indisponível.");
    return example;
  }
  if (!news.translationAvailable) throw new AppError(503, "TRANSLATION_CONFIG", "A tradução não foi configurada. Você pode ler o original.");
  const size = article.title.length + article.abstract.length;
  if (size > 4000) throw new AppError(413, "TEXT_SIZE", "O conteúdo excede o limite de tradução.");
  const fingerprint = createHash("sha256").update(JSON.stringify([article.title, article.abstract, "PT-BR", "deepl", process.env.DEEPL_PLAN === "pro" ? "pro" : "free"])).digest("hex");
  return translationCache.load(fingerprint, envNumber("TRANSLATION_CACHE_SECONDS", 86400, 60, 604800) * 1000, async () => {
    providerLimiter.take("translation-minute", envNumber("TRANSLATION_REQUESTS_PER_MINUTE", 12, 1, 60), 60000);
    providerLimiter.take("translation-characters", envNumber("TRANSLATION_CHARACTERS_PER_DAY", 10000, 1, 500000), 86400000, size);
    return provider(article);
  });
}
