import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/chat";
import { Avatar, fetchCards, socialCardQuery } from "@/lib/social";

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (s: Record<string, unknown>): { to?: string } => (typeof s.to === "string" ? { to: s.to } : {}),
  head: () => ({
    meta: [
      { title: "Сообщения — Luminary" },
      { name: "description", content: "Личная переписка между учениками Luminary." },
      { property: "og:title", content: "Сообщения — Luminary" },
      { property: "og:description", content: "Пишите одноклассникам в личные сообщения." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesPage,
});

type Dm = { id: string; sender_id: string; recipient_id: string; body: string; read: boolean; created_at: string };

function MessagesPage() {
  const { to } = Route.useSearch();
  const { data: me } = useQuery(meQuery);
  const qc = useQueryClient();
  const all = useQuery({
    queryKey: ["dms", me?.id],
    enabled: Boolean(me?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("direct_messages").select("id,sender_id,recipient_id,body,read,created_at").order("created_at").limit(1000);
      if (error) throw error;
      const msgs = (data ?? []) as Dm[];
      const other = (m: Dm) => (m.sender_id === me!.id ? m.recipient_id : m.sender_id);
      const cards = await fetchCards([...msgs.map(other), ...(to ? [to] : [])]);
      const map = new Map<string, { id: string; last: Dm; unread: number }>();
      for (const m of msgs) {
        const id = other(m);
        const cur = map.get(id) ?? { id, last: m, unread: 0 };
        cur.last = m;
        if (m.recipient_id === me!.id && !m.read) cur.unread++;
        map.set(id, cur);
      }
      return { msgs, cards, threads: [...map.values()].sort((a, b) => b.last.created_at.localeCompare(a.last.created_at)) };
    },
  });

  useEffect(() => {
    if (!me?.id) return;
    const ch = supabase.channel(`dm-${me.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, () => qc.invalidateQueries({ queryKey: ["dms"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me?.id, qc]);

  useEffect(() => {
    if (!to || !me?.id || !all.data) return;
    if (all.data.msgs.some((m) => m.sender_id === to && m.recipient_id === me.id && !m.read))
      supabase.from("direct_messages").update({ read: true }).eq("sender_id", to).eq("recipient_id", me.id).eq("read", false).then(() => qc.invalidateQueries({ queryKey: ["dms"] }));
  }, [to, me?.id, all.data, qc]);

  return (
    <div className="pb-8">
      <h1 className="mb-4 text-2xl font-bold md:text-3xl">Сообщения</h1>
      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <aside className={`panel divide-y self-start ${to ? "hidden md:block" : ""}`}>
          {!all.data ? <div className="h-24 animate-pulse" /> : all.data.threads.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Переписок пока нет. Откройте профиль ученика и нажмите «Написать».</p>
          ) : all.data.threads.map((t) => (
            <Link key={t.id} to="/messages" search={{ to: t.id }} className={`flex items-center gap-3 p-3 hover:bg-tile ${to === t.id ? "bg-tile" : ""}`}>
              <Avatar card={all.data.cards.get(t.id)} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{all.data.cards.get(t.id)?.display_name || "Ученик"}</div>
                <div className="truncate text-xs text-muted-foreground">{t.last.body}</div>
              </div>
              {t.unread > 0 && <span className="rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground">{t.unread}</span>}
            </Link>
          ))}
        </aside>
        {to && me?.id && all.data ? (
          <Thread meId={me.id} other={to} msgs={all.data.msgs.filter((m) => m.sender_id === to || m.recipient_id === to)} name={all.data.cards.get(to)?.display_name || "Ученик"} card={all.data.cards.get(to)} />
        ) : (
          <div className="panel hidden items-center justify-center p-10 text-sm text-muted-foreground md:flex">Выберите переписку</div>
        )}
      </div>
    </div>
  );
}

function Thread({ meId, other, msgs, name, card }: { meId: string; other: string; msgs: Dm[]; name: string; card: Parameters<typeof Avatar>[0]["card"] }) {
  const social = useQuery(socialCardQuery(other));
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [msgs.length]);
  const send = async () => {
    if (!text.trim()) return;
    const { error } = await supabase.from("direct_messages").insert({ sender_id: meId, recipient_id: other, body: text.trim().slice(0, 4000) });
    if (error) return toast.error("Не отправилось: этот ученик ограничил, кто может ему писать.");
    setText("");
    qc.invalidateQueries({ queryKey: ["dms"] });
  };
  const blocked = social.data && !social.data.can_dm;
  return (
    <section className="panel flex h-[600px] flex-col p-3">
      <div className="flex items-center gap-3 border-b pb-3">
        <Link to="/messages" search={{}} className="text-sm md:hidden">←</Link>
        <Avatar card={card} size="h-9 w-9" />
        <Link to="/u/$userId" params={{ userId: other }} className="font-bold hover:underline">{name}</Link>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-1 pt-3">
        {msgs.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Напишите первое сообщение.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.sender_id === meId ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.sender_id === meId ? "bg-primary text-primary-foreground" : "bg-tile"}`}>
              <div className="whitespace-pre-wrap break-words">{m.body}</div>
              <div className="mt-0.5 text-[10px] opacity-60">{new Date(m.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {blocked ? (
        <p className="mt-2 rounded-xl bg-tile p-3 text-center text-sm text-muted-foreground">Этот ученик ограничил, кто может ему писать.</p>
      ) : (
        <div className="mt-2 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Сообщение…"
            className="w-full rounded-xl border bg-tile px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <button onClick={send} aria-label="Отправить" className="rounded-xl bg-primary px-4 text-primary-foreground"><Send className="h-4 w-4" /></button>
        </div>
      )}
    </section>
  );
}
