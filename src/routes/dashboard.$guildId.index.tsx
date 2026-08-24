import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getWorkspace } from "@/lib/api.functions";
import { GuildOverviewPage, type GuildWorkspace } from "@/components/glow/guild-dashboard";

export const Route = createFileRoute("/dashboard/$guildId/")({
  ssr: false,
  component: GuildOverviewRoute,
});

function GuildOverviewRoute() {
  const { guildId } = Route.useParams();
  const workspace = useQuery<GuildWorkspace>({
    queryKey: ["workspace", guildId],
    queryFn: async () => (await getWorkspace({ data: { guildId } })) as unknown as GuildWorkspace,
  });

  if (!workspace.data?.botPresent) return null;
  return <GuildOverviewPage guildId={guildId} workspace={workspace.data} />;
}
