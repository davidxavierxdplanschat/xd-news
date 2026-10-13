import "server-only";
import { NextResponse } from "next/server";
import { AppError } from "../errors";
import { requestLimiter } from "./limits";
export function limitRequest(request: Request, kind: "news" | "translate") {
  // Global per-instance bucket: deliberately do not trust spoofable forwarding headers.
  requestLimiter.take(`http:${kind}`, kind === "news" ? 120 : 60, 60000);
  if (kind === "translate") {
    const origin = request.headers.get("origin");
    const url = new URL(request.url);
    // Next may construct request.url with its internal listening hostname.
    // Use the HTTP Host sent to this server, never an arbitrary forwarded host.
    let expectedOrigin = url.origin;
    const host = request.headers.get("host");
    if (host) {
      try { expectedOrigin = new URL(`${url.protocol}//${host}`).origin; }
      catch { throw new AppError(400, "HOST", "Solicitação inválida."); }
    }
    if (origin && origin !== expectedOrigin) throw new AppError(403, "ORIGIN", "Solicitação de tradução não autorizada.");
    if (request.headers.get("sec-fetch-site") === "cross-site") throw new AppError(403, "ORIGIN", "Solicitação de tradução não autorizada.");
  }
}
export function errorResponse(error: unknown) {
  const known = error instanceof AppError ? error : new AppError(500, "INTERNAL", "Não foi possível concluir a solicitação. Tente novamente.");
  return NextResponse.json({ error: known.message, code: known.code, retryAfter: known.retryAfter }, {
    status: known.status, headers: { "Cache-Control": "no-store", ...(known.retryAfter ? { "Retry-After": String(known.retryAfter) } : {}) }
  });
}
export async function readSmallJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new AppError(415, "CONTENT_TYPE", "Envie uma solicitação JSON.");
  if (Number(request.headers.get("content-length") || 0) > 1024) throw new AppError(413, "BODY_SIZE", "Solicitação muito grande.");
  if (!request.body) throw new AppError(400, "BODY", "Solicitação inválida.");
  const reader = request.body.getReader();
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 1024) { await reader.cancel(); throw new AppError(413, "BODY_SIZE", "Solicitação muito grande."); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AppError(400, "JSON", "Solicitação inválida."); }
  } finally { reader.releaseLock(); }
}
