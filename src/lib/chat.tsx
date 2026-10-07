import { queryOptions } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Paperclip, Send, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data } = await supabase.auth.getUser();
    const id = data.user?.id ?? null;
    if (!id) return { id: null, roles: [] as string[] };
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", id);
    return { id, roles: (roles ?? []).map((r) => r.role as string) };
  },
});

export async function uploadChatFile(studentId: string, file: File) {
  const path = `${studentId}/${crypto.randomUUID()}-${file.name.replace(/[^\wа-яА-ЯёЁ.-]/g, "_")}`;
  const { error } = await supabase.storage.from("chat-files").upload(path, file);
  if (error) throw error;
  return { attachment_path: path, attachment_name: file.name };
}

export async function openChatFile(path: string) {
  const { data, error } = await supabase.storage.from("chat-files").createSignedUrl(path, 600);
  if (error || !data) { toast.error("Не удалось открыть файл"); return; }
  window.open(data.signedUrl, "_blank", "noopener");
}

export type ChatMsg = {
  id: string;
  body: string;
  created_at: string;
  mine: boolean;
  author?: string;
  attachment_path?: string | null;
  attachment_name?: string | null;
};

export function ChatThread({
  messages,
  onSend,
  empty,
  disabled,
  height = "h-[480px]",
}: {
  messages: ChatMsg[];
  onSend: (body: string, file: File | null) => Promise<void>;
  empty: string;
  disabled?: string;
  height?: string;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [messages.length]);

  const send = async () => {
    if ((!text.trim() && !file) || busy) return;
    if (file && file.size > 20 * 1024 * 1024) { toast.error("Файл больше 20 МБ"); return; }
    setBusy(true);
    try {
      await onSend(text.trim(), file);
      setText("");
      setFile(null);
    } catch (e) {
      toast.error("Не отправилось: " + (e as Error).message);
    }
    setBusy(false);
  };

  return (
    <div className={`panel flex flex-col p-3 ${height}`}>
      <div className="flex-1 space-y-2 overflow-y-auto p-1">
        {messages.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">{empty}</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.mine ? "bg-primary text-primary-foreground" : "bg-tile"}`}>
              {!m.mine && m.author && <div className="text-[11px] font-bold opacity-70">{m.author}</div>}
              {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
              {m.attachment_path && (
                <button
                  onClick={() => openChatFile(m.attachment_path!)}
                  className="mt-1 flex items-center gap-1.5 rounded-lg bg-card/60 px-2 py-1 text-xs font-semibold text-card-foreground"
                >
                  <FileText className="h-3.5 w-3.5" /> {m.attachment_name ?? "Файл"}
                </button>
              )}
              <div className="mt-0.5 text-[10px] opacity-60">
                {new Date(m.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {disabled ? (
        <p className="mt-2 rounded-xl bg-tile p-3 text-center text-sm text-muted-foreground">{disabled}</p>
      ) : (
        <>
          {file && (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-tile px-3 py-1.5 text-xs">
              <span className="truncate">📎 {file.name}</span>
              <button onClick={() => setFile(null)} aria-label="Убрать файл"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <button onClick={() => fileRef.current?.click()} aria-label="Прикрепить файл" className="rounded-xl border bg-card px-3 text-muted-foreground">
              <Paperclip className="h-4 w-4" />
            </button>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            <input
              className="w-full rounded-xl border bg-tile px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Сообщение…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <button onClick={send} disabled={busy} aria-label="Отправить" className="rounded-xl bg-primary px-4 text-primary-foreground disabled:opacity-50">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export const ticketStatus: Record<string, { label: string; cls: string }> = {
  open: { label: "Открыто", cls: "bg-like-soft text-like" },
  in_progress: { label: "В работе", cls: "bg-lilac text-lilac-foreground" },
  resolved: { label: "Решено", cls: "bg-primary text-primary-foreground" },
};

export const ticketCategories: Record<string, string> = {
  tech: "Не работает сайт",
  video: "Видео и эфиры",
  homework: "Домашние задания",
  payment: "Оплата и доступ",
  other: "Другое",
};
