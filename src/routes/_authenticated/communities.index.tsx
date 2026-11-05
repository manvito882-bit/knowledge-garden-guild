import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/chat";

export const Route = createFileRoute("/_authenticated/communities/")({
  head: () => ({
    meta: [
      { title: "Сообщества — Luminary" },
      { name: "description", content: "Группы учеников по предметам и интересам." },
      { property: "og:title", content: "Сообщества — Luminary" },
      { property: "og:description", content: "Вступайте в группы по предметам и интересам." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunitiesPage,
});

export const communitiesQuery = {
  queryKey: ["communities"],
  queryFn: async () => {
    const [c, m] = await Promise.all([
      supabase.from("communities").select("id,name,description,owner_id,created_at").order("created_at", { ascending: false }),
      supabase.from("community_members").select("community_id,user_id"),
    ]);
    if (c.error) throw c.error;
    return (c.data ?? []).map((x) => ({ ...x, members: (m.data ?? []).filter((r) => r.community_id === x.id).map((r) => r.user_id) }));
  },
};

function CommunitiesPage() {
  const { data: me } = useQuery(meQuery);
  const q = useQuery(communitiesQuery);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const create = async () => {
    if (!name.trim() || !me?.id) return;
    const { data, error } = await supabase.from("communities").insert({ name: name.trim().slice(0, 80), description: desc.trim().slice(0, 500) || null, owner_id: me.id }).select("id").single();
    if (error) return toast.error(error.message);
    await supabase.from("community_members").insert({ community_id: data.id, user_id: me.id });
    setName(""); setDesc("");
    qc.invalidateQueries({ queryKey: ["communities"] });
    toast.success("Сообщество создано");
  };
  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-8">
      <h1 className="text-2xl font-bold md:text-3xl">Сообщества</h1>
      <section className="panel space-y-2 p-4">
        <h2 className="font-bold">Создать сообщество</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" className="w-full rounded-xl border bg-tile px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="О чём оно" className="w-full rounded-xl border bg-tile px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <button onClick={create} className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">Создать</button>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        {q.isPending ? <div className="panel h-28 animate-pulse" /> : q.data?.length === 0 ? <p className="text-sm text-muted-foreground">Сообществ пока нет.</p> :
          q.data?.map((c) => (
            <Link key={c.id} to="/communities/$communityId" params={{ communityId: c.id }} className="panel block p-4 hover:ring-2 hover:ring-primary">
              <h3 className="font-bold">{c.name}</h3>
              {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> {c.members.length} участн. {me?.id && c.members.includes(me.id) && <span className="ml-auto rounded-full bg-primary px-2 py-0.5 font-semibold text-primary-foreground">Вы участник</span>}</p>
            </Link>
          ))}
      </div>
    </div>
  );
}
