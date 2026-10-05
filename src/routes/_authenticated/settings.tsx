import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sun, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Настройки — Luminary" },
      { name: "description", content: "Профиль и оформление личного кабинета." },
      { property: "og:title", content: "Настройки — Luminary" },
      { property: "og:description", content: "Профиль и оформление личного кабинета." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [uid, setUid] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUid(data.user.id);
      setEmail(data.user.email ?? "");
      const { data: p } = await supabase.from("profiles").select("display_name").eq("id", data.user.id).maybeSingle();
      setName(p?.display_name ?? "");
    });
  }, []);

  const save = async () => {
    const { error } = await supabase.from("profiles").upsert({ id: uid, display_name: name });
    if (error) toast.error("Не удалось сохранить");
    else toast.success("Сохранено");
  };

  const opt = (t: "light" | "dark", label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setTheme(t)}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${theme === t ? "bg-primary text-primary-foreground" : "bg-tile"}`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-2xl font-bold md:text-3xl">Настройки</h1>
      <section className="panel p-5">
        <h2 className="font-bold">Профиль</h2>
        <p className="mt-1 text-sm text-muted-foreground">{email}</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ваше имя"
          className="mt-4 w-full rounded-xl border bg-tile px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button onClick={save} className="mt-3 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">
          Сохранить
        </button>
      </section>
      <section className="panel p-5">
        <h2 className="font-bold">Оформление</h2>
        <div className="mt-4 flex gap-3">
          {opt("light", "Светлая", <Sun className="h-4 w-4" />)}
          {opt("dark", "Тёмная", <Moon className="h-4 w-4" />)}
        </div>
      </section>
    </div>
  );
}
