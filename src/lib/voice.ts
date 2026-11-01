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
  | { kind: "offer"; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; candidate: RTCIceCandidateInit };

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};

// Mesh voice room over Supabase Realtime: presence tracks who is in,
// broadcast carries WebRTC signaling between peers.
export class VoiceRoom {
  private channel: RealtimeChannel | null = null;
  private pcs = new Map<string, RTCPeerConnection>();
  private audios = new Map<string, HTMLAudioElement>();
  private local: MediaStream | null = null;
  private analysers = new Map<string, { ctx: AudioContext; raf: number }>();
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
      this.local = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.onError("Нет доступа к микрофону. Разрешите микрофон в браузере и попробуйте снова.");
      throw new Error("mic denied");
    }

    const channel = supabase.channel(`voice-${this.courseId}`, {
      config: { presence: { key: this.me.id } },
    });
    this.channel = channel;

    channel
      .on("presence", { event: "sync" }, () => this.handlePresence())
      .on("broadcast", { event: "signal" }, ({ payload }) => {
        const p = payload as { from: string; to: string; signal: Signal };
        if (p.to === this.me.id) void this.handleSignal(p.from, p.signal);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ name: this.me.name, muted: this.muted, deafened: this.deafened });
        }
      });
  }

  private peers(): VoicePeer[] {
    const state = this.channel?.presenceState() ?? {};
    return Object.entries(state).map(([id, metas]) => {
      const m = (metas[0] ?? {}) as { name?: string; muted?: boolean; deafened?: boolean };
      const prev = this.lastPeers.find((p) => p.id === id);
      return { id, name: m.name ?? "Участник", muted: !!m.muted, deafened: !!m.deafened, speaking: prev?.speaking ?? false };
    });
  }

  private lastPeers: VoicePeer[] = [];

  private handlePresence() {
    const peers = this.peers();
    this.lastPeers = peers;
    this.onPeers(peers);
    // The peer with the lexicographically smaller id initiates the offer — avoids glare.
    for (const p of peers) {
      if (p.id !== this.me.id && !this.pcs.has(p.id) && this.me.id < p.id) {
        void this.createOffer(p.id);
      }
    }
    // Clean up peers that left.
    for (const [id, pc] of this.pcs) {
      if (!peers.some((p) => p.id === id)) this.dropPeer(id, pc);
    }
  }

  private newPc(peerId: string) {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.pcs.set(peerId, pc);
    this.local?.getTracks().forEach((t) => pc.addTrack(t, this.local!));
    pc.onicecandidate = (e) => {
      if (e.candidate) this.send(peerId, { kind: "ice", candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      let audio = this.audios.get(peerId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        this.audios.set(peerId, audio);
      }
      audio.srcObject = stream;
      audio.muted = this.deafened;
      this.watchSpeaking(peerId, stream);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") this.dropPeer(peerId, pc);
    };
    return pc;
  }

  private dropPeer(id: string, pc: RTCPeerConnection) {
    pc.close();
    this.pcs.delete(id);
    this.audios.get(id)?.pause();
    this.audios.delete(id);
    const an = this.analysers.get(id);
    if (an) {
      cancelAnimationFrame(an.raf);
      void an.ctx.close();
      this.analysers.delete(id);
    }
  }

  private watchSpeaking(peerId: string, stream: MediaStream) {
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const entry = { ctx, raf: 0 };
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        const speaking = avg > 8;
        const prev = this.lastPeers.find((p) => p.id === peerId);
        if (prev && prev.speaking !== speaking) {
          this.lastPeers = this.lastPeers.map((p) => (p.id === peerId ? { ...p, speaking } : p));
          this.onPeers(this.lastPeers);
        }
        entry.raf = requestAnimationFrame(tick);
      };
      entry.raf = requestAnimationFrame(tick);
      this.analysers.set(peerId, entry);
    } catch {
      // speaking indicator is optional
    }
  }

  private send(to: string, signal: Signal) {
    void this.channel?.send({
      type: "broadcast",
      event: "signal",
      payload: { from: this.me.id, to, signal },
    });
  }

  private async createOffer(peerId: string) {
    const pc = this.newPc(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.send(peerId, { kind: "offer", sdp: offer });
  }

  private async handleSignal(from: string, signal: Signal) {
    let pc = this.pcs.get(from);
    if (signal.kind === "offer") {
      pc ??= this.newPc(from);
      await pc.setRemoteDescription(signal.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.send(from, { kind: "answer", sdp: answer });
    } else if (signal.kind === "answer") {
      await pc?.setRemoteDescription(signal.sdp);
    } else {
      await pc?.addIceCandidate(signal.candidate).catch(() => {});
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
    for (const [id, pc] of this.pcs) this.dropPeer(id, pc);
    this.local?.getTracks().forEach((t) => t.stop());
    this.local = null;
    if (this.channel) {
      void this.channel.untrack();
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}
