"use client";

import Image from "next/image";
import { useState } from "react";
import { MoveHorizontal, Sparkles } from "lucide-react";

type BeforeAfterSliderProps = {
  before: string;
  after: string;
  title: string;
  beforeLabel?: string;
  afterLabel?: string;
  priority?: boolean;
  compact?: boolean;
};

export function BeforeAfterSlider({
  before,
  after,
  title,
  beforeLabel = "Raw upload",
  afterLabel = "Zeylora AI",
  priority = false,
  compact = false
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(54);

  return (
    <div className={`${compact ? "rounded-2xl md:rounded-2xl" : "rounded-[1.25rem] md:rounded-[1.75rem]"} group relative aspect-[4/3] overflow-hidden border border-white/10 bg-zeylora-ink shadow-cinematic md:aspect-[16/10]`}>
      <Image
        src={after}
        alt={`${title} after Zeylora AI result`}
        fill
        priority={priority}
        className="object-cover"
        sizes="(min-width: 1024px) 680px, 100vw"
      />

      <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
        <Image
          src={before}
          alt={`${title} before Zeylora AI result`}
          fill
          priority={priority}
          className="max-w-none object-cover grayscale-[38%] contrast-[0.88] brightness-[0.82]"
          sizes="(min-width: 1024px) 680px, 100vw"
        />
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_18%,rgba(32,211,255,.16),transparent_34%),linear-gradient(180deg,rgba(3,5,13,.08),transparent_46%,rgba(3,5,13,.6))]" />
      <div className="pointer-events-none absolute inset-0 grid place-items-center px-4 sm:px-6">
        <div className={`${compact ? "max-w-[74%] rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2" : "max-w-[78%] rounded-2xl px-3 py-2 sm:rounded-3xl sm:px-5 sm:py-3"} border border-white/15 bg-black/25 text-center shadow-cinematic backdrop-blur-md`}>
          <p className={`${compact ? "text-[11px] sm:text-sm md:text-base" : "text-base sm:text-3xl md:text-4xl"} font-black uppercase tracking-normal text-white/28`}>
            ZEYLORA PREVIEW
          </p>
          <p className={`${compact ? "hidden sm:block" : "mt-0.5 sm:mt-1"} text-[8px] font-black uppercase tracking-[0.14em] text-cyan/70 sm:text-[10px] sm:tracking-[0.2em]`}>
            Branded preview export
          </p>
        </div>
      </div>
      <div
        className="absolute inset-y-0 w-px bg-white/90 shadow-[0_0_32px_rgba(32,211,255,.68)]"
        style={{ left: `${position}%` }}
      />
      <div
        className={`${compact ? "size-9 sm:size-10" : "size-10 sm:size-12"} absolute top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/50 text-white shadow-glow backdrop-blur-xl transition group-hover:scale-105`}
        style={{ left: `${position}%` }}
      >
        <MoveHorizontal size={17} />
      </div>

      <input
        aria-label={`Compare before and after for ${title}`}
        type="range"
        min="12"
        max="88"
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />

      <div className="absolute left-3 top-3 max-w-[43%] rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-black text-white backdrop-blur sm:left-4 sm:top-4 sm:px-3 sm:text-xs">
        {beforeLabel}
      </div>
      <div className="absolute right-3 top-3 inline-flex max-w-[48%] items-center gap-1.5 rounded-full bg-zeylora-brand px-2.5 py-1 text-right text-[10px] font-black text-white shadow-glow sm:right-4 sm:top-4 sm:px-3 sm:text-xs">
        <Sparkles size={12} />
        <span className="truncate">{afterLabel}</span>
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-xs font-bold text-slate-200 backdrop-blur max-sm:hidden">
        Slide to compare
      </div>
      <div className={`${compact ? "hidden" : "hidden sm:block"} absolute bottom-4 right-4 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[10px] font-black uppercase text-slate-200 backdrop-blur`}>
        Powered by Zeylora
      </div>
    </div>
  );
}
