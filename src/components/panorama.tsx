"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Bookmark, Globe2, Languages, Moon, RefreshCw, Search, Sun, X } from "lucide-react";
import { SECTIONS, sectionLabel, type NewsResponse, type Section } from "@/lib/types";
import { FAVORITES_KEY, PREFERENCES_KEY, parseFavorites, parsePreferences, toggleFavorite, type SavedArticle } from "@/lib/storage";
import { ArticleCard } from "./article-card";
export default function Panorama() {
  const [news, setNews] = useState<NewsResponse | null>(null);
  const [section, setSection] = useState<Section>("home");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [saved, setSaved] = useState<SavedArticle[]>([]);
  const [ready, setReady] = useState(false);
  const [favorites, setFavorites] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [retry, setRetry] = useState(0);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const [about, setAbout] = useState(false);
  const [editionDate, setEditionDate] = useState("Edição de hoje");
  const dialog = useRef<HTMLDialogElement>(null);
  const localNews = useRef(new Map<Section, { news: NewsResponse; expires: number }>());
  useEffect(() => {
    try {
      setSaved(parseFavorites(localStorage.getItem(FAVORITES_KEY)));
      const prefs = parsePreferences(localStorage.getItem(PREFERENCES_KEY));
      setTheme(prefs.theme); setSection(prefs.section);
    } catch { setStorageError("O armazenamento do navegador está indisponível. As preferências durarão apenas nesta sessão."); }
    setEditionDate(new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date()));
    setReady(true);
    const sync = (e: StorageEvent) => { if (e.key === FAVORITES_KEY) setSaved(parseFavorites(e.newValue)); };
    window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (ready) try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ theme, section })); } catch { setStorageError("Não foi possível salvar as preferências neste navegador."); }
  }, [theme, section, ready]);
  useEffect(() => {
    if (ready) try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(saved)); } catch { setStorageError("Não foi possível salvar os favoritos neste navegador. Eles durarão apenas nesta sessão."); }
  }, [saved, ready]);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    let active = true;
    async function load() {
      setError(""); setNews(null);
      const cached = localNews.current.get(section);
      if (cached && cached.expires > Date.now()) { setNews(cached.news); setLoading(false); return; }
      setLoading(true);
      try {
        const response = await fetch(`/api/news?section=${section}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
        const result = await response.json();
        if (!response.ok) {
          if (active && result.retryAfter) setRetrySeconds(Math.min(3600, Number(result.retryAfter)));
          throw new Error(result.error || "Não foi possível carregar as notícias.");
        }
        if (active) { setNews(result); localNews.current.set(section, { news: result, expires: Date.now() + 60000 }); setRetrySeconds(0); }
      } catch (e) {
        if (active && !controller.signal.aborted) setError(e instanceof Error && e.name !== "TimeoutError" ? e.message : "A conexão demorou mais que o esperado. Tente novamente.");
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [section, ready, retry]);
  useEffect(() => {
    if (retrySeconds <= 0) return;
    const timer = setInterval(() => setRetrySeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [retrySeconds > 0]);
  useEffect(() => { if (about) dialog.current?.showModal(); else dialog.current?.close(); }, [about]);
  const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const source = favorites ? saved.map(s => ({ article: s.article, sourceSection: s.sourceSection })) : (news?.articles ?? []).map(article => ({ article, sourceSection: section }));
  const visible = source.filter(({ article }) => fold(`${article.title} ${article.abstract}`).includes(fold(query.trim())));
  const demo = news?.mode === "demo" || (!news && source.some(s => s.article.demo));
  function chooseSection(id: Section) { setSection(id); setFavorites(false); setQuery(""); }
  function refresh() { localNews.current.delete(section); setRetry(n => n + 1); }
  const isBusy = loading && !favorites;
  return <>
    <a className="skip-link" href="#noticias">Pular para as notícias</a>
    <div className="top-strip"><div className="page-width"><span><span className="live-dot" /> O mundo, em outra perspectiva.</span><span className="top-edition">{editionDate}</span><button onClick={() => setAbout(true)}>Sobre o projeto <ArrowUpRightSmall /></button></div></div>
    <header className="masthead page-width">
      <a href="/" className="brand" aria-label="Panorama, página inicial">panorama<span className="brand-dot">.</span></a>
      <div className="masthead-tagline"><span>NOTÍCIAS SEM FRONTEIRAS</span><p>Uma janela para o mundo.<br />Uma leitura no seu idioma.</p></div>
      <div className="header-tools"><button className={`favorites-button ${favorites ? "active" : ""}`} onClick={() => { setFavorites(v => !v); setQuery(""); }} aria-pressed={favorites}><Bookmark size={17} /><span>Favoritos</span><span className="favorite-count">{saved.length}</span></button><button className="theme-button" onClick={() => setTheme(t => t === "light" ? "dark" : "light")} aria-label={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}>{theme === "light" ? <Moon size={19} /> : <Sun size={19} />}</button></div>
    </header>
    <nav className="section-nav" aria-label="Categorias de notícias"><div className="page-width nav-inner">{SECTIONS.map(s => <button key={s.id} className={!favorites && section === s.id ? "selected" : ""} onClick={() => chooseSection(s.id)} aria-current={!favorites && section === s.id ? "page" : undefined}>{s.label}</button>)}<span className="nav-language"><Globe2 size={14} /> PT-BR</span></div></nav>
    <main className="page-width">
      {demo && <div className="demo-banner" role="status"><span className="demo-pill">MODO DEMONSTRAÇÃO</span><p>Notícias fictícias e traduções de exemplo. Explore a experiência.</p><button onClick={() => setAbout(true)}>Como funciona <ArrowRight size={14} /></button></div>}
      {!demo && news && !news.translationAvailable && <div className="notice">A tradução ainda não foi configurada. As notícias originais continuam disponíveis.</div>}
      {storageError && <div className="notice" role="status">{storageError}</div>}
      <section className="intro" aria-labelledby="page-title"><div><div className="eyebrow"><span className="short-rule" />{favorites ? "SUA SELEÇÃO" : "LEITURA COM PERSPECTIVA"}</div><h1 id="page-title">{favorites ? <>Para ler <em>com calma.</em></> : section === "home" ? <>O mundo acontece.<br /><em>Entenda em português.</em></> : <>{sectionLabel(section)}.<br /><em>Uma visão mais ampla.</em></>}</h1><p>{favorites ? "As histórias que você guardou, reunidas em um só lugar." : "Descubra as manchetes. Explore novas ideias. Traduza com um toque."}</p></div><aside className="intro-note"><div className="note-icon"><Languages size={25} /></div><span>DO INGLÊS AO PORTUGUÊS</span><p>Novas perspectivas<br />começam com<br /><em>uma boa leitura.</em></p><a href="#noticias">Explore as notícias <ArrowDown size={15} /></a></aside></section>
      <section id="noticias" className="news-section" aria-labelledby="news-heading" aria-busy={isBusy}>
        <div className="news-toolbar"><div className="section-heading"><h2 id="news-heading">{favorites ? "Notícias salvas" : section === "home" ? "Na sua perspectiva" : sectionLabel(section)}</h2><span>{isBusy ? "Carregando…" : `${visible.length} ${visible.length === 1 ? "história" : "histórias"}`}</span></div><div className="search-tools"><label className="search-box"><Search size={17} /><span className="sr-only">{favorites ? "Buscar nos favoritos" : "Buscar nas notícias carregadas"}</span><input type="search" maxLength={120} placeholder={favorites ? "Buscar nos favoritos…" : "Buscar nesta seleção…"} value={query} onChange={e => setQuery(e.target.value)} />{query && <button onClick={() => setQuery("")} aria-label="Limpar busca"><X size={15} /></button>}</label>{!favorites && <button className="refresh-button" onClick={refresh} disabled={loading || retrySeconds > 0} aria-label="Atualizar notícias" title="Atualizar notícias"><RefreshCw size={17} className={loading ? "spin" : ""} /></button>}</div></div>
        <p className="search-caption">{favorites ? "Busca por título e resumo dos favoritos salvos neste navegador." : "Busca por título e resumo apenas nas notícias carregadas desta categoria."}</p>
        {error && !favorites && <div className="empty-state error-state" role="alert"><Globe2 size={30} /><h3>Uma pausa na conexão.</h3><p>{error}</p><button className="primary-button" onClick={refresh} disabled={retrySeconds > 0}>{retrySeconds ? `Tente em ${retrySeconds}s` : "Tentar novamente"}</button></div>}
        {isBusy ? <div className="skeleton-grid" role="status" aria-label="Carregando notícias"><div className="skeleton hero-skeleton" /><div className="skeleton" /><div className="skeleton" /></div> : (!error || favorites) && visible.length === 0 ? <div className="empty-state">{favorites ? <Bookmark size={30} /> : <Search size={30} />}<h3>{query ? "Nenhuma história por aqui." : favorites ? "Boas histórias merecem ser guardadas." : "Esta seleção está vazia."}</h3><p>{query ? "Tente outra palavra ou limpe a busca para ver a seleção completa." : favorites ? "Toque no marcador de uma notícia para encontrá-la aqui depois." : "Tente atualizar a página ou explore outra categoria."}</p><button className="primary-button" onClick={() => { if (query) setQuery(""); else chooseSection("home"); }}>{query ? "Limpar busca" : "Explorar destaques"}<ArrowRight size={15} /></button></div> : (!error || favorites) && <div className="news-grid">{visible.map(({ article, sourceSection }, i) => <ArticleCard key={`${article.id}:${sourceSection}`} article={article} sourceSection={sourceSection} variant={!favorites && !query && i === 0 ? "hero" : "standard"} saved={saved.some(s => s.article.id === article.id)} onSave={() => setSaved(current => toggleFavorite(current, article, sourceSection))} translationAvailable={article.demo || Boolean(news?.translationAvailable)} />)}</div>}
        {news && !favorites && <p className="update-note">{news.mode === "demo" ? "Edição ilustrativa · conteúdo criado para demonstração" : `Seleção atualizada em ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(news.fetchedAt))} · horário de Brasília`}</p>}
      </section>
      <section className="closing-note"><span className="closing-mark">P.</span><div><span className="eyebrow">MAIS CONTEXTO. MENOS BARREIRAS.</span><p>Uma boa história<br />merece <em>ser compreendida.</em></p></div><div className="closing-copy"><Languages size={22} /><p>Títulos e resumos no seu idioma.<br />A reportagem completa, na fonte original.</p><button onClick={() => setAbout(true)}>Conheça o Panorama <ArrowRight size={16} /></button></div></section>
    </main>
    <footer className="page-width"><div><span className="footer-brand">panorama.</span><p>Projeto independente de portfólio.<br />Sem vínculo oficial com o New York Times.</p></div><div className="footer-source"><span>{demo ? "DEMONSTRAÇÃO EDITORIAL" : "FONTE DAS NOTÍCIAS"}</span>{demo ? <p>Histórias e ilustrações fictícias.<br />Traduções de exemplo.</p> : <><a href="https://www.nytimes.com/" target="_blank" rel="noopener noreferrer">Dados: The New York Times <ArrowRight size={13} /></a><p>{news?.copyright}</p></>}</div><button className="footer-about" onClick={() => setAbout(true)}>Sobre o projeto <ArrowRight size={15} /></button></footer>
    <dialog ref={dialog} className="about-dialog" onCancel={() => setAbout(false)} onClose={() => setAbout(false)} onClick={e => { if (e.target === e.currentTarget) setAbout(false); }}><div className="dialog-content"><button className="dialog-close theme-button" onClick={() => setAbout(false)} aria-label="Fechar informações"><X size={20} /></button><span className="eyebrow">UM PROJETO DE PORTFÓLIO</span><h2>O mundo, mais perto.</h2><p>O Panorama reúne títulos e resumos do New York Times e oferece tradução para português brasileiro. É um projeto independente, sem vínculo oficial com o jornal.</p><h3>O que você está lendo?</h3><p>{demo ? "Você está no modo demonstração: todas as histórias são fictícias, as imagens são ilustrações e as traduções são exemplos preparados. Nenhuma notícia real ou API de tradução está ativa neste modo." : "As notícias vêm da API Top Stories. Títulos e resumos são traduzidos sob demanda pelo DeepL e identificados como tradução automática. O texto completo permanece no site do NYT, sujeito às condições de acesso do jornal."}</p><h3>Seu espaço de leitura</h3><p>Favoritos e preferências ficam neste navegador, sem conta e sem sincronização com outros dispositivos. A busca considera somente os títulos e resumos carregados, no idioma original.</p><a className="primary-button" href="https://developer.nytimes.com/" target="_blank" rel="noopener noreferrer">Conhecer a API do NYT <ArrowRight size={16} /></a></div></dialog>
  </>;
}
function ArrowUpRightSmall() { return <span aria-hidden="true">↗</span>; }
