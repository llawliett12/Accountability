"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { shiftDateISO } from "@/lib/date";

export default function PlanDayGesture({ date, children }: { date: string; children: ReactNode }) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState(0);

  function isInteractive(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest("button, input, select, textarea, a"));
  }

  return (
    <div
      onTouchStart={(event) => {
        if (isInteractive(event.target)) return;
        const touch = event.touches[0];
        start.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchMove={(event) => {
        if (!start.current) return;
        const touch = event.touches[0];
        const dx = touch.clientX - start.current.x;
        const dy = touch.clientY - start.current.y;
        if (Math.abs(dy) > Math.abs(dx)) {
          start.current = null;
          setOffset(0);
          return;
        }
        if (Math.abs(dx) > 12) setOffset(Math.max(-36, Math.min(36, dx * 0.2)));
      }}
      onTouchEnd={(event) => {
        if (!start.current) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - start.current.x;
        const dy = touch.clientY - start.current.y;
        start.current = null;
        setOffset(0);
        if (Math.abs(dx) < 80 || Math.abs(dx) <= Math.abs(dy)) return;
        router.push(`/?date=${shiftDateISO(date, dx < 0 ? 1 : -1)}`);
      }}
      style={{ transform: offset ? `translateX(${offset}px)` : undefined, transition: offset ? "none" : "transform 160ms ease" }}
      className="touch-pan-y"
    >
      {children}
      <p className="mt-1 text-right font-mono text-[10px] text-neutral-600 sm:hidden">Swipe blank table space to change day</p>
    </div>
  );
}
