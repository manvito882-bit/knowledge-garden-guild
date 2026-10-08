import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { Loader2, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { avatarQuery } from "@/lib/profile";

const leaderboardQuery = queryOptions({
  queryKey: ["leaderboard"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.rpc("leaderboard");
    if (error) throw error;
    return { me: u.user?.id, rows: data ?? [] };
  },
});

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({ meta: [
    { title: "Рейтинг учеников — Luminary" },
    { name: "description", content: "Лучшие ученики школы Luminary по просмотренным урокам и сданным домашкам." },
    { property: "og:title", content: "Рейтинг учеников — Luminary" },
    { property: "og:description", content: "Кто больше всех учится в Luminary." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: LeaderboardPage,
});

function Avatar({ path, name }: { path: string | null; name: string }) {
  const { data } = useQuery(avatarQuery(path));
  return data ? <img src={data} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lilac text-sm font-bold text-lilac-foreground">{name[0]?.toUpperCase()}</div>;
}

function LeaderboardPage() {
  const q = useQuery(leaderboardQuery);
  return <div className="mx-auto max-w-3xl space-y-6 pb-8">
    <header><h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl"><Trophy className="h-7 w-7" /> Рейтинг учеников</h1><p className="mt-2 text-sm text-muted-foreground">1 балл за просмотренный урок, 2 балла за сданную домашку.</p></header>
    {q.isPending ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Загружаем…</div>
      : q.isError ? <p className="text-destructive">Не удалось загрузить рейтинг.</p>
      : q.data.rows.length === 0 ? <p className="text-muted-foreground">Пока никто не набрал баллов — будьте первым!</p>
      : <ol className="panel divide-y p-2">{q.data.rows.map((r, i) => {
        const name = r.display_name || "Ученик";
        return <li key={r.id}><Link to="/u/$userId" params={{ userId: r.id }} className={`flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-tile ${r.id === q.data.me ? "bg-tile" : ""}`}>
          <span className={`w-8 text-center font-display text-lg font-bold ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>{i + 1}</span>
          <Avatar path={r.avatar_path} name={name} />
          <div className="min-w-0 flex-1"><p className="truncate font-bold">{name}{r.id === q.data.me && " (вы)"}</p><p className="text-xs text-muted-foreground">Уроки: {r.watched} · Домашки: {r.homework}</p></div>
          <span className="font-display text-lg font-bold">{r.score}</span>
        </Link></li>;
      })}</ol>}
  </div>;
}
