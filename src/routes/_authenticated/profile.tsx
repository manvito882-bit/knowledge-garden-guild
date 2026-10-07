import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Award, ArrowUpRight, BookOpen, Camera, Check, CheckCheck, Loader2, Pencil, Play, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { myProfileQuery, avatarQuery } from "@/lib/profile";
import { coursesQuery } from "@/lib/school";
import { badgesQuery, myProgressQuery, badgeProgress, BadgeImage } from "@/lib/rewards";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [
    { title: "Мой профиль — Luminary" },
    { name: "description", content: "Личный профиль ученика, прогресс по курсам и полученные награды школы Luminary." },
    { property: "og:title", content: "Мой профиль — Luminary" },
    { property: "og:description", content: "Достижения и прогресс обучения в школе Luminary." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ProfilePage,
});

function ProfilePage() {
  const profile = useQuery(myProfileQuery);
  const progress = useQuery(myProgressQuery);
  const courses = useQuery(coursesQuery);
  const badges = useQuery(badgesQuery);
  const avatar = useQuery(avatarQuery(profile.data?.avatar_path));
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const updateName = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile.data || busy || !name.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", profile.data.id).select("id").single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["my-profile"] });
      setEditing(false);
      toast.success("Имя сохранено");
    } catch { toast.error("Не удалось сохранить имя"); }
    finally { setBusy(false); }
  };

  const changeAvatar = async (file: File | null) => {
    if (!profile.data || busy) return;
    const types: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    if (file && (!types[file.type] || file.size > 5 * 1024 * 1024)) {
      toast.error("Выберите JPG, PNG или WebP до 5 МБ");
      return;
    }
    setBusy(true);
    let newPath: string | null = null;
    try {
      if (file) {
        // Decode and re-encode the picture so the stored file is an actual image without original metadata.
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) { bitmap.close(); throw new Error("Не удалось обработать фото"); }
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Не удалось обработать фото")), "image/webp", 0.85));
        newPath = `${profile.data.id}/${crypto.randomUUID()}.webp`;
        const { error } = await supabase.storage.from("avatars").upload(newPath, blob, { contentType: "image/webp" });
        if (error) throw error;
      }
      const { error } = await supabase.from("profiles").update({ avatar_path: newPath }).eq("id", profile.data.id).select("id").single();
      if (error) throw error;
      const oldPath = profile.data.avatar_path;
      await qc.invalidateQueries({ queryKey: ["my-profile"] });
      if (oldPath) await supabase.storage.from("avatars").remove([oldPath]);
      toast.success(file ? "Фото сохранено" : "Фото удалено");
    } catch {
      if (newPath) await supabase.storage.from("avatars").remove([newPath]);
      toast.error("Не удалось изменить фото");
    } finally { setBusy(false); }
  };

  if (profile.isPending || progress.isPending || courses.isPending || badges.isPending) {
    return <div className="flex min-h-64 items-center justify-center gap-2 text-muted-foreground" role="status"><Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" /> Загружаем профиль…</div>;
  }
  if (profile.isError || progress.isError || courses.isError || badges.isError) {
    return <div role="alert" className="space-y-4 py-10"><h1 className="text-2xl font-bold">Профиль пока недоступен</h1><Button onClick={() => { void profile.refetch(); void progress.refetch(); void courses.refetch(); void badges.refetch(); }}>Попробовать снова</Button></div>;
  }
  const user = profile.data;
  const rows = progress.data ?? [];
  const watched = rows.filter((p) => p.watched).length;
  const homework = rows.filter((p) => p.homework_done).length;
  const earned = (badges.data ?? []).filter((b) => badgeProgress(b, rows).earned);
  const activeCourses = (courses.data ?? []).filter((c) => rows.some((p) => p.lessons?.course_id === c.id && (p.watched || p.homework_done)));
  const initials = (user.display_name || "Ученик").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return <div className="mx-auto max-w-5xl space-y-8 pb-8">
    <header className="flex items-center justify-between gap-4"><h1 className="text-2xl font-bold md:text-3xl">Мой профиль</h1><span className="text-sm text-muted-foreground">Luminary · школа</span></header>
    <section className="border-y py-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative w-fit shrink-0">
          {avatar.data ? <img src={avatar.data} alt="Фото профиля" className="h-28 w-28 rounded-full object-cover" /> : <div className="flex h-28 w-28 items-center justify-center rounded-full bg-lilac font-display text-3xl text-lilac-foreground" aria-label="Аватар профиля">{initials}</div>}
          <Button size="icon" className="absolute -bottom-1 -right-1 rounded-full border-4 border-background" disabled={busy} onClick={() => fileRef.current?.click()} aria-label="Загрузить фото" title="Загрузить фото">{busy ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Camera />}</Button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Фото профиля" onChange={(e) => { const file = e.target.files?.[0]; if (file) void changeAvatar(file); e.target.value = ""; }} />
        </div>
        <div className="min-w-0 flex-1">
          {editing ? <form onSubmit={updateName} className="flex flex-wrap items-center gap-2">
            <input aria-label="Имя ученика" autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 rounded-lg border bg-card px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
            <Button type="submit" size="icon" disabled={busy || !name.trim()} aria-label="Сохранить имя" title="Сохранить имя"><Check /></Button>
            <Button type="button" variant="ghost" size="icon" disabled={busy} aria-label="Отменить" title="Отменить" onClick={() => setEditing(false)}><X /></Button>
          </form> : <div className="flex items-start gap-2"><h2 className="break-words text-2xl font-bold [overflow-wrap:anywhere]">{user.display_name || "Ученик"}</h2><Button variant="ghost" size="icon" className="shrink-0" aria-label="Изменить имя" title="Изменить имя" onClick={() => { setName(user.display_name ?? ""); setEditing(true); }}><Pencil /></Button></div>}
          <p className="mt-2 text-sm text-muted-foreground">В школе с {new Date(user.created_at).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</p>
          {user.avatar_path && <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" disabled={busy} onClick={() => void changeAvatar(null)}><Trash2 /> Удалить фото</Button>}
          {avatar.isError && <p role="alert" className="mt-2 text-sm text-destructive">Фото не загрузилось. <Button variant="link" size="sm" onClick={() => void avatar.refetch()}>Повторить</Button></p>}
        </div>
      </div>
      <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">
        {[{ icon: Play, value: watched, label: "Уроков просмотрено" }, { icon: CheckCheck, value: homework, label: "Домашек выполнено" }, { icon: BookOpen, value: activeCourses.length, label: "Курсов в работе" }, { icon: Award, value: earned.length, label: "Наград получено" }].map(({ icon: Icon, value, label }) => <div key={label} className="border-l-2 border-primary pl-4"><div className="flex items-center gap-2"><span className="text-2xl font-bold">{value}</span><Icon className="h-4 w-4 text-muted-foreground" /></div><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>)}
      </div>
    </section>
    <section>
      <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Витрина наград</h2><Button asChild variant="ghost" size="sm"><Link to="/awards">Все награды <ArrowUpRight /></Link></Button></div>
      {earned.length === 0 ? <div className="flex items-center gap-4 rounded-lg bg-lilac p-5 text-lilac-foreground"><Award className="h-9 w-9 shrink-0" /><div><p className="font-bold">Первая награда впереди</p><p className="mt-1 text-sm">Полученные значки появятся здесь.</p></div></div> : <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{earned.map((b) => <article key={b.id} className="flex flex-col items-center rounded-lg border bg-card p-5 text-center"><BadgeImage url={b.image_url} className="h-20 w-20 rounded-full" /><h3 className="mt-3 break-words text-sm font-bold">{b.title}</h3>{b.description && <p className="mt-1 break-words text-xs text-muted-foreground">{b.description}</p>}<span className="mt-3 flex items-center gap-1 text-xs font-semibold text-pen-teal"><Check className="h-3 w-3" /> Получено</span></article>)}</div>}
    </section>
    <section>
      <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Прогресс по курсам</h2><Button asChild variant="ghost" size="sm"><Link to="/courses">Все курсы <ArrowUpRight /></Link></Button></div>
      {activeCourses.length === 0 ? <div className="border-y py-6 text-sm text-muted-foreground">Пока нет начатых курсов.</div> : <div className="divide-y border-y">{activeCourses.map((c) => {
        const courseRows = rows.filter((p) => p.lessons?.course_id === c.id);
        const videos = courseRows.filter((p) => p.watched).length;
        const tasks = courseRows.filter((p) => p.homework_done).length;
        const percent = c.lessons.length ? Math.min(100, Math.round(videos / c.lessons.length * 100)) : 0;
        return <article key={c.id} className="py-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link to="/courses/$courseId" params={{ courseId: c.id }} search={{}} className="break-words font-bold hover:underline">{c.title}</Link><p className="mt-1 text-xs text-muted-foreground">{c.teachers?.name} · {c.tag}</p></div><span className="text-sm font-bold">{percent}%</span></div><progress aria-label={`Просмотр уроков: ${c.title}`} value={videos} max={Math.max(1, c.lessons.length)} className="profile-progress mt-4 h-2 w-full" /><p className="mt-2 text-xs text-muted-foreground">Уроки: {videos} / {c.lessons.length} · Домашки: {tasks} / {c.lessons.length}</p></article>;
      })}</div>}
    </section>
  </div>;
}