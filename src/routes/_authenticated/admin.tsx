import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isAdminQuery } from "@/lib/admin";
import { penColor } from "@/lib/school";

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
  const [tab, setTab] = useState<"teachers" | "courses" | "lessons" | "news">("courses");

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

  const save = async () => {
    report(
      (await supabase.from("lessons").update({ title, starts_at: new Date(startsAt).toISOString(), video_url: video || null }).eq("id", lesson.id)).error,
    );
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
        <input className={input} placeholder="Ссылка на видео" value={video} onChange={(e) => setVideo(e.target.value)} />
      </div>
      <button className={`${btn} mt-2`} onClick={save}>Сохранить</button>

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
