import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isAdminQuery } from "@/lib/admin";
import { penColor } from "@/lib/school";
import { badgesQuery, BadgeImage, conditionLabel } from "@/lib/rewards";
import { TicketChat } from "./support";
import { ticketStatus, ticketCategories } from "@/lib/chat";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Админка — Luminary" },
      { name: "description", content: "Управление преподавателями, курсами, уроками и файлами." },
      { property: "og:title", content: "Админка — Luminary" },
      { property: "og:description", content: "Управление школой Luminary." },
    ],
  }),
  component: AdminPage,
});

const input = "w-full rounded-xl border bg-tile px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";
const btn = "inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50";
const iconBtn = "rounded-lg bg-tile p-2 text-muted-foreground hover:text-destructive";

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

function report(error: { message: string } | null, ok = "Сохранено") {
  if (error) toast.error("Ошибка: " + error.message);
  else toast.success(ok);
}

function AdminPage() {
  const { data: isAdmin, isLoading } = useQuery(isAdminQuery);
  const [tab, setTab] = useState<"teachers" | "courses" | "lessons" | "news" | "support" | "badges" | "curators">("courses");

  if (isLoading) return <div className="panel h-64 animate-pulse" />;
  if (!isAdmin)
    return (
      <div className="panel p-6">
        <h1 className="text-xl font-bold">Нет доступа</h1>
        <p className="mt-1 text-sm text-muted-foreground">Этот раздел только для администраторов.</p>
        <Link to="/courses" className={`${btn} mt-4`}>К курсам</Link>
      </div>
    );

  const tabs = [
    ["courses", "Курсы"],
    ["lessons", "Уроки и файлы"],
    ["teachers", "Преподаватели"],
    ["news", "Новости"],
    ["badges", "Награды"],
    ["support", "Поддержка"],
    ["curators", "Кураторы"],
  ] as const;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold md:text-3xl">Админка</h1>
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {tabs.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold ${tab === k ? "bg-primary text-primary-foreground" : "border bg-card"}`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {tab === "teachers" && <Teachers />}
        {tab === "courses" && <Courses />}
        {tab === "lessons" && <Lessons />}
        {tab === "news" && <News />}
        {tab === "badges" && <Badges />}
        {tab === "support" && <Support />}
        {tab === "curators" && <Curators />}
      </div>
    </div>
  );
}

/* ---------- Teachers ---------- */
function Teachers() {
  const inv = useInvalidate();
  const { data } = useQuery({
    queryKey: ["admin-teachers"],
    queryFn: async () => (await supabase.from("teachers").select("*").order("position")).data ?? [],
  });
  const [name, setName] = useState("");
  const [color, setColor] = useState("lime");

  const add = async () => {
    if (!name.trim()) return undefined;
    const { error } = await supabase.from("teachers").insert({ name, color, position: (data?.length ?? 0) + 1 });
    report(error, "Преподаватель добавлен");
    setName("");
    inv();
  };
  const del = async (id: string) => {
    if (!confirm("Удалить преподавателя вместе с его курсами?")) return;
    report((await supabase.from("teachers").delete().eq("id", id)).error, "Удалено");
    inv();
  };

  return (
    <div className="space-y-4">
      <div className="panel flex flex-col gap-2 p-4 sm:flex-row">
        <input className={input} placeholder="Имя или название" value={name} onChange={(e) => setName(e.target.value)} />
        <select className={`${input} sm:w-40`} value={color} onChange={(e) => setColor(e.target.value)}>
          <option value="lime">Салатовый</option>
          <option value="orange">Оранжевый</option>
          <option value="teal">Бирюзовый</option>
          <option value="blue">Синий</option>
        </select>
        <button className={btn} onClick={add}><Plus className="h-4 w-4" /> Добавить</button>
      </div>
      <div className="panel space-y-2 p-3">
        {data?.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-xl bg-tile px-3 py-2.5 text-sm font-medium">
            <span className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full bg-current ${penColor[t.color]}`} /> {t.name}
            </span>
            <button className={iconBtn} onClick={() => del(t.id)} aria-label="Удалить"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Courses ---------- */
function Courses() {
  const inv = useInvalidate();
  const { data: teachers } = useQuery({
    queryKey: ["admin-teachers"],
    queryFn: async () => (await supabase.from("teachers").select("*").order("position")).data ?? [],
  });
  const { data: courses } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => (await supabase.from("courses").select("*, teachers(name)").order("created_at")).data ?? [],
  });
  const [form, setForm] = useState({ title: "", tag: "", description: "", teacher_id: "" });

  const add = async () => {
    const teacher_id = form.teacher_id || teachers?.[0]?.id;
    if (!form.title.trim() || !form.tag.trim() || !teacher_id) { toast.error("Заполните название, метку и преподавателя"); return; }
    report((await supabase.from("courses").insert({ ...form, teacher_id })).error, "Курс создан");
    setForm({ title: "", tag: "", description: "", teacher_id: "" });
    inv();
  };
  const del = async (id: string) => {
    if (!confirm("Удалить курс со всеми уроками?")) return;
    report((await supabase.from("courses").delete().eq("id", id)).error, "Удалено");
    inv();
  };

  return (
    <div className="space-y-4">
      <div className="panel grid gap-2 p-4 sm:grid-cols-2">
        <input className={input} placeholder="Название курса" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input className={input} placeholder="Метка, напр. «русский язык · ЕГЭ 2027»" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} />
        <select className={input} value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}>
          {teachers?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input className={input} placeholder="Короткое описание" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button className={`${btn} sm:col-span-2`} onClick={add}><Plus className="h-4 w-4" /> Создать курс</button>
      </div>
      <div className="panel space-y-2 p-3">
        {courses?.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl bg-tile px-3 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{c.title}</div>
              <div className="text-xs text-muted-foreground">{c.tag} · {c.teachers?.name}</div>
            </div>
            <button className={iconBtn} onClick={() => del(c.id)} aria-label="Удалить"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- News ---------- */
function News() {
  const inv = useInvalidate();
  const { data: posts } = useQuery({
    queryKey: ["news"],
    queryFn: async () =>
      (await supabase.from("news_posts").select("id,title,body,created_at").order("created_at", { ascending: false })).data ?? [],
  });
  const [form, setForm] = useState({ title: "", body: "" });

  const add = async () => {
    if (!form.title.trim() || !form.body.trim()) { toast.error("Заполните заголовок и текст"); return; }
    report((await supabase.from("news_posts").insert(form)).error, "Новость опубликована");
    setForm({ title: "", body: "" });
    inv();
  };
  const del = async (id: string) => {
    if (!confirm("Удалить новость?")) return;
    report((await supabase.from("news_posts").delete().eq("id", id)).error, "Удалено");
    inv();
  };

  return (
    <div className="space-y-4">
      <div className="panel grid gap-2 p-4">
        <input className={input} placeholder="Заголовок" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea
          className={`${input} min-h-28 resize-y`}
          placeholder="Текст новости"
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
        />
        <button className={btn} onClick={add}><Plus className="h-4 w-4" /> Опубликовать</button>
      </div>
      <div className="panel space-y-2 p-3">
        {posts?.map((p) => (
          <div key={p.id} className="flex items-start justify-between gap-3 rounded-xl bg-tile px-3 py-2.5">
            <div className="min-w-0">
              <div className="text-sm font-semibold">{p.title}</div>
              <div className="line-clamp-2 text-xs text-muted-foreground">{p.body}</div>
            </div>
            <button className={iconBtn} onClick={() => del(p.id)} aria-label="Удалить"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {posts?.length === 0 && <p className="px-1 text-sm text-muted-foreground">Новостей пока нет.</p>}
      </div>
    </div>
  );
}

/* ---------- Lessons ---------- */
function Lessons() {
  const inv = useInvalidate();
  const { data: courses } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => (await supabase.from("courses").select("*, teachers(name)").order("created_at")).data ?? [],
  });
  const [courseId, setCourseId] = useState("");
  const cid = courseId || courses?.[0]?.id || "";
  const { data: lessons } = useQuery({
    queryKey: ["admin-lessons", cid],
    enabled: !!cid,
    queryFn: async () =>
      (await supabase.from("lessons").select("*, lesson_files(*)").eq("course_id", cid).order("number")).data ?? [],
  });
  const [form, setForm] = useState({ title: "", starts_at: "", video_url: "" });

  const add = async () => {
    if (!form.title.trim() || !form.starts_at) { toast.error("Укажите тему и дату"); return; }
    const number = (lessons?.reduce((m, l) => Math.max(m, l.number), 0) ?? 0) + 1;
    report(
      (await supabase.from("lessons").insert({
        course_id: cid,
        number,
        title: form.title,
        starts_at: new Date(form.starts_at).toISOString(),
        video_url: form.video_url || null,
      })).error,
      "Урок добавлен",
    );
    setForm({ title: "", starts_at: "", video_url: "" });
    inv();
  };

  return (
    <div className="space-y-4">
      <select className={input} value={cid} onChange={(e) => setCourseId(e.target.value)}>
        {courses?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      <div className="panel grid gap-2 p-4 sm:grid-cols-2">
        <input className={`${input} sm:col-span-2`} placeholder="Тема урока" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input className={input} type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
        <input className={input} placeholder="Ссылка на видео (необязательно)" value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} />
        <button className={`${btn} sm:col-span-2`} onClick={add} disabled={!cid}><Plus className="h-4 w-4" /> Добавить урок</button>
      </div>
      <div className="space-y-3">
        {lessons?.map((l) => <LessonEditor key={l.id} lesson={l} onChange={inv} />)}
        {lessons?.length === 0 && <p className="text-sm text-muted-foreground">В этом курсе пока нет уроков.</p>}
      </div>
    </div>
  );
}

type LessonRow = {
  id: string;
  number: number;
  title: string;
  starts_at: string;
  video_url: string | null;
  lesson_files: { id: string; kind: string; name: string; url: string | null }[];
};

function toLocal(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function LessonEditor({ lesson, onChange }: { lesson: LessonRow; onChange: () => void }) {
  const [title, setTitle] = useState(lesson.title);
  const [startsAt, setStartsAt] = useState(toLocal(lesson.starts_at));
  const [video, setVideo] = useState(lesson.video_url ?? "");
  const [kind, setKind] = useState("material");
  const [busy, setBusy] = useState(false);
  const [videoBusy, setVideoBusy] = useState<number | null>(null);

  const save = async () => {
    report(
      (await supabase.from("lessons").update({ title, starts_at: new Date(startsAt).toISOString(), video_url: video || null }).eq("id", lesson.id)).error,
    );
    onChange();
  };
  const setLessonVideo = async (value: string | null) => {
    const old = lesson.video_url;
    const { error } = await supabase.from("lessons").update({ video_url: value }).eq("id", lesson.id);
    if (error) return error;
    if (old?.startsWith("storage:") && old !== value) await supabase.storage.from("lesson-videos").remove([old.slice(8)]);
    setVideo(value ?? "");
    return null;
  };
  const uploadVideo = async (file: File) => {
    if (!file.type.startsWith("video/")) { toast.error("Выберите видеофайл (MP4, WebM, MOV)"); return; }
    if (file.size > 2 * 1024 ** 3) { toast.error("Видео больше 2 ГБ"); return; }
    setVideoBusy(0);
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
    const path = `${lesson.id}/${crypto.randomUUID()}.${ext}`;
    try {
      const { data: s } = await supabase.auth.getSession();
      const url = `${import.meta.env['VITE_SUPABASE_URL']}/storage/v1/object/lesson-videos/${path}`;
      // XHR instead of the client upload so the admin sees progress on big files.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        xhr.setRequestHeader("Authorization", `Bearer ${s.session?.access_token ?? ""}`);
        xhr.setRequestHeader("apikey", import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY']);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => e.lengthComputable && setVideoBusy(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText)));
        xhr.onerror = () => reject(new Error("network"));
        xhr.send(file);
      });
      const err = await setLessonVideo("storage:" + path);
      if (err) { await supabase.storage.from("lesson-videos").remove([path]); throw err; }
      toast.success("Видео загружено");
      onChange();
    } catch {
      toast.error("Не удалось загрузить видео");
    } finally { setVideoBusy(null); }
  };
  const removeVideo = async () => {
    if (!confirm("Удалить видео урока?")) return;
    report(await setLessonVideo(null), "Видео удалено");
    onChange();
  };
  const del = async () => {
    if (!confirm("Удалить урок?")) return;
    report((await supabase.from("lessons").delete().eq("id", lesson.id)).error, "Удалено");
    onChange();
  };
  const upload = async (file: File) => {
    setBusy(true);
    const path = `${lesson.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const up = await supabase.storage.from("lesson-files").upload(path, file);
    if (up.error) {
      report(up.error);
    } else {
      const name = file.name.replace(/\.[^.]+$/, "");
      report((await supabase.from("lesson_files").insert({ lesson_id: lesson.id, kind, name, url: "storage:" + path })).error, "Файл загружен");
    }
    setBusy(false);
    onChange();
  };
  const delFile = async (f: LessonRow["lesson_files"][number]) => {
    if (f.url?.startsWith("storage:")) await supabase.storage.from("lesson-files").remove([f.url.slice(8)]);
    report((await supabase.from("lesson_files").delete().eq("id", f.id)).error, "Файл удалён");
    onChange();
  };

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">Урок {String(lesson.number).padStart(2, "0")}</span>
        <button className={iconBtn} onClick={del} aria-label="Удалить урок"><Trash2 className="h-4 w-4" /></button>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input className={`${input} sm:col-span-2`} value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className={input} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        {video.startsWith("storage:") ? (
          <div className={`${input} flex items-center justify-between gap-2`}>
            <span className="truncate">Видео загружено</span>
            <button type="button" className={iconBtn} onClick={removeVideo} aria-label="Удалить видео"><Trash2 className="h-4 w-4" /></button>
          </div>
        ) : (
          <input className={input} placeholder="Ссылка на видео" value={video} onChange={(e) => setVideo(e.target.value)} />
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button className={btn} onClick={save}>Сохранить</button>
        <label className={`${btn} cursor-pointer ${videoBusy !== null ? "opacity-60" : ""}`}>
          <Upload className="mr-1 inline h-4 w-4" />
          {videoBusy !== null ? `Загрузка видео… ${videoBusy}%` : "Загрузить видео"}
          <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" disabled={videoBusy !== null}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadVideo(f); e.target.value = ""; }} />
        </label>
      </div>

      <div className="mt-4 space-y-2">
        {lesson.lesson_files.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-xl bg-tile px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" /> {f.name}
              <span className="rounded-md bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">{f.kind === "homework" ? "ДЗ" : "материал"}</span>
            </span>
            <button className={iconBtn} onClick={() => delFile(f)} aria-label="Удалить файл"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <div className="flex flex-col gap-2 sm:flex-row">
          <select className={`${input} sm:w-48`} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="material">Материал к уроку</option>
            <option value="homework">Домашнее задание</option>
          </select>
          <label className={`${btn} cursor-pointer ${busy ? "opacity-50" : ""}`}>
            <Upload className="h-4 w-4" /> {busy ? "Загрузка…" : "Загрузить файл"}
            <input type="file" className="hidden" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        </div>
      </div>
    </div>
  );
}

/* ---------- Support ---------- */
function Support() {
  const inv = useInvalidate();
  const [filter, setFilter] = useState("active");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const { data: tickets } = useQuery({
    queryKey: ["tickets", "admin"],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data } = await supabase.from("support_tickets").select("*").order("updated_at", { ascending: false });
      const ids = [...new Set((data ?? []).map((t) => t.user_id))];
      const { data: profiles } = ids.length ? await supabase.from("profiles").select("id,display_name,email").in("id", ids) : { data: [] };
      return (data ?? []).map((t) => {
        const p = profiles?.find((x) => x.id === t.user_id);
        return { ...t, name: p?.display_name ?? "Ученик", email: p?.email ?? "" };
      });
    },
  });
  const list = (tickets ?? []).filter(
    (t) => (filter === "all" || (filter === "active" ? t.status !== "resolved" : t.status === filter)) &&
      (t.subject + t.name + t.email).toLowerCase().includes(q.toLowerCase()),
  );
  const cur = tickets?.find((t) => t.id === sel);
  const setStatus = async (status: string) => {
    if (!cur) return;
    const { data: u } = await supabase.auth.getUser();
    report((await supabase.from("support_tickets").update({ status, assignee_id: u.user?.id ?? null }).eq("id", cur.id)).error, "Статус обновлён");
    inv();
  };
  return (
    <div className="grid gap-4 md:grid-cols-[300px_1fr]">
      <div className="panel space-y-2 p-3">
        <input className={input} placeholder="Поиск: тема, имя, почта" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={input} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="active">Нерешённые</option><option value="open">Открытые</option>
          <option value="in_progress">В работе</option><option value="resolved">Решённые</option><option value="all">Все</option>
        </select>
        {list.length === 0 && <p className="p-2 text-sm text-muted-foreground">Обращений нет</p>}
        {list.map((t) => (
          <button key={t.id} onClick={() => setSel(t.id)} className={`w-full rounded-xl px-3 py-2.5 text-left ${sel === t.id ? "bg-primary text-primary-foreground" : "bg-tile"}`}>
            <div className="flex items-center justify-between gap-2 text-sm font-semibold"><span className="truncate">{t.subject}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${ticketStatus[t.status]?.cls}`}>{ticketStatus[t.status]?.label}</span></div>
            <div className="truncate text-xs opacity-70">{t.name} · {ticketCategories[t.category] ?? t.category}</div>
          </button>
        ))}
      </div>
      {cur ? (
        <div className="space-y-3">
          <div className="panel flex flex-wrap items-center justify-between gap-2 p-4">
            <div><div className="font-bold">{cur.subject}</div><div className="text-xs text-muted-foreground">{cur.name} {cur.email}</div></div>
            <div className="flex gap-1">
              {Object.entries(ticketStatus).map(([k, v]) => (
                <button key={k} onClick={() => setStatus(k)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${cur.status === k ? v.cls : "border bg-card"}`}>{v.label}</button>
              ))}
            </div>
          </div>
          <TicketChat ticketId={cur.id} studentId={cur.user_id} asAdmin />
        </div>
      ) : <div className="panel p-6 text-sm text-muted-foreground">Выберите обращение</div>}
    </div>
  );
}

/* ---------- Badges ---------- */
function Badges() {
  const inv = useInvalidate();
  const { data: badges } = useQuery(badgesQuery);
  const { data: courses } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => (await supabase.from("courses").select("*, teachers(name)").order("created_at")).data ?? [],
  });
  const [form, setForm] = useState({ title: "", description: "", course_id: "", condition: "videos", threshold: 3 });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!form.title.trim() || form.threshold < 1) { toast.error("Укажите название и количество"); return; }
    setBusy(true);
    let image_url: string | null = null;
    if (file) {
      const path = `badges/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("lesson-files").upload(path, file);
      if (error) { toast.error("Картинка не загрузилась: " + error.message); setBusy(false); return; }
      image_url = "storage:" + path;
    }
    const { error } = await supabase.from("badges").insert({ ...form, course_id: form.course_id || null, image_url });
    report(error, "Награда создана");
    setBusy(false);
    setForm({ title: "", description: "", course_id: "", condition: "videos", threshold: 3 });
    setFile(null);
    inv();
  };
  const del = async (id: string) => {
    if (!confirm("Удалить награду?")) return;
    report((await supabase.from("badges").delete().eq("id", id)).error, "Удалено");
    inv();
  };

  return (
    <div className="space-y-4">
      <div className="panel grid gap-2 p-4 sm:grid-cols-2">
        <input className={input} placeholder="Название награды" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input className={input} placeholder="Описание (необязательно)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <select className={input} value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
          <option value="videos">Просмотрено уроков</option>
          <option value="homework">Сдано домашек</option>
        </select>
        <input className={input} type="number" min={1} value={form.threshold} onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })} />
        <select className={input} value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
          <option value="">Любой курс</option>
          {courses?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <label className={`${input} flex cursor-pointer items-center gap-2`}>
          <Upload className="h-4 w-4" /> <span className="truncate">{file ? file.name : "Картинка значка"}</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <button disabled={busy} className={`${btn} sm:col-span-2`} onClick={add}><Plus className="h-4 w-4" /> Создать награду</button>
      </div>
      <div className="panel space-y-2 p-3">
        {badges?.map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl bg-tile px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <BadgeImage url={b.image_url} className="h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{b.title}</div>
                <div className="text-xs text-muted-foreground">{b.threshold} {conditionLabel(b.condition)} · {b.courses?.title ?? "любой курс"}</div>
              </div>
            </div>
            <button className={iconBtn} onClick={() => del(b.id)} aria-label="Удалить"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Curators ---------- */
function Curators() {
  const inv = useInvalidate();
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-people"],
    queryFn: async () => {
      const [{ data: people }, { data: roles }, { data: asg }] = await Promise.all([
        supabase.from("profiles").select("id,display_name,email").order("created_at"),
        supabase.from("user_roles").select("user_id,role").eq("role", "curator"),
        supabase.from("curator_assignments").select("student_id,curator_id"),
      ]);
      const curatorIds = new Set((roles ?? []).map((r) => r.user_id));
      return (people ?? []).map((p) => ({
        ...p,
        name: p.display_name ?? p.email ?? "Без имени",
        isCurator: curatorIds.has(p.id),
        curatorId: asg?.find((a) => a.student_id === p.id)?.curator_id ?? "",
        students: (asg ?? []).filter((a) => a.curator_id === p.id).length,
      }));
    },
  });
  const curators = (data ?? []).filter((p) => p.isCurator);
  const list = (data ?? []).filter((p) => (p.name + (p.email ?? "")).toLowerCase().includes(q.toLowerCase()));

  const toggleRole = async (id: string, on: boolean) => {
    if (on) report((await supabase.from("user_roles").insert({ user_id: id, role: "curator" })).error, "Назначен куратором");
    else {
      if (!confirm("Снять роль куратора? Его ученики останутся без куратора.")) return;
      await supabase.from("curator_assignments").delete().eq("curator_id", id);
      report((await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "curator")).error, "Роль снята");
    }
    inv();
  };
  const assign = async (studentId: string, curatorId: string) => {
    const { error } = curatorId
      ? await supabase.from("curator_assignments").upsert({ student_id: studentId, curator_id: curatorId })
      : await supabase.from("curator_assignments").delete().eq("student_id", studentId);
    report(error, curatorId ? "Куратор закреплён" : "Куратор откреплён");
    inv();
  };

  return (
    <div className="space-y-4">
      <div className="panel p-4 text-sm text-muted-foreground">
        Отметьте сотрудников как кураторов, затем выберите куратора каждому ученику. Куратор увидит своих учеников в разделе «Мои ученики».
      </div>
      <input className={input} placeholder="Поиск по имени или почте" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="panel space-y-2 p-3">
        {list.map((p) => (
          <div key={p.id} className="flex flex-col gap-2 rounded-xl bg-tile px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{p.name}{p.isCurator && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">куратор · {p.students} уч.</span>}</div>
              <div className="truncate text-xs text-muted-foreground">{p.email}</div>
            </div>
            <div className="flex gap-2">
              {!p.isCurator && (
                <select className={`${input} sm:w-48`} value={p.curatorId} onChange={(e) => assign(p.id, e.target.value)}>
                  <option value="">Без куратора</option>
                  {curators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <button onClick={() => toggleRole(p.id, !p.isCurator)} className="shrink-0 rounded-xl border bg-card px-3 py-2 text-xs font-semibold">
                {p.isCurator ? "Снять куратора" : "Сделать куратором"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
