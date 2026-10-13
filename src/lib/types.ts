export const SECTIONS = [
  { id: "home", label: "Destaques" }, { id: "world", label: "Mundo" },
  { id: "business", label: "Economia" }, { id: "technology", label: "Tecnologia" },
  { id: "science", label: "Ciência" }, { id: "arts", label: "Cultura" },
  { id: "health", label: "Saúde" }, { id: "sports", label: "Esportes" },
  { id: "food", label: "Gastronomia" }, { id: "travel", label: "Viagem" }
] as const;
export type Section = typeof SECTIONS[number]["id"];
export function isSection(value: unknown): value is Section {
  return typeof value === "string" && SECTIONS.some(s => s.id === value);
}
export function sectionLabel(value: string): string {
  return SECTIONS.find(s => s.id === value)?.label ?? ({ opinion: "Opinião", politics: "Política", books: "Livros", movies: "Cinema", us: "Estados Unidos", nyregion: "Nova York" } as Record<string, string>)[value] ?? "Notícias";
}
export type Article = {
  id: string; title: string; abstract: string; url: string | null;
  byline: string; section: string; publishedAt: string | null;
  image: { url: string; caption: string; credit: string } | null;
  demo: boolean;
};
export type NewsResponse = {
  articles: Article[]; mode: "demo" | "live"; fetchedAt: string;
  translationAvailable: boolean; copyright: string;
};
export type Translation = { title: string; abstract: string; kind: "automatic" | "example" };
