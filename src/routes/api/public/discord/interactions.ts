import { createFileRoute } from "@tanstack/react-router";
import { requestOrigin } from "@/lib/origin.server";
import {
  handleDiscordCardCommand,
  handleDiscordInteraction,
  handleDiscordTransferCommand,
  sendDiscordTransferFollowup,
  pingResponse,
  sendDiscordCardFollowup,
  verifyDiscordRequest,
  type DiscordInteractionPayload,
} from "@/lib/discord-interactions.server";

export const Route = createFileRoute("/api/public/discord/interactions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const valid = await verifyDiscordRequest(request, body);
        if (!valid) return new Response("invalid request signature", { status: 401 });

        let payload: DiscordInteractionPayload;
        try {
          payload = JSON.parse(body) as DiscordInteractionPayload;
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        if (payload.type === 1) return pingResponse();
        if (payload.type !== 2) return new Response("unsupported interaction", { status: 400 });
        if (payload.data?.name === "transfer") {
          const result = await handleDiscordTransferCommand(payload);
          if (result.kind === "error") return Response.json({ type: 4, data: { content: result.message, flags: 64 } });
          void sendDiscordTransferFollowup(payload, result.result).catch((error: unknown) =>
            console.error("[Glow HTTP] Discord transfer follow-up failed", error),
          );
          return Response.json({ type: 5, data: { flags: 64 } });
        }
        if (payload.data?.name === "user" || payload.data?.name === "profile" || payload.data?.name === "balance") {
          void handleDiscordCardCommand(payload)
            .then((card) => (card ? sendDiscordCardFollowup(payload, card) : undefined))
            .catch((error: unknown) => console.error("[Glow HTTP] Discord card follow-up failed", error));
          // A deferred response gives Discord an immediate acknowledgement while the PNG is rendered.
          return Response.json({ type: 5, data: {} });
        }
        return handleDiscordInteraction(payload, requestOrigin(request));
      },
    },
  },
});
