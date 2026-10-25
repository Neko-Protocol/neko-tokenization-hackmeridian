"use client";

import { useEffect, useState } from "react";
import { Check, Coins, FileCheck2, Landmark, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";

const SLIDES = [
  {
    title: "Verify once",
    body: "One KYB or KYC check unlocks your account and a Stellar wallet tied to it.",
    Art: VerifyArt,
  },
  {
    title: "Describe your asset",
    body: "Tell us what you want to tokenize in plain language. No jargon required.",
    Art: FormArt,
  },
  {
    title: "Reviewed by Neko",
    body: "Our legal and compliance review happens before anything is issued.",
    Art: ReviewArt,
  },
  {
    title: "Reach real investors",
    body: "Launch to verified investors on Neko Pro, with every payment on-chain.",
    Art: LaunchArt,
  },
];

const ROTATE_MS = 3200;

export function Showcase() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % SLIDES.length),
      ROTATE_MS
    );
    return () => window.clearInterval(id);
  }, [index]);

  const { Art } = SLIDES[index];

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[28px] bg-gradient-to-b from-[#1677b8] via-[#229EDF] to-[#7fcdf3] px-10 text-center">
      <PixelField />

      <div className="relative flex h-[250px] w-full max-w-[330px] items-center justify-center">
        <div
          key={index}
          className="w-full animate-[lp-enter_420ms_cubic-bezier(0.22,1,0.36,1)_both]"
        >
          <Art />
        </div>
      </div>

      <div className="relative mt-10 h-[92px] w-full max-w-sm">
        {SLIDES.map((s, i) => (
          <div
            key={s.title}
            aria-hidden={i !== index}
            className={cn(
              "absolute inset-x-0 top-0 transition-opacity duration-300",
              i === index ? "opacity-100" : "opacity-0"
            )}
          >
            <h2 className="text-xl font-semibold text-white">{s.title}</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-white/80">
              {s.body}
            </p>
          </div>
        ))}
      </div>

      <div className="relative mt-4 flex items-center gap-1.5">
        {SLIDES.map((s, i) => (
          <button
            key={s.title}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show "${s.title}"`}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === index
                ? "w-5 bg-white"
                : "w-1.5 bg-white/45 hover:bg-white/70"
            )}
          />
        ))}
      </div>
    </div>
  );
}

function rise(delayMs: number): React.CSSProperties {
  return { animationDelay: `${delayMs}ms` };
}
const RISE = "animate-[lp-rise_380ms_cubic-bezier(0.22,1,0.36,1)_both]";

function Card({
  icon: Icon,
  label,
  aside,
  children,
}: {
  icon: React.ElementType;
  label: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white text-left text-[#121212] shadow-[0_24px_60px_-24px_rgba(8,31,92,0.6)]">
      <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-2.5">
        <span className="flex items-center gap-2 text-[12px] font-medium text-black/70">
          <Icon className="h-3.5 w-3.5 text-[#229EDF]" />
          {label}
        </span>
        {aside}
      </div>
      <div className="px-4 py-3.5">{children}</div>
    </div>
  );
}

function VerifyArt() {
  return (
    <Card
      icon={ScanLine}
      label="Business verification"
      aside={
        <span
          className="animate-[lp-pop_360ms_cubic-bezier(0.34,1.56,0.64,1)_both] rounded-full bg-[#2ed06e]/12 px-2 py-0.5 text-[10px] font-semibold text-[#1a9e50]"
          style={rise(1500)}
        >
          Verified
        </span>
      }
    >
      <div className="relative overflow-hidden rounded-xl bg-[#f4f7fa] p-3">
        <span
          aria-hidden
          className="absolute inset-x-0 h-8 animate-[lp-scan_1200ms_ease-in-out_both] bg-gradient-to-b from-transparent via-[#229EDF]/20 to-transparent"
          style={rise(150)}
        />
        <p className="text-[13px] font-semibold">Cooperativa Monteverde R.L.</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
          <dt className="text-black/45">Registry</dt>
          <dd className="font-label">3-004-045117</dd>
          <dt className="text-black/45">Country</dt>
          <dd>Costa Rica</dd>
          <dt className="text-black/45">Representative</dt>
          <dd>Ana Mora</dd>
        </dl>
      </div>
    </Card>
  );
}

function FormArt() {
  const fields = [
    ["Asset", "2027 coffee harvest"],
    ["Raise", "$250,000"],
    ["Return", "9% a year · 18 months"],
  ];
  return (
    <Card icon={FileCheck2} label="Tokenization application">
      <div className="flex flex-col gap-2.5">
        {fields.map(([label, value], i) => (
          <div key={label} className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-black/45">
              {label}
            </span>
            <div className="flex h-8 items-center overflow-hidden rounded-lg border border-black/10 px-2.5">
              <span
                className="inline-block animate-[lp-type_520ms_steps(18,end)_both] overflow-hidden whitespace-nowrap text-[12px]"
                style={rise(200 + i * 520)}
              >
                {value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ReviewArt() {
  const steps = ["KYB documents", "Legal opinion", "Compliance review"];
  return (
    <Card
      icon={Landmark}
      label="Neko review"
      aside={<span className="text-[10px] text-black/40">Case #0142</span>}
    >
      <ol className="relative flex flex-col gap-3">
        <span
          aria-hidden
          className="absolute bottom-2 left-[9px] top-2 w-px bg-black/10"
        />
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          return (
            <li key={step} className="relative flex items-center gap-3">
              <span
                className={cn(
                  "flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full",
                  last ? "border-2 border-[#229EDF] bg-white" : "bg-[#2ed06e]"
                )}
              >
                {last ? (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#229EDF]" />
                ) : (
                  <Check
                    className="h-3 w-3 animate-[lp-pop_320ms_cubic-bezier(0.34,1.56,0.64,1)_both] text-white"
                    strokeWidth={3}
                    style={rise(300 + i * 450)}
                  />
                )}
              </span>
              <span className="flex flex-1 items-center justify-between text-[12px]">
                <span className={last ? "font-medium" : "text-black/70"}>
                  {step}
                </span>
                <span className="text-[10px] text-black/40">
                  {last ? "In progress" : "Done"}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function LaunchArt() {
  return (
    <Card
      icon={Coins}
      label="MONTE · SEP-57 token"
      aside={
        <span className="rounded-full bg-[#229EDF]/10 px-2 py-0.5 text-[10px] font-semibold text-[#1a7fb5]">
          Live
        </span>
      }
    >
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] text-black/45">Raised</p>
          <p className="font-label text-lg font-medium">$182,400</p>
        </div>
        <p className="text-[11px] text-black/45">of $250,000</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
        <div
          className="h-full animate-[lp-fill_1400ms_cubic-bezier(0.22,1,0.36,1)_both] rounded-full bg-[#229EDF]"
          style={{ ...rise(250), width: "73%" }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex -space-x-1.5">
          {["#f6c27a", "#9fd3c7", "#c3b5f2", "#f2a7a0"].map((c, i) => (
            <span
              key={c}
              className={cn("h-5 w-5 rounded-full border-2 border-white", RISE)}
              style={{ ...rise(500 + i * 120), background: c }}
            />
          ))}
        </div>
        <span className="text-[11px] text-black/50">
          214 verified investors
        </span>
      </div>
    </Card>
  );
}

const PIXEL_CELLS = (() => {
  const out: { x: number; y: number; o: number; s: number }[] = [];
  const cols = 40;
  const rows = 46;
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = rand();
      if (v < 0.42) continue;
      const fade = 1 - r / rows;
      out.push({
        x: c * 14,
        y: r * 14,
        o: Number((0.04 + v * 0.16 * fade).toFixed(3)),
        s: v > 0.88 ? 8 : 6,
      });
    }
  }
  return out;
})();

function PixelField() {
  const cells = PIXEL_CELLS;
  return (
    <svg
      aria-hidden
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 560 644"
      preserveAspectRatio="xMidYMid slice"
    >
      {cells.map((c, i) => (
        <rect
          key={i}
          x={c.x + (10 - c.s) / 2}
          y={c.y + (10 - c.s) / 2}
          width={c.s}
          height={c.s}
          rx={2}
          fill="#fff"
          opacity={c.o}
        />
      ))}
    </svg>
  );
}
