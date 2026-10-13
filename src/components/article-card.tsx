"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, Bookmark, Check, Languages, LoaderCircle } from "lucide-react";
import { sectionLabel, type Article, type Section, type Translation } from "@/lib/types";
type Props = { article: Article; sourceSection: Section; variant?: "hero" | "standard"; saved: boolean; onSave: () => void; translationAvailable: boolean };
export function ArticleCard({ article, sourceSection, variant = "standard", saved, onSave, translationAvailable }: Props) {
  const [translation, setTranslation] = useState<Translation | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => { setTranslation(null); setShowTranslation(false); setError(""); setImageFailed(false); }, [article.title, article.abstract, article.image?.url]);
  const text = showTranslation && translation ? translation : article;
  async function translate() {
    if (translating) return;
    if (translation) { setShowTranslation(v => !v); return; }
    setTranslating(true); setError("");
    try {
      const response = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: article.id, section: sourceSection }), signal: AbortSignal.timeout(25000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível traduzir. Tente novamente.");
      setTranslation(result); setShowTranslation(true);
    } catch (e) { setError(e instanceof Error && e.name !== "TimeoutError" ? e.message : "A tradução demorou mais que o esperado. Tente novamente."); }
    finally { setTranslating(false); }
  }
  const date = article.publishedAt ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).format(new Date(article.publishedAt)) : "Data indisponível";
  return <article className={`article-card ${variant}`}>
    <figure className={`article-figure ${imageFailed || !article.image ? "no-image" : ""}`}>
      {article.image && !imageFailed ? <img src={article.image.url} alt={article.image.caption || "Imagem da notícia"} loading={variant === "hero" ? "eager" : "lazy"} onError={() => setImageFailed(true)} /> : <div className="image-fallback"><span>P.</span><small>Panorama · Sem imagem</small></div>}
      {variant === "hero" && <span className="figure-tag">{article.demo ? "HISTÓRIA DE EXEMPLO" : "EM DESTAQUE"}</span>}
      {article.image && !imageFailed && <figcaption>{article.image.credit || "Imagem fornecida pela fonte"}</figcaption>}
    </figure>
    <div className="article-body">
      <div className="article-meta"><span>{sectionLabel(article.section)}</span><span className="meta-dot">·</span><time dateTime={article.publishedAt ?? undefined}>{date}</time><button className={`save-icon ${saved ? "saved" : ""}`} onClick={onSave} aria-label={saved ? `Remover dos favoritos: ${article.title}` : `Salvar notícia: ${article.title}`} aria-pressed={saved}><Bookmark size={18} fill={saved ? "currentColor" : "none"} /></button></div>
      <h3 lang={showTranslation ? "pt-BR" : "en"}>{text.title}</h3>
      <p className="article-summary" lang={showTranslation ? "pt-BR" : "en"}>{text.abstract || "A fonte não disponibilizou um resumo para esta notícia."}</p>
      <p className="byline">{article.byline || "The New York Times"}</p>
      <div className="article-actions">
        <button className={`translate-button ${showTranslation ? "translated" : ""}`} onClick={translate} disabled={translating || (!translationAvailable && !translation)} title={!translationAvailable ? "O serviço de tradução ainda não foi configurado" : undefined}>
          {translating ? <LoaderCircle size={15} className="spin" /> : showTranslation ? <Check size={15} /> : <Languages size={15} />}
          {translating ? "Traduzindo…" : showTranslation ? "Ver original" : translation ? "Ver em português" : "Traduzir para português"}
        </button>
        {article.url ? <a className="read-link" href={article.url} target="_blank" rel="noopener noreferrer">Ler no NYT <ArrowUpRight size={15} /><span className="sr-only"> (abre em nova aba)</span></a> : <span className="fiction-label">Conteúdo fictício</span>}
      </div>
      <div aria-live="polite" className="translation-status">
        {showTranslation && translation && <span>{translation.kind === "example" ? "Tradução de exemplo · sem uso de API" : "Tradução automática · DeepL"}</span>}
        {error && <p className="inline-error" role="alert">{error}</p>}
      </div>
    </div>
  </article>;
}
