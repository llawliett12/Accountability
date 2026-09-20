import Link from "next/link";
import type { NextInLineResult } from "@/lib/nextInLine";

export default function NextInLineCard({ item }: { item: NextInLineResult | null }) {
  if (!item) {
    return (
      <section aria-label="Next in Line" className="rounded-xl border border-neutral-800/80 bg-neutral-900/30 p-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
            Next in Line
          </span>
          <span className="font-mono text-xs text-neutral-500">None scheduled</span>
        </div>
      </section>
    );
  }

  if (item.kind === "academic") {
    return (
      <section aria-label="Next in Line" className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-3 hover:border-amber-700/60 transition-colors">
        <Link href={item.href} className="block group">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-amber-400/90 mb-1">
            <span className="font-semibold">Next in Line · Academic</span>
            <span className="text-neutral-400">{item.category}</span>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="font-mono text-xs font-bold text-amber-200 mr-2">
                {item.courseCode}
              </span>
              <span className="text-sm font-medium text-neutral-100 group-hover:text-amber-100 transition-colors">
                {item.title}
              </span>
            </div>
            <div className="font-mono text-xs text-neutral-400 whitespace-nowrap text-right">
              {item.date} {item.time ? `· ${item.time.slice(0, 5)}` : ""}
            </div>
          </div>
        </Link>
      </section>
    );
  }

  return (
    <section aria-label="Next in Line" className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-3 hover:border-blue-700/60 transition-colors">
      <Link href={item.href} className="block group">
        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-blue-400/90 mb-1">
          <span className="font-semibold">Next in Line · Priority Goal</span>
          <span className="text-neutral-400">P{item.priority}</span>
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <div>
            {item.courseCode && (
              <span className="font-mono text-xs font-bold text-blue-200 mr-2">
                {item.courseCode}
              </span>
            )}
            <span className="text-sm font-medium text-neutral-100 group-hover:text-blue-100 transition-colors">
              {item.title}
            </span>
          </div>
          {item.dueDate && (
            <span className="font-mono text-xs text-neutral-400 whitespace-nowrap">
              Due {item.dueDate}
            </span>
          )}
        </div>
      </Link>
    </section>
  );
}
