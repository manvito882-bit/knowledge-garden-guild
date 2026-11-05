import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/chat";
import { Avatar, fetchCards, type Card } from "@/lib/social";

export const Route = createFileRoute("/_authenticated/people")({
  head: () => ({
    meta: [
      { title: "Друзья — Luminary" },
      { name: "description", content: "Друзья, подписки и поиск учеников Luminary." },
      { property: "og:title", content: "Друзья — Luminary" },
      { property: "og:description", content: "Находите одноклассников и подписывайтесь на них." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PeoplePage,
});

function PeoplePage() {
  const { data: me } = useQuery(meQuery);
  const [tab, setTab] = useState<"friends" | "following" | "followers" | "search">("friends");
  const [q, setQ] = useState("");
  const rel = useQuery({
    queryKey: ["relations", me?.id],
    enabled: Boolean(me?.id),
    queryFn: async () => {
      const [a, b] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", me!.id!),
        supabase.from("follows").select("follower_id").eq("following_id", me!.id!),
      ]);
      const following = (a.data ?? []).map((r) => r.following_id);
      const followers = (b.data ?? []).map((r) => r.follower_id);
      const cards = await fetchCards([...following, ...followers]);
      const pick = (ids: string[]) => ids.map((id) => cards.get(id)).filter(Boolean) as Card[];
      return { following: pick(following), followers: pick(followers), friends: pick(following.filter((id) => followers.includes(id))) };
    },
  });
  const search = useQuery({
    queryKey: ["people-search", q],
    enabled: tab === "search",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_people", { _q: q.trim() });
      if (error) throw error;
      return (data ?? []).filter((c) => c.id !== me?.id) as Card[];
    },
  });
  const list = tab === "search" ? search.data : rel.data?.[tab];
  const tabs = [["friends", "Друзья"], ["following", "Подписки"], ["followers", "Подписчики"], ["search", "Найти учеников"]] as const;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
      <h1 className="text-2xl font-bold md:text-3xl">Друзья</h1>
      <p className="text-sm text-muted-foreground">Друзья — это ученики, на которых вы подписаны и которые подписаны на вас.</p>
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold ${tab === k ? "bg-primary text-primary-foreground" : "border bg-card"}`}>
            {l}{k !== "search" && rel.data ? ` · ${rel.data[k].length}` : ""}
          </button>
        ))}
      </div>
      {tab === "search" && (
        <label className="flex items-center gap-2 rounded-xl border bg-card px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя ученика" className="w-full bg-transparent py-2.5 text-sm outline-none" />
        </label>
      )}
      <div className="panel divide-y">
        {!list ? <div className="h-24 animate-pulse" /> : list.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Никого нет.</p>
        ) : list.map((c) => (
          <div key={c.id} className="flex items-center gap-3 p-3">
            <Avatar card={c} />
            <Link to="/u/$userId" params={{ userId: c.id }} className="min-w-0 flex-1 truncate font-semibold hover:underline">{c.display_name || "Ученик"}</Link>
            <Link to="/messages" search={{ to: c.id }} className="rounded-xl border bg-card px-3 py-1.5 text-sm">Написать</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
