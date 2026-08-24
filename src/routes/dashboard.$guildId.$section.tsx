import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getWorkspace } from "@/lib/api.functions";
import { GuildSectionPage, type GuildWorkspace } from "@/components/glow/guild-dashboard";

export const Route = createFileRoute("/dashboard/$guildId/$section")({
  ssr: false,
  component: GuildSectionRoute,
});

function GuildSectionRoute() {
  const { guildId, section } = Route.useParams();
  const workspace = useQuery<GuildWorkspace>({
    queryKey: ["workspace", guildId],
    queryFn: async () => (await getWorkspace({ data: { guildId } })) as unknown as GuildWorkspace,
  });

  if (!workspace.data?.botPresent) return null;
  return <GuildSectionPage guildId={guildId} section={section} workspace={workspace.data} />;
}
