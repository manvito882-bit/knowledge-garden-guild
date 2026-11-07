import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Feed, socialCardQuery } from "@/lib/social";
import { meQuery } from "@/lib/chat";
import { Award, BookOpen, Check, CheckCheck, Loader2, Play, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { avatarQuery } from "@/lib/profile";
import { coursesQuery } from "@/lib/school";
import { badgesQuery, badgeProgress, BadgeImage } from "@/lib/rewards";

const cardQuery = (id: string) => queryOptions({
  queryKey: ["student-card", id],
  queryFn: async () => {
    const [card, prog] = await Promise.all([
      supabase.rpc("student_card", { _id: id }),
      supabase.rpc("student_progress", { _id: id }),
    ]);
    if (card.error) throw card.error;
    if (prog.error) throw prog.error;
    return { card: card.data?.[0] ?? null, rows: (prog.data ?? []).map((r) => ({ ...r, lessons: { course_id: r.course_id } })) };
  },
});

export const Route = createFileRoute("/_authenticated/u/$userId")({
  head: () => ({ meta: [
    { title: "Профиль ученика — Luminary" },
    { name: "description", content: "Достижения и прогресс ученика онлайн-школы Luminary." },
    { property: "og:title", content: "Профиль ученика — Luminary" },
    { property: "og:description", content: "Награды и прогресс ученика школы Luminary." },
    { property: "og:type", content: "profile" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: StudentPage,
});

function StudentPage() {
  const { userId } = Route.useParams();
  const q = useQuery(cardQuery(userId));
  const courses = useQuery(coursesQuery);
  const badges = useQuery(badgesQuery);
  const avatar = useQuery(avatarQuery(q.data?.card?.avatar_path));
  const social = useQuery(socialCardQuery(userId));
  const { data: me } = useQuery(meQuery);
  const qc = useQueryClient();
  const toggleFollow = async () => {
    if (!me?.id) return;
    const r = social.data?.i_follow
      ? await supabase.from("follows").delete().eq("follower_id", me.id).eq("following_id", userId)
      : await supabase.from("follows").insert({ follower_id: me.id, following_id: userId });
    if (r.error) toast.error(r.error.message);
    qc.invalidateQueries({ queryKey: ["social-card", userId] });
    qc.invalidateQueries({ queryKey: ["relations"] });
  };

  if (q.isPending || courses.isPending || badges.isPending) return <div className="flex min-h-64 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Загружаем…</div>;
  if (q.isError || !q.data.card) return <div className="py-10"><h1 className="text-2xl font-bold">Профиль не найден</h1><Link to="/leaderboard" className="mt-3 inline-block underline">К рейтингу</Link></div>;
  const { card, rows } = q.data;
  const watched = rows.filter((r) => r.watched).length;
  const homework = rows.filter((r) => r.homework_done).length;
  const earned = (badges.data ?? []).filter((b) => badgeProgress(b, rows).earned);
  const active = (courses.data ?? []).filter((c) => rows.some((r) => r.course_id === c.id));
  const name = card.display_name || "Ученик";
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  return <div className="mx-auto max-w-5xl space-y-8 pb-8">
    <section className="border-y py-7">
      <div className="flex items-center gap-5">
        {avatar.data ? <img src={avatar.data} alt={name} className="h-24 w-24 rounded-full object-cover" /> : <div className="flex h-24 w-24 items-center justify-center rounded-full bg-lilac font-display text-2xl text-lilac-foreground">{initials}</div>}
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold">{name}</h1>
          {card.is_curator && <span className="mt-1 inline-block rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">Куратор</span>}
          {social.data?.bio && <p className="mt-2 whitespace-pre-wrap text-sm">{social.data.bio}</p>}
          {social.data && <p className="mt-2 text-sm"><b>{social.data.followers}</b> подписчиков · <b>{social.data.following}</b> подписок{social.data.i_follow && social.data.follows_me ? " · вы друзья" : social.data.follows_me ? " · подписан на вас" : ""}</p>}
          {me?.id && me.id !== userId && <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={toggleFollow} className={`rounded-xl px-4 py-2 text-sm font-bold ${social.data?.i_follow ? "border bg-card" : "bg-primary text-primary-foreground"}`}>{social.data?.i_follow ? "Отписаться" : "Подписаться"}</button>
            {social.data?.can_dm && <Link to="/messages" search={{ to: userId }} className="rounded-xl border bg-card px-4 py-2 text-sm font-semibold">Написать</Link>}
          </div>}
          <p className="mt-2 text-sm text-muted-foreground">В школе с {new Date(card.created_at).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</p>
        </div>
      </div>
      <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[{ icon: Play, v: watched, l: "Уроков просмотрено" }, { icon: CheckCheck, v: homework, l: "Домашек выполнено" }, { icon: BookOpen, v: active.length, l: "Курсов в работе" }, { icon: Award, v: earned.length, l: "Наград получено" }].map(({ icon: I, v, l }) => <div key={l} className="border-l-2 border-primary pl-4"><div className="flex items-center gap-2"><span className="text-2xl font-bold">{v}</span><I className="h-4 w-4 text-muted-foreground" /></div><p className="mt-1 text-xs text-muted-foreground">{l}</p></div>)}
      </div>
    </section>
    <section>
      <h2 className="mb-5 text-xl font-bold">Награды</h2>
      {earned.length === 0 ? <p className="text-sm text-muted-foreground">Пока нет наград.</p> : <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{earned.map((b) => <article key={b.id} className="flex flex-col items-center rounded-lg border bg-card p-5 text-center"><BadgeImage url={b.image_url} className="h-20 w-20 rounded-full" /><h3 className="mt-3 text-sm font-bold">{b.title}</h3><span className="mt-2 flex items-center gap-1 text-xs font-semibold text-pen-teal"><Check className="h-3 w-3" /> Получено</span></article>)}</div>}
    </section>
    <section>
      <h2 className="mb-5 text-xl font-bold">Посты</h2>
      {social.data?.can_see ? <Feed scope={{ kind: "author", id: userId }} /> : <p className="text-sm text-muted-foreground">Ученик скрыл свои посты.</p>}
    </section>
    <Link to="/leaderboard" className="inline-flex items-center gap-2 text-sm font-semibold underline"><Trophy className="h-4 w-4" /> Рейтинг учеников</Link>
  </div>;
}
