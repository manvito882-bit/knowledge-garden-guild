import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mic, MicOff, Headphones, HeadphoneOff, PhoneOff, AudioLines, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { VoiceRoom, type VoicePeer } from "@/lib/voice";
import { meQuery } from "@/lib/chat";
import { supabase } from "@/integrations/supabase/client";

function initials(n: string) {
  return n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}

function Seat({ p, you }: { p: VoicePeer; you?: boolean }) {
  return (
    <div className="flex w-20 flex-col items-center gap-1.5">
      <div className="relative">
        <div
          title={p.status === "connecting" ? "Подключается…" : p.status === "failed" ? "Нет связи" : undefined}
          className={`${p.status === "connecting" ? "opacity-50 animate-pulse" : ""} flex h-14 w-14 items-center justify-center rounded-full font-display text-base font-bold transition-all ${
            p.speaking ? "bg-primary text-primary-foreground ring-4 ring-primary/40 scale-105" : "bg-tile text-foreground"
          }`}
        >
          {initials(p.name)}
        </div>
        {(p.muted || p.deafened) && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-like text-card">
            {p.deafened ? <HeadphoneOff className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
          </span>
        )}
      </div>
      <span className="w-full truncate text-center text-xs font-semibold">{you ? "Вы" : p.name}</span>
      {p.status === "connecting" && <span className="-mt-1 text-[10px] text-muted-foreground">подключается…</span>}
      {p.status === "failed" && <span className="-mt-1 text-[10px] text-like">нет связи</span>}
    </div>
  );
}

export function VoiceChat({ courseId }: { courseId: string }) {
  const { data: me } = useQuery(meQuery);
  const [peers, setPeers] = useState<VoicePeer[]>([]);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [name, setName] = useState("Участник");
  const room = useRef<VoiceRoom | null>(null);
  // one seat per tab, so the same student on phone + laptop does not collide
  const sid = useRef(`${Math.random().toString(36).slice(2, 10)}`);
  const myKey = me?.id ? `${me.id}:${sid.current}` : "";

  useEffect(() => {
    if (!me?.id) return;
    void supabase.from("profiles").select("display_name").eq("id", me.id).maybeSingle()
      .then(({ data }) => setName(data?.display_name?.trim() || "Участник"));
  }, [me?.id]);

  useEffect(() => () => room.current?.leave(), []);
  useEffect(() => {
    room.current?.leave();
    room.current = null;
    setJoined(false);
    setPeers([]);
  }, [courseId]);

  const join = async () => {
    if (!me?.id || room.current) return;
    setBusy(true);
    const r = new VoiceRoom(courseId, { id: myKey, name }, setPeers, (msg) => toast.error(msg));
    try {
      await r.join();
      room.current = r;
      setJoined(true);
    } catch {
      /* toast shown */
    } finally {
      setBusy(false);
    }
  };

  const leave = () => {
    room.current?.leave();
    room.current = null;
    setJoined(false);
    setPeers([]);
    setMuted(false);
    setDeafened(false);
  };

  const meSeat = peers.find((p) => p.id === myKey) ?? { id: "me", name, muted, deafened, speaking: false, status: "self" as const };
  const others = peers.filter((p) => p.id !== myKey);
  const btn = (on: boolean) =>
    `flex h-11 w-11 items-center justify-center rounded-full transition-colors ${on ? "bg-like text-card" : "bg-tile hover:bg-muted"}`;

  if (!joined) {
    return (
      <div className="panel flex items-center gap-4 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <AudioLines className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold">Голосовая комната курса</div>
          <div className="text-xs text-muted-foreground">Обсудите урок голосом с однокурсниками. Нужен микрофон.</div>
        </div>
        <button
          onClick={join}
          disabled={busy || !me?.id}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Войти
        </button>
      </div>
    );
  }

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          Голосовая комната
          <span className="rounded-full bg-tile px-2 py-0.5 text-xs font-semibold text-muted-foreground">{Math.max(peers.length, 1)}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Seat p={{ ...meSeat, muted, deafened }} you />
        {others.map((p) => <Seat key={p.id} p={p} />)}
      </div>
      {others.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">Пока вы здесь одни — позовите однокурсников на эту страницу.</p>
      )}

      <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl bg-background/60 p-2">
        <button onClick={async () => room.current && setMuted(await room.current.toggleMute())} aria-label={muted ? "Включить микрофон" : "Выключить микрофон"} className={btn(muted)}>
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        <button onClick={async () => room.current && setDeafened(await room.current.toggleDeafen())} aria-label={deafened ? "Включить звук" : "Выключить звук"} className={btn(deafened)}>
          {deafened ? <HeadphoneOff className="h-5 w-5" /> : <Headphones className="h-5 w-5" />}
        </button>
        <button onClick={leave} aria-label="Выйти" className="flex h-11 items-center gap-2 rounded-full bg-like px-5 text-sm font-bold text-card">
          <PhoneOff className="h-4 w-4" /> Выйти
        </button>
      </div>
    </div>
  );
}
