import "server-only";
export function envNumber(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}
export function newsMode(): "demo" | "live" {
  if (process.env.NEWS_MODE === "demo") return "demo";
  if (process.env.NEWS_MODE === "live") return "live";
  return process.env.NYT_API_KEY?.trim() ? "live" : "demo";
}
