import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeArticles } from "@/lib/normalize";
import { ExpiringCache } from "@/lib/cache";
import { parseFavorites, parsePreferences, toggleFavorite } from "@/lib/storage";
import { demoArticles } from "@/lib/demo";
import { WindowLimiter, providerLimiter } from "@/lib/server/limits";
import { getNews, newsCache, resetNewsThrottle } from "@/lib/server/news";
import { translateArticle, translationCache } from "@/lib/server/translate";
import { translateWithDeepL } from "@/lib/server/deepl";
import { POST } from "@/app/api/translate/route";
import { GET } from "@/app/api/news/route";
const rawArticle = { title: "A title", abstract: "A summary", url: "https://www.nytimes.com/2026/10/13/world/story.html", section: "world", published_date: "2026-10-13T10:00:00Z", byline: "By A Reporter", multimedia: null };
beforeEach(() => {
  vi.unstubAllGlobals(); vi.unstubAllEnvs();
  vi.stubEnv("NEWS_MODE", "demo"); vi.stubEnv("NYT_API_KEY", ""); vi.stubEnv("DEEPL_API_KEY", "");
  newsCache.clear(); translationCache.clear(); providerLimiter.clear(); resetNewsThrottle();
});
describe("normalização", () => {
  it("trata dados ausentes, URLs perigosas, datas inválidas e duplicatas", () => {
    const articles = normalizeArticles({ results: [rawArticle, rawArticle, null, { ...rawArticle, url: "javascript:alert(1)" }, { ...rawArticle, url: "https://nytimes.com.evil.test/a" }, { ...rawArticle, title: "" }] });
    expect(articles).toHaveLength(1); expect(articles[0].image).toBeNull(); expect(articles[0].id).toMatch(/^[a-f0-9]{24}$/);
    const [missing] = normalizeArticles({ results: [{ title: "Missing fields", url: "https://www.nytimes.com/a", published_date: "bad" }] });
    expect(missing.abstract).toBe(""); expect(missing.publishedAt).toBeNull(); expect(normalizeArticles(null)).toEqual([]);
  });
  it("escolhe a maior imagem segura e preserva os créditos", () => {
    const [article] = normalizeArticles({ results: [{ ...rawArticle, multimedia: [{ url: "https://evil.test/photo", width: 2000 }, { url: "https://static01.nyt.com/small.jpg", width: 100 }, { url: "https://static01.nyt.com/large.jpg", width: 800, caption: "Caption", copyright: "Photographer" }] }] });
    expect(article.image).toEqual({ url: "https://static01.nyt.com/large.jpg", caption: "Caption", credit: "Photographer" });
  });
});
describe("cache", () => {
  it("agrupa chamadas simultâneas e expira resultados", async () => {
    let now = 0; const cache = new ExpiringCache<string>(2, () => now);
    const loader = vi.fn(async () => "value");
    expect(await Promise.all([cache.load("a", 100, loader), cache.load("a", 100, loader)])).toEqual(["value", "value"]);
    expect(loader).toHaveBeenCalledTimes(1); now = 101;
    await cache.load("a", 100, loader); expect(loader).toHaveBeenCalledTimes(2);
  });
  it("não guarda falhas e limita o número de entradas", async () => {
    const cache = new ExpiringCache<number>(1); const failure = vi.fn(async () => { throw new Error("fail"); });
    await expect(cache.load("a", 1000, failure)).rejects.toThrow("fail");
    await expect(cache.load("a", 1000, failure)).rejects.toThrow("fail"); expect(failure).toHaveBeenCalledTimes(2);
    cache.set("a", 1, 1000); cache.set("b", 2, 1000); expect(cache.get("a")).toBeUndefined(); expect(cache.get("b")).toBe(2);
  });
});
describe("notícias e falhas externas", () => {
  it("funciona em demonstração sem chamada externa", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const result = await getNews("home"); expect(result.mode).toBe("demo"); expect(result.articles.length).toBeGreaterThan(5); expect(fetcher).not.toHaveBeenCalled();
    expect((await getNews("science")).articles.every(a => a.section === "science")).toBe(true);
  });
  it("não disfarça falha do modo real como demonstração", async () => {
    vi.stubEnv("NEWS_MODE", "live"); vi.stubEnv("NYT_API_KEY", "test-secret");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("secret in upstream error")));
    await expect(getNews("home")).rejects.toMatchObject({ status: 502, code: "NYT_NETWORK" });
  });
  it("normaliza, reutiliza cache e mantém chave fora da resposta", async () => {
    vi.stubEnv("NEWS_MODE", "live"); vi.stubEnv("NYT_API_KEY", "test-secret");
    const fetcher = vi.fn().mockResolvedValue(Response.json({ results: [rawArticle], copyright: "NYT" })); vi.stubGlobal("fetch", fetcher);
    const first = await getNews("home"); const second = await getNews("home");
    expect(second).toEqual(first); expect(fetcher).toHaveBeenCalledTimes(1); expect(JSON.stringify(first)).not.toContain("test-secret");
    await expect(getNews("world")).rejects.toMatchObject({ status: 429, code: "NYT_THROTTLE" });
  });
  it("trata 429 e respostas malformadas", async () => {
    vi.stubEnv("NEWS_MODE", "live"); vi.stubEnv("NYT_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 429 })));
    await expect(getNews("home")).rejects.toMatchObject({ status: 429, retryAfter: 60 });
    resetNewsThrottle(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ wrong: [] })));
    await expect(getNews("home")).rejects.toMatchObject({ code: "NYT_FORMAT" });
  });
  it("valida categoria no endpoint público", async () => {
    const response = await GET(new Request("http://localhost/api/news?section=../../secrets")); expect(response.status).toBe(400);
  });
});
describe("tradução", () => {
  it("retorna exemplo identificado e rejeita notícia desconhecida", async () => {
    const provider = vi.fn(); expect((await translateArticle("demo-1", "home", provider)).kind).toBe("example"); expect(provider).not.toHaveBeenCalled();
    await expect(translateArticle("demo-99", "home", provider)).rejects.toMatchObject({ status: 404 });
  });
  it("traduz apenas dados reconhecidos e reutiliza cache simultâneo", async () => {
    vi.stubEnv("NEWS_MODE", "live"); vi.stubEnv("NYT_API_KEY", "test-key"); vi.stubEnv("DEEPL_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ results: [rawArticle] })));
    const [article] = (await getNews("home")).articles;
    const provider = vi.fn(async (_article: typeof article) => ({ title: "Um título", abstract: "Um resumo", kind: "automatic" as const }));
    const results = await Promise.all([translateArticle(article.id, "home", provider), translateArticle(article.id, "home", provider)]);
    expect(results[0].title).toBe("Um título"); expect(provider).toHaveBeenCalledTimes(1); expect(provider.mock.calls[0][0]).toEqual(article);
    await translateArticle(article.id, "home", provider); expect(provider).toHaveBeenCalledTimes(1);
    expect(article.title).toBe("A title");
  });
  it("cache muda quando o conteúdo muda", async () => {
    vi.stubEnv("NEWS_MODE", "live"); vi.stubEnv("NYT_API_KEY", "test-key"); vi.stubEnv("DEEPL_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ results: [rawArticle] })));
    const [article] = (await getNews("home")).articles;
    const provider = vi.fn(async () => ({ title: "Título", abstract: "Resumo", kind: "automatic" as const }));
    await translateArticle(article.id, "home", provider);
    newsCache.set("live:home", { articles: [{ ...article, title: "Changed title" }], mode: "live", fetchedAt: "2026-10-13T14:00:00Z", copyright: "NYT", translationAvailable: true }, 10000);
    await translateArticle(article.id, "home", provider); expect(provider).toHaveBeenCalledTimes(2);
  });
  it("usa autenticação no servidor, PT-BR e apenas título/resumo", async () => {
    vi.stubEnv("DEEPL_API_KEY", "private-key"); vi.stubEnv("DEEPL_PLAN", "free");
    const fetcher = vi.fn().mockResolvedValue(Response.json({ translations: [{ text: "Título" }, { text: "Resumo" }] })); vi.stubGlobal("fetch", fetcher);
    const article = normalizeArticles({ results: [rawArticle] })[0];
    expect(await translateWithDeepL(article)).toEqual({ title: "Título", abstract: "Resumo", kind: "automatic" });
    expect(fetcher.mock.calls[0][0]).toBe("https://api-free.deepl.com/v2/translate");
    const request = fetcher.mock.calls[0][1]; expect(request.headers.Authorization).toBe("DeepL-Auth-Key private-key");
    expect(JSON.parse(request.body)).toMatchObject({ text: ["A title", "A summary"], source_lang: "EN", target_lang: "PT-BR" });
  });
  it("trata falha, cota, limitação e ausência de resumo", async () => {
    vi.stubEnv("DEEPL_API_KEY", "private-key"); const article = normalizeArticles({ results: [rawArticle] })[0];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 456 })));
    await expect(translateWithDeepL(article)).rejects.toMatchObject({ code: "TRANSLATION_QUOTA" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 429 })));
    await expect(translateWithDeepL(article)).rejects.toMatchObject({ status: 429, retryAfter: 60 });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(translateWithDeepL(article)).rejects.toMatchObject({ code: "TRANSLATION_NETWORK" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ translations: [{ text: "Título" }] })));
    expect((await translateWithDeepL({ ...article, abstract: "" })).abstract).toBe("");
  });
  it("endpoint rejeita texto arbitrário e origem cruzada", async () => {
    const send = (body: unknown, origin = "http://localhost") => POST(new Request("http://localhost/api/translate", { method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(body) }));
    expect((await send({ id: "demo-1", section: "home", text: "arbitrary text" })).status).toBe(400);
    expect((await send({ id: "demo-1", section: "home" }, "https://evil.test")).status).toBe(403);
    const result = await send({ id: "demo-1", section: "home" }); expect(result.status).toBe(200); expect((await result.json()).kind).toBe("example");
    expect((await send({ id: "demo-1", section: "home", text: "x".repeat(1100) })).status).toBe(413);
  });
  it("aceita a origem pública local quando o Next usa hostname interno", async () => {
    const request = new Request("http://localhost:3000/api/translate", {
      method: "POST", headers: { "Content-Type": "application/json", host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
      body: JSON.stringify({ id: "demo-1", section: "home" })
    });
    expect((await POST(request)).status).toBe(200);
  });
});
describe("favoritos e preferências", () => {
  it("persiste dados completos, remove favoritos e ignora dados corrompidos", () => {
    const saved = toggleFavorite([], demoArticles[0], "home");
    expect(parseFavorites(JSON.stringify(saved))).toEqual(saved);
    expect(toggleFavorite(saved, demoArticles[0], "home")).toEqual([]);
    expect(parseFavorites("broken JSON")).toEqual([]);
    expect(parseFavorites(JSON.stringify([{ ...saved[0], article: { ...demoArticles[0], url: "javascript:alert(1)", demo: false } }]))).toEqual([]);
    expect(parseFavorites(JSON.stringify([...saved, ...saved]))).toHaveLength(1);
  });
  it("valida preferências e restaura valores padrão", () => {
    expect(parsePreferences('{"theme":"dark","section":"science"}')).toEqual({ theme: "dark", section: "science" });
    expect(parsePreferences('{"theme":"red","section":"unknown"}')).toEqual({ theme: "light", section: "home" });
  });
});
describe("limites de abuso", () => {
  it("bloqueia excesso e libera após expiração", () => {
    let now = 0; const limiter = new WindowLimiter(2, () => now);
    limiter.take("a", 2, 1000); limiter.take("a", 2, 1000);
    expect(() => limiter.take("a", 2, 1000)).toThrow(); now = 1001; expect(() => limiter.take("a", 2, 1000)).not.toThrow();
  });
});
