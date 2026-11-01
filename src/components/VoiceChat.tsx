import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mic, MicOff, Headphones, HeadphoneOff, Phone, PhoneOff, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { VoiceRoom, type VoicePeer } from "@/lib/voice";
import { meQuery } from "@/lib/chat";
import { supabase } from "@/integrations/supabase/client";

export function VoiceChat({ courseId }: { courseId: string }) {
  const { data: me } = useQuery(meQuery);
  const [peers, setPeers] = useState<VoicePeer[]>([]);
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [name, setName] = useState("Я");
  const room = useRef<VoiceRoom | null>(null);

  useEffect(() => {
    if (!me?.id) return;
    void supabase
      .from("profiles")
      .select("display_name")
      .eq("id", me.id)
      .maybeSingle()
      .then(({ data }) => setName(data?.display_name?.trim() || "Участник"));
  }, [me?.id]);

  useEffect(() => () => room.current?.leave(), []);

  const join = async () => {
    if (!me?.id || room.current) return;
    const r = new VoiceRoom(
      courseId,
      { id: me.id, name },
      setPeers,
      (msg) => toast.error(msg),
    );
    try {
      await r.join();
      room.current = r;
      setJoined(true);
    } catch {
      // toast already shown
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

  const toggleMute = async () => {
    if (room.current) setMuted(await room.current.toggleMute());
  };

  const toggleDeafen = async () => {
    if (room.current) setDeafened(await room.current.toggleDeafen());
  };

  const others = peers.filter((p) => p.id !== me?.id);

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold">
          <Volume2 className="h-4 w-4 text-primary" /> Голосовой чат
          {peers.length > 0 && (
            <span className="rounded-full bg-tile px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {peers.length}
            </span>
          )}
        </h2>
        {!joined ? (
          <button
            onClick={join}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Phone className="h-4 w-4" /> Подключиться
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={toggleMute}
              aria-label={muted ? "Включить микрофон" : "Выключить микрофон"}
              className={`rounded-xl border p-2 ${muted ? "bg-like-soft text-like" : "bg-card"}`}
            >
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              onClick={toggleDeafen}
              aria-label={deafened ? "Включить звук" : "Выключить звук"}
              className={`rounded-xl border p-2 ${deafened ? "bg-like-soft text-like" : "bg-card"}`}
            >
              {deafened ? <HeadphoneOff className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
            </button>
            <button
              onClick={leave}
              aria-label="Отключиться"
              className="rounded-xl bg-like-soft p-2 text-like"
            >
              <PhoneOff className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {joined && (
        <div className="mt-3 flex flex-wrap gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground`}
          >
            {muted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
            {name} (вы)
          </span>
          {others.map((p) => (
            <span
              key={p.id}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                p.speaking ? "bg-primary text-primary-foreground" : "bg-tile"
              }`}
            >
              {p.muted ? <MicOff className="h-3 w-3 opacity-60" /> : <Mic className="h-3 w-3" />}
              {p.name}
              {p.deafened && <HeadphoneOff className="h-3 w-3 opacity-60" />}
            </span>
          ))}
          {others.length === 0 && (
            <span className="py-1.5 text-xs text-muted-foreground">Пока вы здесь одни — позовите однокурсников!</span>
          )}
        </div>
      )}
      {!joined && (
        <p className="mt-2 text-xs text-muted-foreground">
          Общайтесь голосом с теми, кто сейчас на этом курсе. Нужен микрофон.
        </p>
      )}
    </div>
  );
}
