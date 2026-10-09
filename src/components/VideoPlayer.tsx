import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, PictureInPicture2, RotateCcw, RotateCw } from "lucide-react";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function fmt(sec: number) {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

export function VideoPlayer({ src, className = "" }: { src: string; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [seeking, setSeeking] = useState(false);

  const v = () => videoRef.current;

  const poke = () => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (v() && !v()!.paused && !seeking) setControlsVisible(false);
    }, 2500);
  };

  useEffect(() => {
    poke();
    return () => clearTimeout(hideTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const togglePlay = () => {
    const el = v();
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
    poke();
  };

  const skip = (delta: number) => {
    const el = v();
    if (!el) return;
    el.currentTime = Math.min(Math.max(0, el.currentTime + delta), el.duration || 0);
    poke();
  };

  const onSeek = (val: number) => {
    const el = v();
    if (!el) return;
    el.currentTime = val;
    setTime(val);
  };

  const changeVolume = (val: number) => {
    const el = v();
    if (!el) return;
    el.volume = val;
    el.muted = val === 0;
    setVolume(val);
    setMuted(val === 0);
    poke();
  };

  const toggleMute = () => {
    const el = v();
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
    poke();
  };

  const cycleSpeed = () => {
    const el = v();
    if (!el) return;
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1;
    el.playbackRate = next;
    setSpeed(next);
    poke();
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.current?.requestFullscreen();
    poke();
  };

  const togglePip = async () => {
    const el = v();
    if (!el) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await el.requestPictureInPicture();
    } catch {
      // PiP unsupported — ignore
    }
    poke();
  };

  const progress = duration > 0 ? (time / duration) * 100 : 0;
  const bufPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={wrapRef}
      className={`group relative overflow-hidden rounded-3xl bg-foreground ${className}`}
      onMouseMove={poke}
      onTouchStart={poke}
    >
      <video
        ref={videoRef}
        src={src}
        playsInline
        preload="metadata"
        controlsList="nodownload"
        className="aspect-video w-full cursor-pointer"
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => { setPlaying(false); setControlsVisible(true); }}
        onTimeUpdate={() => !seeking && setTime(v()?.currentTime ?? 0)}
        onDurationChange={() => setDuration(v()?.duration ?? 0)}
        onLoadedMetadata={() => setDuration(v()?.duration ?? 0)}
        onProgress={() => {
          const el = v();
          if (el && el.buffered.length > 0) setBuffered(el.buffered.end(el.buffered.length - 1));
        }}
        onDoubleClick={toggleFullscreen}
      />

      {/* big center play when paused */}
      {!playing && (
        <button
          onClick={togglePlay}
          aria-label="Смотреть"
          className="absolute inset-0 flex items-center justify-center bg-foreground/30"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 md:h-20 md:w-20">
            <Play className="h-8 w-8 fill-current" />
          </span>
        </button>
      )}

      {/* controls */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/90 to-transparent px-3 pb-2.5 pt-8 transition-opacity md:px-4 ${
          controlsVisible || !playing ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* seek bar */}
        <div className="relative mb-2 h-4">
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-background/25">
            <div className="absolute inset-y-0 left-0 rounded-full bg-background/40" style={{ width: `${bufPct}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            aria-label="Перемотка"
            onPointerDown={() => setSeeking(true)}
            onPointerUp={() => setSeeking(false)}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>

        <div className="flex items-center gap-1.5 text-background md:gap-2">
          <button onClick={togglePlay} aria-label={playing ? "Пауза" : "Смотреть"} className="rounded-lg p-1.5 hover:bg-background/15">
            {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
          </button>
          <button onClick={() => skip(-10)} aria-label="Назад на 10 секунд" className="hidden rounded-lg p-1.5 hover:bg-background/15 sm:block">
            <RotateCcw className="h-4.5 w-4.5" />
          </button>
          <button onClick={() => skip(10)} aria-label="Вперёд на 10 секунд" className="hidden rounded-lg p-1.5 hover:bg-background/15 sm:block">
            <RotateCw className="h-4.5 w-4.5" />
          </button>

          <div className="group/vol flex items-center">
            <button onClick={toggleMute} aria-label={muted ? "Включить звук" : "Выключить звук"} className="rounded-lg p-1.5 hover:bg-background/15">
              {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              aria-label="Громкость"
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="hidden w-0 accent-[oklch(var(--primary))] transition-all group-hover/vol:w-20 sm:block md:w-20"
            />
          </div>

          <span className="ml-1 text-xs font-semibold tabular-nums">
            {fmt(time)} / {fmt(duration)}
          </span>

          <div className="flex-1" />

          <button onClick={cycleSpeed} aria-label="Скорость" className="rounded-lg px-2 py-1.5 text-xs font-bold hover:bg-background/15">
            {speed}×
          </button>
          <button onClick={() => void togglePip()} aria-label="Картинка в картинке" className="hidden rounded-lg p-1.5 hover:bg-background/15 sm:block">
            <PictureInPicture2 className="h-4.5 w-4.5" />
          </button>
          <button onClick={toggleFullscreen} aria-label={fullscreen ? "Выйти из полного экрана" : "На весь экран"} className="rounded-lg p-1.5 hover:bg-background/15">
            {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
