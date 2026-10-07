import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Headphones, Plus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ChatThread, meQuery, uploadChatFile, ticketStatus, ticketCategories } from "@/lib/chat";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Поддержка — Luminary" },
      { name: "description", content: "Обращения в техподдержку и ответы на частые вопросы." },
      { property: "og:title", content: "Поддержка — Luminary" },
      { property: "og:description", content: "Обращения в техподдержку и ответы на частые вопросы." },
    ],
  }),
  component: SupportPage,
});

const faq = [
  ["Где смотреть запись эфира?", "Запись появляется на странице урока через несколько часов после эфира."],
  ["Как сдать домашнее задание?", "Скачай файл в блоке «Домашнее задание», выполни и отправь куратору в чате."],
  ["Как получить награду?", "Отмечай уроки просмотренными и сдавай домашки — значки появятся в разделе «Награды»."],
];

const input = "w-full rounded-xl border bg-tile px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

/** Messages of one ticket, used by both the student and the admin. */
export function TicketChat({ ticketId, studentId, asAdmin }: { ticketId: string; studentId: string; asAdmin: boolean }) {
  const qc = useQueryClient();
  const key = ["ticket-msgs", ticketId];
  const { data } = useQuery({
    queryKey: key,
    refetchInterval: 5000,
    queryFn: async () =>
      (await supabase
        .from("support_messages")
        .select("id,from_admin,body,created_at,attachment_path,attachment_name")
        .eq("ticket_id", ticketId)
        .order("created_at")).data ?? [],
  });
  return (
    <ChatThread
      empty="Сообщений пока нет"
      messages={(data ?? []).map((m) => ({ ...m, mine: m.from_admin === asAdmin, author: m.from_admin ? "Поддержка" : "Ученик" }))}
      onSend={async (body, file) => {
        const att = file ? await uploadChatFile(studentId, file) : {};
        const { error } = await supabase.from("support_messages").insert({ ticket_id: ticketId, user_id: studentId, from_admin: asAdmin, body, ...att });
        if (error) throw error;
        qc.invalidateQueries({ queryKey: key });
        qc.invalidateQueries({ queryKey: ["tickets"] });
      }}
    />
  );
}

function SupportPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const { data: tickets } = useQuery({
    queryKey: ["tickets", "mine"],
    enabled: !!me?.id,
    refetchInterval: 10000,
    queryFn: async () =>
      (await supabase.from("support_tickets").select("*").eq("user_id", me!.id!).order("updated_at", { ascending: false })).data ?? [],
  });
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "tech", body: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!me?.id || !form.subject.trim() || !form.body.trim()) { toast.error("Заполните тему и описание"); return; }
    setBusy(true);
    try {
      const { data: t, error } = await supabase
        .from("support_tickets")
        .insert({ user_id: me.id, subject: form.subject.trim(), category: form.category })
        .select("id")
        .single();
      if (error) throw error;
      const att = file ? await uploadChatFile(me.id, file) : {};
      const { error: e2 } = await supabase.from("support_messages").insert({ ticket_id: t.id, user_id: me.id, body: form.body.trim(), ...att });
      if (e2) throw e2;
      toast.success("Обращение отправлено");
      setForm({ subject: "", category: "tech", body: "" });
      setFile(null);
      setCreating(false);
      setOpen(t.id);
      qc.invalidateQueries({ queryKey: ["tickets"] });
    } catch (e) {
      toast.error("Ошибка: " + (e as Error).message);
    }
    setBusy(false);
  };

  const current = tickets?.find((t) => t.id === open);

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl"><Headphones className="h-6 w-6" /> Поддержка</h1>
        {!creating && !current && (
          <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
            <Plus className="h-4 w-4" /> Новое обращение
          </button>
        )}
      </div>

      {creating && (
        <div className="panel grid gap-2 p-4">
          <h2 className="font-bold">Новое обращение</h2>
          <input className={input} placeholder="Тема, например «Не открывается видео»" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <select className={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {Object.entries(ticketCategories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <textarea className={`${input} min-h-28`} placeholder="Опишите проблему подробно" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <label className={`${input} cursor-pointer text-muted-foreground`}>
            📎 {file ? file.name : "Прикрепить скриншот или файл (до 20 МБ)"}
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="flex gap-2">
            <button disabled={busy} onClick={create} className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">Отправить</button>
            <button onClick={() => setCreating(false)} className="rounded-xl border bg-card px-4 py-2.5 text-sm font-semibold">Отмена</button>
          </div>
        </div>
      )}

      {current && me?.id ? (
        <div className="space-y-3">
          <button onClick={() => setOpen(null)} className="flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft className="h-3 w-3" /> Все обращения</button>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">{current.subject}</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ticketStatus[current.status]?.cls}`}>{ticketStatus[current.status]?.label}</span>
          </div>
          {current.status === "resolved" && <p className="text-xs text-muted-foreground">Обращение решено. Если проблема осталась — просто напишите, и оно откроется снова.</p>}
          <TicketChat ticketId={current.id} studentId={me.id} asAdmin={false} />
        </div>
      ) : (
        !creating && (
          <div className="panel space-y-2 p-3">
            {tickets?.length === 0 && <p className="p-3 text-sm text-muted-foreground">У вас пока нет обращений. Нажмите «Новое обращение», если что-то не работает.</p>}
            {tickets?.map((t) => (
              <button key={t.id} onClick={() => setOpen(t.id)} className="flex w-full items-center justify-between gap-3 rounded-xl bg-tile px-3 py-2.5 text-left">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{t.subject}</div>
                  <div className="text-xs text-muted-foreground">{ticketCategories[t.category] ?? t.category} · {new Date(t.updated_at).toLocaleDateString("ru-RU")}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ticketStatus[t.status]?.cls}`}>{ticketStatus[t.status]?.label}</span>
              </button>
            ))}
          </div>
        )
      )}

      <div className="panel space-y-2 p-3">
        <h2 className="px-1 py-1 font-bold">Частые вопросы</h2>
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
