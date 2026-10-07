import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Eye, CheckCircle2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/chat";
import { CuratorChat } from "@/lib/curator";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({
    meta: [
      { title: "Мои ученики — Luminary" },
      { name: "description", content: "Кабинет куратора: ученики, их прогресс и чаты." },
      { property: "og:title", content: "Мои ученики — Luminary" },
      { property: "og:description", content: "Кабинет куратора онлайн-школы Luminary." },
    ],
  }),
  component: StudentsPage,
});

function StudentsPage() {
  const { data: me } = useQuery(meQuery);
  const isCurator = !!me?.roles.includes("curator");
  const { data: students } = useQuery({
    queryKey: ["my-students", me?.id],
    enabled: isCurator,
    queryFn: async () => {
      const { data: a } = await supabase.from("curator_assignments").select("student_id").eq("curator_id", me!.id!);
      const ids = (a ?? []).map((x) => x.student_id);
      if (!ids.length) return [];
      const [{ data: profiles }, { data: progress }, { data: lessons }] = await Promise.all([
        supabase.from("profiles").select("id,display_name,email").in("id", ids),
        supabase.from("lesson_progress").select("user_id,watched,homework_done,updated_at,lessons(title,courses(title))").in("user_id", ids),
        supabase.from("lessons").select("id", { count: "exact", head: true }),
      ]);
      void lessons;
      return ids.map((id) => {
        const p = profiles?.find((x) => x.id === id);
        const rows = (progress ?? []).filter((r) => r.user_id === id).sort((x, y) => y.updated_at.localeCompare(x.updated_at));
        return {
          id,
          name: p?.display_name ?? p?.email ?? "Ученик",
          email: p?.email ?? "",
          watched: rows.filter((r) => r.watched).length,
          homework: rows.filter((r) => r.homework_done).length,
          recent: rows.slice(0, 6),
        };
      });
    },
  });
  const { data: totalLessons } = useQuery({
    queryKey: ["lessons-count"],
    queryFn: async () => (await supabase.from("lessons").select("id", { count: "exact", head: true })).count ?? 0,
  });
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");

  if (me && !isCurator)
    return (
      <div className="panel p-6">
        <h1 className="text-xl font-bold">Только для кураторов</h1>
        <Link to="/courses" className="mt-3 inline-block text-sm font-semibold underline">К курсам</Link>
      </div>
    );

  const list = (students ?? []).filter((s) => (s.name + s.email).toLowerCase().includes(q.toLowerCase()));
  const current = students?.find((s) => s.id === sel);

  return (
    <div className="max-w-5xl space-y-5">
      <h1 className="text-2xl font-bold md:text-3xl">Мои ученики</h1>
      <div className="grid gap-4 md:grid-cols-[300px_1fr]">
        <div className="panel space-y-2 p-3">
          <div className="flex items-center gap-2 rounded-xl bg-tile px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input className="w-full bg-transparent py-2.5 text-sm outline-none" placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {students?.length === 0 && <p className="p-2 text-sm text-muted-foreground">За вами пока не закреплены ученики.</p>}
          {list.map((s) => (
            <button key={s.id} onClick={() => setSel(s.id)} className={`w-full rounded-xl px-3 py-2.5 text-left ${sel === s.id ? "bg-primary text-primary-foreground" : "bg-tile"}`}>
              <div className="truncate text-sm font-semibold">{s.name}</div>
              <div className="mt-0.5 flex gap-3 text-xs opacity-70">
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {s.watched}/{totalLessons ?? "—"}</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {s.homework}</span>
              </div>
            </button>
          ))}
        </div>
        {current && me?.id ? (
          <div className="space-y-3">
            <div className="panel p-4">
              <div className="font-bold">{current.name}</div>
              <div className="text-xs text-muted-foreground">{current.email}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-tile p-3"><div className="text-xl font-bold">{current.watched}</div><div className="text-xs text-muted-foreground">уроков просмотрено</div></div>
                <div className="rounded-xl bg-tile p-3"><div className="text-xl font-bold">{current.homework}</div><div className="text-xs text-muted-foreground">домашек сдано</div></div>
              </div>
              {current.recent.length > 0 && (
                <div className="mt-3 space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground">Последняя активность</div>
                  {current.recent.map((r, i) => (
                    <div key={i} className="flex justify-between gap-2 text-xs">
                      <span className="truncate">{r.lessons?.courses?.title} · {r.lessons?.title}</span>
                      <span className="shrink-0 text-muted-foreground">{r.watched ? "👁" : ""}{r.homework_done ? " ✅" : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <CuratorChat studentId={current.id} meId={me.id} otherName={current.name} />
          </div>
        ) : (
          <div className="panel p-6 text-sm text-muted-foreground">Выберите ученика</div>
        )}
      </div>
    </div>
  );
}
