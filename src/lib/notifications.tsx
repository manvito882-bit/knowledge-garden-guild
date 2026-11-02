import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/chat";

export type Notification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

export const notificationsQuery = queryOptions({
  queryKey: ["notifications"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id,title,body,link,read,created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    return data as Notification[];
  },
});

export function NotificationBell() {
  const { data: me } = useQuery(meQuery);
  const { data: items } = useQuery({ ...notificationsQuery, enabled: !!me?.id });
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const box = useRef<HTMLDivElement>(null);

  const unread = (items ?? []).filter((n) => !n.read).length;

  useEffect(() => {
    if (!me?.id) return;
    const channel = supabase
      .channel(`notif-${me.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${me.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me?.id, qc]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const markRead = async (n: Notification) => {
    if (!n.read) await supabase.from("notifications").update({ read: true }).eq("id", n.id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
    setOpen(false);
    if (n.link) navigate({ to: n.link });
  };

  const markAll = async () => {
    if (!me?.id) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", me.id).eq("read", false);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Уведомления"
        className="relative rounded-xl border bg-card p-2"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-like px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="panel absolute right-0 top-12 z-50 max-h-[420px] w-80 overflow-y-auto p-2">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm font-bold">Уведомления</span>
            {unread > 0 && (
              <button onClick={markAll} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <CheckCheck className="h-3.5 w-3.5" /> Прочитать все
              </button>
            )}
          </div>
          {(items ?? []).length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">Пока пусто</p>
          )}
          {(items ?? []).map((n) => (
            <button
              key={n.id}
              onClick={() => markRead(n)}
              className={`block w-full rounded-xl px-3 py-2.5 text-left hover:bg-tile ${n.read ? "opacity-60" : ""}`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                {n.title}
              </span>
              {n.body && <span className="mt-0.5 block text-xs text-muted-foreground">{n.body}</span>}
              <span className="mt-1 block text-[10px] text-muted-foreground">
                {new Date(n.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
