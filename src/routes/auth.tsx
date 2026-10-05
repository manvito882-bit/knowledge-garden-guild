import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Вход — Luminary" },
      { name: "description", content: "Войдите или зарегистрируйтесь в онлайн-школе Luminary." },
      { property: "og:title", content: "Вход — Luminary" },
      { property: "og:description", content: "Войдите в личный кабинет ученика." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/courses", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/courses", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error("Неверная почта или пароль");
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/courses", data: { display_name: name } },
      });
      if (error) toast.error(error.message);
      else toast.success("Проверьте почту — мы отправили ссылку для подтверждения");
    }
    setBusy(false);
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Не удалось войти через Google");
  };

  const input = "w-full rounded-xl border bg-tile px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="panel w-full max-w-sm p-6">
        <span className="font-display text-xl font-bold">luminary</span>
        <h1 className="mt-6 text-2xl font-bold">{mode === "in" ? "С возвращением" : "Создать аккаунт"}</h1>
        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === "up" && <input className={input} placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} required />}
          <input className={input} type="email" placeholder="Почта" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className={input} type="password" placeholder="Пароль" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button disabled={busy} className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-60">
            {mode === "in" ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>
        <button onClick={google} className="mt-3 w-full rounded-xl border bg-card py-3 text-sm font-semibold">
          Продолжить с Google
        </button>
        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 w-full text-sm text-muted-foreground">
          {mode === "in" ? "Нет аккаунта? Регистрация" : "Уже есть аккаунт? Войти"}
        </button>
      </div>
    </div>
  );
}
