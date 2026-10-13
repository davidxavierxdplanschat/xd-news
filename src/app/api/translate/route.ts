import { NextResponse } from "next/server";
import { translateArticle } from "@/lib/server/translate";
import { errorResponse, limitRequest, readSmallJson } from "@/lib/server/http";
import { isSection } from "@/lib/types";
import { AppError } from "@/lib/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    limitRequest(request, "translate");
    const body = await readSmallJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError(400, "BODY", "Solicitação inválida.");
    const data = body as Record<string, unknown>;
    if (Object.keys(data).some(k => !["id", "section"].includes(k)) || typeof data.id !== "string" || !/^(demo-\d{1,2}|[a-f0-9]{24})$/.test(data.id) || !isSection(data.section)) throw new AppError(400, "BODY", "Informe uma notícia e categoria válidas.");
    return NextResponse.json(await translateArticle(data.id, data.section), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
