"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home" },
  { href: "/plan", label: "Plan" },
  { href: "/academics", label: "Academics" },
  { href: "/goals", label: "Goals" },
  { href: "/review", label: "Review" },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom,0.5rem)]">
      <div className="mx-auto flex max-w-md">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : item.href === "/review"
              ? pathname === "/review" ||
                pathname.startsWith("/night") ||
                pathname.startsWith("/weekly") ||
                pathname.startsWith("/monthly") ||
                pathname.startsWith("/screen-time") ||
                pathname.startsWith("/insights")
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`flex-1 min-h-[48px] flex items-center justify-center px-0.5 py-2 text-center text-[11px] sm:text-xs tracking-tight transition-colors truncate ${
                active ? "text-white font-semibold" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
