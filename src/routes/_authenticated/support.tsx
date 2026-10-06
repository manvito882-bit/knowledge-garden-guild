import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Send, Headphones } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Поддержка — Luminary" },
      { name: "description", content: "Чат с техподдержкой и ответы на частые вопросы." },
      { property: "og:title", content: "Поддержка — Luminary" },
      { property: "og:description", content: "Чат с техподдержкой и ответы на частые вопросы." },
    ],
  }),
  component: SupportPage,
});

const faq = [
  ["Где смотреть запись эфира?", "Запись появляется на странице урока через несколько часов после эфира."],
  ["Как сдать домашнее задание?", "Скачай файл в блоке «Домашнее задание», выполни и нажми «Домашка сдана»."],
  ["Как получить награду?", "Отмечай уроки просмотренными и сдавай домашки — значки появятся в разделе «Награды»."],
];

export function SupportChat({ userId, asAdmin }: { userId: string; asAdmin: boolean }) {
  const qc = useQueryClient();
  const key = ["support", userId];
  const { data } = useQuery({
    queryKey: key,
    refetchInterval: 5000,
    queryFn: async () =>
      (await supabase.from("support_messages").select("id,from_admin,body,created_at").eq("user_id", userId).order("created_at")).data ?? [],
  });
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [data?.length]);

  const send = async () => {
    if (!text.trim()) return;
    const { error } = await supabase.from("support_messages").insert({ user_id: userId, from_admin: asAdmin, body: text.trim() });
    if (error) { toast.error("Не отправилось: " + error.message); return; }
    setText("");
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["support-threads"] });
  };

  return (
    <div className="panel flex h-[480px] flex-col p-3">
      <div className="flex-1 space-y-2 overflow-y-auto p-1">
        {data?.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">
            {asAdmin ? "Сообщений нет" : "Опиши проблему — поддержка ответит здесь же."}
          </p>
        )}
        {data?.map((m) => {
          const mine = m.from_admin === asAdmin;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-tile"}`}>
                {!mine && m.from_admin && <div className="text-[11px] font-bold opacity-70">Поддержка</div>}
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div className="mt-0.5 text-[10px] opacity-60">
                  {new Date(m.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className="w-full rounded-xl border bg-tile px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder="Сообщение…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button onClick={send} aria-label="Отправить" className="rounded-xl bg-primary px-4 text-primary-foreground">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SupportPage() {
  const { data: uid } = useQuery({ queryKey: ["me-id"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null });
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl"><Headphones className="h-6 w-6" /> Поддержка</h1>
      {uid && <SupportChat userId={uid} asAdmin={false} />}
      <div className="panel space-y-2 p-3">
        {faq.map(([q, a]) => (
          <details key={q} className="rounded-xl bg-tile px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold">{q}</summary>
            <p className="mt-2 text-sm text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
