import { createFileRoute } from "@tanstack/react-router";
import { uploadScamEvidence } from "@/lib/scam-reports.server";
import { getSessionUser } from "@/lib/session.server";
import { requestOrigin } from "@/lib/origin.server";
import { allowRateLimit, requestAddress } from "@/lib/rate-limit.server";

export const Route = createFileRoute("/api/public/scam-reports/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (origin && origin !== requestOrigin(request)) {
          return Response.json({ error: "INVALID_ORIGIN" }, { status: 403, headers: { "Cache-Control": "no-store" } });
        }
        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (Number.isFinite(contentLength) && contentLength > 6 * 1024 * 1024) {
          return Response.json({ error: "UPLOAD_TOO_LARGE" }, { status: 413, headers: { "Cache-Control": "no-store" } });
        }
        const user = await getSessionUser();
        if (!user) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
        if (!allowRateLimit(`scam-upload:${user.id}:${requestAddress(request)}`, 20, 10 * 60_000)) {
          return Response.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "600" } });
        }
        const form = await request.formData();
        const guildId = String(form.get("guildId") ?? "");
        const files = form.getAll("files").filter((value): value is File => value instanceof File);
        const file = files[0];
        if (!guildId || !file || files.length !== 1) return Response.json({ error: "INVALID_UPLOAD" }, { status: 400, headers: { "Cache-Control": "no-store" } });
        try {
          const uploaded = await uploadScamEvidence(guildId, file);
          return Response.json({ ok: true, file: uploaded }, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          const code = error instanceof Error ? error.message.split(":")[0] : "UPLOAD_FAILED";
          const status = code === "UNAUTHENTICATED" ? 401 : code === "FORBIDDEN" ? 403 : code === "RATE_LIMITED" ? 429 : code === "UPLOAD_TOO_LARGE" ? 413 : 400;
          return Response.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });
        }
      },
    },
  },
});
