import { createFileRoute } from "@tanstack/react-router";
import { uploadScamEvidence } from "@/lib/scam-reports.server";
import { getSessionUser } from "@/lib/session.server";

export const Route = createFileRoute("/api/public/scam-reports/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser();
        if (!user) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
        const form = await request.formData();
        const guildId = String(form.get("guildId") ?? "");
        const files = form.getAll("files").filter((value): value is File => value instanceof File);
        const file = files[0];
        if (!guildId || !file || files.length !== 1) return Response.json({ error: "INVALID_UPLOAD" }, { status: 400 });
        try {
          const uploaded = await uploadScamEvidence(guildId, file);
          return Response.json({ ok: true, file: uploaded }, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          const code = error instanceof Error ? error.message.split(":")[0] : "UPLOAD_FAILED";
          const status = code === "UNAUTHENTICATED" ? 401 : code === "FORBIDDEN" ? 403 : 400;
          return Response.json({ error: code }, { status });
        }
      },
    },
  },
});
