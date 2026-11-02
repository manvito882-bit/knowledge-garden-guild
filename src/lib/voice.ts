import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type VoicePeer = {
  id: string;
  name: string;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
};

type Signal =
  | { kind: "hello" }
  | { kind: "offer"; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; candidate: RTCIceCandidateInit };

// STUN finds direct routes; TURN relays audio when networks (mobile, school wifi) block direct links.
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    {
      urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443", "turns:openrelay.metered.ca:443?transport=tcp"],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

// Mesh voice room: presence lists who is in, broadcast carries WebRTC signaling.
// A newcomer says "hello"; every existing member then (re)creates a connection and sends the offer.
export class VoiceRoom {
  private channel: RealtimeChannel | null = null;
  private pcs = new Map<string, RTCPeerConnection>();
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();
  private audios = new Map<string, HTMLAudioElement>();
  private local: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private rafs = new Map<string, number>();
  private speaking = new Map<string, boolean>();
  private lastPeers: VoicePeer[] = [];
  muted = false;
  deafened = false;

  constructor(
    private courseId: string,
    private me: { id: string; name: string },
    private onPeers: (peers: VoicePeer[]) => void,
    private onError: (msg: string) => void,
  ) {}

  async join() {
    try {
      this.local = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      this.onError("Нет доступа к микрофону. Разрешите микрофон в браузере и попробуйте снова.");
      throw new Error("mic denied");
    }
    try {
      this.ctx = new AudioContext();
      void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
    this.watchSpeaking(this.me.id, this.local);

    const channel = supabase.channel(`voice-${this.courseId}`, {
      config: { presence: { key: this.me.id }, broadcast: { self: false } },
    });
    this.channel = channel;

    channel
      .on("presence", { event: "sync" }, () => this.handlePresence())
      .on("broadcast", { event: "signal" }, ({ payload }) => {
        const p = payload as { from: string; to: string; signal: Signal };
        if (p.from === this.me.id) return;
        if (p.to === this.me.id || (p.to === "*" && p.signal.kind === "hello")) void this.handleSignal(p.from, p.signal);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ name: this.me.name, muted: this.muted, deafened: this.deafened });
          this.send("*", { kind: "hello" });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          this.onError("Не удалось подключиться к голосовому чату. Проверьте интернет.");
        }
      });
  }

  private emit() {
    this.lastPeers = this.lastPeers.map((p) => ({ ...p, speaking: this.speaking.get(p.id) ?? false }));
    this.onPeers(this.lastPeers);
  }

  private handlePresence() {
    const state = this.channel?.presenceState() ?? {};
    this.lastPeers = Object.entries(state).map(([id, metas]) => {
      const m = (metas[0] ?? {}) as { name?: string; muted?: boolean; deafened?: boolean };
      return { id, name: m.name ?? "Участник", muted: !!m.muted, deafened: !!m.deafened, speaking: false };
    });
    this.emit();
    for (const [id] of this.pcs) if (!state[id]) this.dropPeer(id);
  }

  private newPc(peerId: string) {
    this.dropPeer(peerId);
    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.pcs.set(peerId, pc);
    this.local?.getTracks().forEach((t) => pc.addTrack(t, this.local!));
    pc.onicecandidate = (e) => {
      if (e.candidate) this.send(peerId, { kind: "ice", candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      let audio = this.audios.get(peerId);
      if (!audio) {
        audio = document.createElement("audio");
        audio.autoplay = true;
        audio.setAttribute("playsinline", "");
        audio.style.display = "none";
        document.body.appendChild(audio);
        this.audios.set(peerId, audio);
      }
      audio.srcObject = stream;
      audio.muted = this.deafened;
      audio.play().catch(() => {});
      this.watchSpeaking(peerId, stream);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        // try once more from the side with the smaller id
        if (this.me.id < peerId) void this.offer(peerId);
      }
    };
    return pc;
  }

  private dropPeer(id: string) {
    const pc = this.pcs.get(id);
    if (pc) {
      pc.onconnectionstatechange = null;
      pc.close();
    }
    this.pcs.delete(id);
    this.pendingIce.delete(id);
    const a = this.audios.get(id);
    if (a) {
      a.pause();
      a.srcObject = null;
      a.remove();
    }
    this.audios.delete(id);
    const raf = this.rafs.get(id);
    if (raf) cancelAnimationFrame(raf);
    this.rafs.delete(id);
  }

  private watchSpeaking(id: string, stream: MediaStream) {
    if (!this.ctx) return;
    const old = this.rafs.get(id);
    if (old) cancelAnimationFrame(old);
    try {
      const src = this.ctx.createMediaStreamSource(stream);
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        const now = avg > 10 && !(id === this.me.id && this.muted);
        if ((this.speaking.get(id) ?? false) !== now) {
          this.speaking.set(id, now);
          this.emit();
        }
        this.rafs.set(id, requestAnimationFrame(tick));
      };
      this.rafs.set(id, requestAnimationFrame(tick));
    } catch {
      // indicator is optional
    }
  }

  private send(to: string, signal: Signal) {
    void this.channel?.send({ type: "broadcast", event: "signal", payload: { from: this.me.id, to, signal } });
  }

  private async offer(peerId: string) {
    const pc = this.newPc(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.send(peerId, { kind: "offer", sdp: offer });
  }

  private async flushIce(id: string, pc: RTCPeerConnection) {
    for (const c of this.pendingIce.get(id) ?? []) await pc.addIceCandidate(c).catch(() => {});
    this.pendingIce.delete(id);
  }

  private async handleSignal(from: string, signal: Signal) {
    try {
      if (signal.kind === "hello") {
        await this.offer(from);
        return;
      }
      let pc = this.pcs.get(from);
      if (signal.kind === "offer") {
        // both sides offered at once: the smaller id keeps its own offer
        if (pc && pc.signalingState === "have-local-offer" && this.me.id < from) return;
        pc = this.newPc(from);
        await pc.setRemoteDescription(signal.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.send(from, { kind: "answer", sdp: answer });
        await this.flushIce(from, pc);
      } else if (signal.kind === "answer") {
        if (pc?.signalingState !== "have-local-offer") return;
        await pc.setRemoteDescription(signal.sdp);
        await this.flushIce(from, pc);
      } else {
        if (pc?.remoteDescription) await pc.addIceCandidate(signal.candidate).catch(() => {});
        else this.pendingIce.set(from, [...(this.pendingIce.get(from) ?? []), signal.candidate]);
      }
    } catch (e) {
      console.warn("voice signal error", e);
    }
  }

  async toggleMute() {
    this.muted = !this.muted;
    this.local?.getAudioTracks().forEach((t) => (t.enabled = !this.muted));
    await this.channel?.track({ name: this.me.name, muted: this.muted, deafened: this.deafened });
    return this.muted;
  }

  async toggleDeafen() {
    this.deafened = !this.deafened;
    this.audios.forEach((a) => (a.muted = this.deafened));
    await this.channel?.track({ name: this.me.name, muted: this.muted, deafened: this.deafened });
    return this.deafened;
  }

  leave() {
    for (const id of [...this.pcs.keys()]) this.dropPeer(id);
    const mine = this.rafs.get(this.me.id);
    if (mine) cancelAnimationFrame(mine);
    this.rafs.clear();
    this.local?.getTracks().forEach((t) => t.stop());
    this.local = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    if (this.channel) {
      void this.channel.untrack();
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}
