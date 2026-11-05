import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/chat";
import { isAdminQuery } from "@/lib/admin";
import { Composer, Feed } from "@/lib/social";
import { communitiesQuery } from "./communities.index";

export const Route = createFileRoute("/_authenticated/communities/$communityId")({
  head: () => ({
    meta: [
      { title: "Сообщество — Luminary" },
      { name: "description", content: "Посты и участники сообщества учеников Luminary." },
      { property: "og:title", content: "Сообщество — Luminary" },
      { property: "og:description", content: "Обсуждения в сообществе учеников." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  const { communityId } = Route.useParams();
  const { data: me } = useQuery(meQuery);
  const { data: isAdmin } = useQuery(isAdminQuery);
  const q = useQuery(communitiesQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const c = q.data?.find((x) => x.id === communityId);
  if (q.isPending) return <div className="panel h-40 animate-pulse" />;
  if (!c) return <div className="py-10"><h1 className="text-2xl font-bold">Сообщество не найдено</h1><Link to="/communities" className="mt-3 inline-block underline">Все сообщества</Link></div>;
  const member = Boolean(me?.id && c.members.includes(me.id));
  const owner = me?.id === c.owner_id;
  const refresh = () => qc.invalidateQueries({ queryKey: ["communities"] });
  const toggle = async () => {
    const r = member
      ? await supabase.from("community_members").delete().eq("community_id", c.id).eq("user_id", me!.id!)
      : await supabase.from("community_members").insert({ community_id: c.id, user_id: me!.id! });
    if (r.error) toast.error(r.error.message); else refresh();
  };
  const remove = async () => {
    if (!confirm("Удалить сообщество со всеми постами?")) return;
    const { error } = await supabase.from("communities").delete().eq("id", c.id);
    if (error) toast.error(error.message); else { refresh(); navigate({ to: "/communities" }); }
  };
  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
      <Link to="/communities" className="text-sm text-muted-foreground underline">← Все сообщества</Link>
      <section className="panel p-5">
        <h1 className="text-2xl font-bold">{c.name}</h1>
        {c.description && <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{c.members.length} участн.</span>
          {!owner && <button onClick={toggle} className={`rounded-xl px-4 py-2 text-sm font-bold ${member ? "border bg-card" : "bg-primary text-primary-foreground"}`}>{member ? "Выйти" : "Вступить"}</button>}
          {(owner || isAdmin) && <button onClick={remove} className="rounded-xl border bg-card px-4 py-2 text-sm text-destructive">Удалить сообщество</button>}
        </div>
      </section>
      {member ? <Composer communityId={c.id} placeholder="Написать в сообщество…" /> : <p className="panel p-4 text-sm text-muted-foreground">Вступите, чтобы публиковать посты.</p>}
      <Feed scope={{ kind: "community", id: c.id }} canModerate={owner} />
    </div>
  );
}
