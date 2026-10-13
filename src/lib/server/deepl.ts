import "server-only";
import { AppError } from "../errors";
import type { Article, Translation } from "../types";
export type TranslationProvider = (article: Article) => Promise<Translation>;
export const translateWithDeepL: TranslationProvider = async article => {
  const key = process.env.DEEPL_API_KEY?.trim();
  if (!key) throw new AppError(503, "TRANSLATION_CONFIG", "A tradução não foi configurada. Você pode ler a notícia original.");
  const host = process.env.DEEPL_PLAN === "pro" ? "api.deepl.com" : "api-free.deepl.com";
  const texts = article.abstract ? [article.title, article.abstract] : [article.title];
  let response: Response;
  try {
    response = await fetch(`https://${host}/v2/translate`, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(12000),
      headers: { "Content-Type": "application/json", Authorization: `DeepL-Auth-Key ${key}` },
      body: JSON.stringify({ text: texts, source_lang: "EN", target_lang: "PT-BR", preserve_formatting: true })
    });
  } catch { throw new AppError(502, "TRANSLATION_NETWORK", "Não foi possível conectar ao tradutor. O original foi mantido."); }
  if (response.status === 429) throw new AppError(429, "TRANSLATION_RATE", "O tradutor está ocupado. Tente novamente em um minuto.", 60);
  if (response.status === 456) throw new AppError(503, "TRANSLATION_QUOTA", "A cota do serviço de tradução foi atingida. Leia o original.");
  if (!response.ok) throw new AppError(502, "TRANSLATION_RESPONSE", "Não foi possível traduzir agora. O original foi mantido.");
  try {
    const body = await response.json();
    if (!Array.isArray(body.translations) || body.translations.length !== texts.length || body.translations.some((t: { text?: unknown }) => typeof t?.text !== "string" || !t.text.trim() || t.text.length > 6000)) throw new Error();
    return { title: body.translations[0].text, abstract: article.abstract ? body.translations[1].text : "", kind: "automatic" };
  } catch { throw new AppError(502, "TRANSLATION_FORMAT", "O tradutor retornou uma resposta inesperada. O original foi mantido."); }
};
