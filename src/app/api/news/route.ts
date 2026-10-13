import { NextResponse } from "next/server";
import { getNews } from "@/lib/server/news";
import { errorResponse, limitRequest } from "@/lib/server/http";
import { isSection } from "@/lib/types";
import { AppError } from "@/lib/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    limitRequest(request, "news");
    const section = new URL(request.url).searchParams.get("section") ?? "home";
    if (!isSection(section)) throw new AppError(400, "SECTION", "Categoria inválida.");
    return NextResponse.json(await getNews(section), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
