import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Layers, CalendarDays, PenLine, Headphones, Moon, Sun, Settings, LogOut, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { teachersQuery, penColor } from "@/lib/school";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: Shell,
});

function Shell() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] gap-5 p-3 md:p-5">
      <aside className="sticky top-5 hidden h-[calc(100vh-2.5rem)] w-60 shrink-0 md:block">
        <Nav onNavigate={() => {}} />
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center justify-between md:hidden">
          <span className="font-display text-lg font-bold">luminary</span>
          <button onClick={() => setOpen(true)} aria-label="Меню" className="rounded-xl border bg-card p-2">
            <Menu className="h-5 w-5" />
          </button>
        </div>
        <Outlet />
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-foreground/30 md:hidden" onClick={() => setOpen(false)}>
          <div className="h-full w-72 p-3" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} aria-label="Закрыть" className="absolute right-4 top-4 rounded-xl border bg-card p-2">
              <X className="h-5 w-5" />
            </button>
            <Nav onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function Nav({ onNavigate }: { onNavigate: () => void }) {
  const { data: teachers } = useQuery(teachersQuery);
  const { theme, toggle } = useTheme();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const item = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-tile";
  const active = { className: "bg-primary text-primary-foreground hover:bg-primary" };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <nav className="panel flex h-full flex-col overflow-y-auto p-3">
      <Link to="/courses" activeOptions={{ exact: true }} activeProps={active} className={item} onClick={onNavigate}>
        <Layers className="h-4 w-4" /> Все курсы
      </Link>
      <Link to="/schedule" activeProps={active} className={item} onClick={onNavigate}>
        <CalendarDays className="h-4 w-4" /> Расписание
      </Link>
      <hr className="my-3" />
      <div className="space-y-0.5">
        {teachers?.map((t) =>
          t.courses[0] ? (
            <Link
              key={t.id}
              to="/courses/$courseId"
              params={{ courseId: t.courses[0].id }}
              search={{}}
              activeProps={active}
              className={item}
              onClick={onNavigate}
            >
              <PenLine className={`h-4 w-4 ${penColor[t.color] ?? ""}`} /> {t.name}
            </Link>
          ) : (
            <span key={t.id} className={`${item} text-muted-foreground`}>
              <PenLine className={`h-4 w-4 ${penColor[t.color] ?? ""}`} /> {t.name}
            </span>
          ),
        )}
      </div>
      <hr className="my-3" />
      <Link to="/support" activeProps={active} className={item} onClick={onNavigate}>
        <Headphones className="h-4 w-4" /> Поддержка
      </Link>
      <Link to="/settings" activeProps={active} className={item} onClick={onNavigate}>
        <Settings className="h-4 w-4" /> Настройки
      </Link>
      <button onClick={toggle} className={item}>
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        {theme === "dark" ? "Светлая тема" : "Тёмная тема"}
      </button>
      <div className="mt-auto pt-3">
        <hr className="mb-3" />
        <button onClick={signOut} className={`${item} w-full text-muted-foreground`}>
          <LogOut className="h-4 w-4" /> Выйти
        </button>
      </div>
    </nav>
  );
}
