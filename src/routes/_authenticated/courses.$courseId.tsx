import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowLeft, FileText, Download, ClipboardCheck, Heart, Radio, Play, MessageCircle, Send, Trash2, Eye, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { courseQuery, likesQuery, commentsQuery, fmtDate } from "@/lib/school";
import { isAdminQuery } from "@/lib/admin";
import { myProgressQuery, badgesQuery, badgeProgress } from "@/lib/rewards";
import { openLessonFile } from "@/lib/admin";
import cover from "@/assets/lesson-cover.jpg";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  validateSearch: z.object({ lesson: z.number().optional() }),
  head: () => ({
    meta: [
      { title: "Курс — Luminary" },
      { name: "description", content: "Уроки, эфиры, материалы и домашние задания курса." },
      { property: "og:title", content: "Курс — Luminary" },
      { property: "og:description", content: "Уроки, эфиры, материалы и домашние задания курса." },
    ],
  }),
  component: CoursePage,
});

function useCountdown(target: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return d > 0 ? `${d} дн ${h} ч` : `${h} ч ${m} мин`;
}

function CoursePage() {
  const { courseId } = Route.useParams();
  const { lesson: lessonNum } = Route.useSearch();
  const { data: course, isLoading } = useQuery(courseQuery(courseId));

  if (isLoading || !course) return <div className="panel h-96 animate-pulse" />;

  const lessons = course.lessons;
  const upcoming = lessons.find((l) => new Date(l.starts_at).getTime() > Date.now());
  const lesson = lessons.find((l) => l.number === lessonNum) ?? upcoming ?? lessons[0];

  return (
    <div className="flex flex-col gap-5 xl:flex-row">
      <div className="min-w-0 flex-1">
        <Link to="/courses" className="flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" /> Все курсы
        </Link>
        <span className="mt-3 inline-block rounded-full bg-tag px-3 py-1 text-xs font-semibold text-tag-foreground">{course.tag}</span>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">{course.title}</h1>

        {lesson ? <LessonView lesson={lesson} /> : <p className="mt-6 text-muted-foreground">Уроков пока нет</p>}
      </div>

      <aside className="w-full shrink-0 xl:w-80">
        <div className="panel p-3 xl:sticky xl:top-5">
          <h2 className="px-2 py-2 font-bold">Уроки · {lessons.length}</h2>
          <div className="space-y-2">
            {lessons.map((l) => {
              const f = fmtDate(l.starts_at);
              const isActive = l.id === lesson?.id;
              return (
                <Link
                  key={l.id}
                  to="/courses/$courseId"
                  params={{ courseId }}
                  search={{ lesson: l.number }}
                  className={`flex gap-3 rounded-xl px-3 py-2.5 ${isActive ? "bg-primary text-primary-foreground" : "bg-tile"}`}
                >
                  <span className="text-xs opacity-60">{String(l.number).padStart(2, "0")}</span>
                  <span>
                    <span className="block text-[11px] opacity-60">
                      {f.short} · {f.time}
                    </span>
                    <span className="block text-sm font-semibold leading-snug">{l.title}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}

type Lesson = {
  id: string;
  number: number;
  title: string;
  starts_at: string;
  video_url: string | null;
  lesson_files: { id: string; kind: string; name: string; url: string | null }[];
};

function LessonView({ lesson }: { lesson: Lesson }) {
  const countdown = useCountdown(lesson.starts_at);
  const f = fmtDate(lesson.starts_at);
  const materials = lesson.lesson_files.filter((x) => x.kind === "material");
  const homework = lesson.lesson_files.filter((x) => x.kind === "homework");

  return (
    <>
      {lesson.video_url?.startsWith("storage:") ? <VideoPlayer key={lesson.id} path={lesson.video_url.slice(8)} /> : <div className="relative mt-5 overflow-hidden rounded-3xl">
        <img src={cover} width={1280} height={720} alt="" className="aspect-video w-full object-cover" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
          <p className="max-w-md font-display text-lg font-bold leading-tight text-card md:text-3xl">{lesson.title}</p>
          {lesson.video_url ? (
            <a href={lesson.video_url} target="_blank" rel="noreferrer" className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
              Открыть видео
            </a>
          ) : (
            !countdown && (
              <span className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
                <Play className="h-3 w-3" /> Запись скоро
              </span>
            )
          )}
        </div>
        {countdown && (
          <div className="absolute bottom-4 left-4 flex items-center gap-3 rounded-xl bg-foreground/80 px-4 py-2.5 text-background">
            <Radio className="h-5 w-5" />
            <div className="text-xs font-semibold md:text-sm">
              Прямой эфир через {countdown}
              <div className="opacity-80">
                {f.long} в {f.time}
              </div>
            </div>
          </div>
        )}
      </div>}

      <h2 className="mt-6 text-lg font-bold md:text-xl">
        {String(lesson.number).padStart(2, "0")}. {lesson.title}
      </h2>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <FileBox tone="bg-lilac text-lilac-foreground" icon={<FileText className="h-4 w-4" />} title="Материалы к уроку" files={materials} />
        <FileBox tone="bg-primary text-primary-foreground" icon={<ClipboardCheck className="h-4 w-4" />} title="Домашнее задание" files={homework} />
      </div>

      <ProgressBox lessonId={lesson.id} />
      <LikeBox lessonId={lesson.id} />
      <Comments lessonId={lesson.id} />
    </>
  );
}

function VideoPlayer({ path }: { path: string }) {
  const { data, isError, refetch } = useQuery({
    queryKey: ["lesson-video", path],
    staleTime: 3_000_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("lesson-videos").createSignedUrl(path, 3600 * 4);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  if (isError) return <div className="mt-5 flex aspect-video items-center justify-center rounded-3xl bg-tile text-sm">Видео не загрузилось. <button className="ml-2 underline" onClick={() => void refetch()}>Повторить</button></div>;
  if (!data) return <div className="mt-5 aspect-video animate-pulse rounded-3xl bg-tile" />;
  return <video src={data} controls playsInline preload="metadata" controlsList="nodownload" className="mt-5 aspect-video w-full rounded-3xl bg-foreground" />;
}

function FileBox({ tone, icon, title, files }: { tone: string; icon: React.ReactNode; title: string; files: Lesson["lesson_files"] }) {
  const word = files.length === 1 ? "файл" : files.length < 5 && files.length > 0 ? "файла" : "файлов";
  return (
    <div className={`rounded-3xl p-4 ${tone}`}>
      <div className="mb-3 flex items-center gap-3">
        <span className="rounded-xl bg-card/60 p-2">{icon}</span>
        <div>
          <div className="text-sm font-bold">{title}</div>
          <div className="text-xs opacity-60">
            {files.length} {word}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {files.length === 0 && <p className="px-1 text-sm opacity-60">Пока ничего нет</p>}
        {files.map((file) => (
          <div key={file.id} className="flex items-center justify-between rounded-xl bg-card px-3 py-2.5 text-sm text-card-foreground">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" /> {file.name}
            </span>
            <button
              onClick={async () => { if (!(await openLessonFile(file.url))) toast("Файл скоро появится"); }}
              className="rounded-lg bg-tile p-1.5"
              aria-label="Скачать"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LikeBox({ lessonId }: { lessonId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery(likesQuery(lessonId));
  const toggle = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      if (data?.liked) await supabase.from("lesson_likes").delete().eq("lesson_id", lessonId).eq("user_id", u.user.id);
      else await supabase.from("lesson_likes").insert({ lesson_id: lessonId, user_id: u.user.id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["likes", lessonId] }),
  });

  return (
    <div className="panel mt-5 flex flex-col items-center gap-2 p-6">
      <button
        onClick={() => toggle.mutate()}
        className={`flex items-center gap-3 rounded-full border px-6 py-3 font-semibold ${data?.liked ? "bg-like-soft" : "bg-card"}`}
      >
        <Heart className={`h-5 w-5 text-like ${data?.liked ? "fill-current" : ""}`} />
        {data?.liked ? "Уже нравится" : "Нравится урок?"}
        <span className="rounded-full bg-like px-2.5 py-0.5 text-xs font-bold text-card">{data?.count ?? 0}</span>
      </button>
      <p className="text-xs text-muted-foreground">{data?.liked ? "Спасибо! Твой голос учтён" : "Поставь сердечко, если урок был полезен"}</p>
    </div>
  );
}

function Comments({ lessonId }: { lessonId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery(commentsQuery(lessonId));
  const { data: isAdmin } = useQuery(isAdminQuery);
  const [text, setText] = useState("");

  const send = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || !text.trim()) return;
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", u.user.id).maybeSingle();
      const author = profile?.display_name || u.user.email?.split("@")[0] || "Ученик";
      const { error } = await supabase.from("lesson_comments").insert({
        lesson_id: lessonId,
        user_id: u.user.id,
        author_name: author,
        body: text.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["comments", lessonId] });
    },
    onError: (e) => toast.error("Не отправлено: " + e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lesson_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", lessonId] }),
  });

  return (
    <div className="panel mt-5 p-5">
      <h3 className="flex items-center gap-2 font-bold">
        <MessageCircle className="h-4 w-4" /> Обсуждение урока
        <span className="rounded-full bg-tile px-2 py-0.5 text-xs text-muted-foreground">{data?.comments.length ?? 0}</span>
      </h3>
      <div className="mt-4 space-y-3">
        {data?.comments.length === 0 && <p className="text-sm text-muted-foreground">Пока тихо. Задай вопрос первым!</p>}
        {data?.comments.map((c) => {
          const f = fmtDate(c.created_at);
          const canDel = c.user_id === data.me || isAdmin;
          return (
            <div key={c.id} className="rounded-2xl bg-tile p-3">
              <div className="flex items-center justify-between gap-2">
                <Link to="/u/$userId" params={{ userId: c.user_id }} className="text-xs font-bold hover:underline">{c.author_name}</Link>
                <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {f.short} · {f.time}
                  {canDel && (
                    <button onClick={() => del.mutate(c.id)} aria-label="Удалить" className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{c.body}</p>
            </div>
          );
        })}
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-xl border bg-tile px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder="Вопрос или комментарий…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          disabled={!text.trim() || send.isPending}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          aria-label="Отправить"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function ProgressBox({ lessonId }: { lessonId: string }) {
  const qc = useQueryClient();
  const { data: progress } = useQuery(myProgressQuery);
  const { data: badges } = useQuery(badgesQuery);
  const row = progress?.find((p) => p.lesson_id === lessonId);
  const set = async (field: "watched" | "homework_done") => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const next = { watched: row?.watched ?? false, homework_done: row?.homework_done ?? false, [field]: !(row?.[field] ?? false) };
    const before = new Set((badges ?? []).filter((b) => badgeProgress(b, progress ?? []).earned).map((b) => b.id));
    const { error } = await supabase.from("lesson_progress").upsert({ user_id: u.user.id, lesson_id: lessonId, ...next, updated_at: new Date().toISOString() });
    if (error) { toast.error(error.message); return; }
    const fresh = await qc.fetchQuery({ ...myProgressQuery, staleTime: 0 });
    (badges ?? []).filter((b) => !before.has(b.id) && badgeProgress(b, fresh).earned).forEach((b) => toast.success(`Новая награда: ${b.title}!`));
  };
  const cls = (on?: boolean) => `flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${on ? "bg-primary text-primary-foreground" : "border bg-card"}`;
  return (
    <div className="mt-5 flex flex-col gap-2 sm:flex-row">
      <button className={cls(row?.watched)} onClick={() => set("watched")}><Eye className="h-4 w-4" /> {row?.watched ? "Урок просмотрен" : "Отметить просмотренным"}</button>
      <button className={cls(row?.homework_done)} onClick={() => set("homework_done")}><CheckCircle2 className="h-4 w-4" /> {row?.homework_done ? "Домашка сдана" : "Отметить: домашка сдана"}</button>
    </div>
  );
}
