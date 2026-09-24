"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/academics", label: "Academics", icon: "book" },
  { href: "/goals", label: "Goals", icon: "target" },
  { href: "/health", label: "Health", icon: "heart" },
  { href: "/review", label: "Review", icon: "clipboard" },
];

function NavIcon({ name }: { name: (typeof items)[number]["icon"] }) {
  const common = {
    className: "h-5 w-5 sm:h-6 sm:w-6",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 1.8,
    "aria-hidden": true,
  };

  if (name === "home") {
    return (
      <svg {...common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m3 10.5 9-7 9 7v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-9Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 21v-6h6v6" />
      </svg>
    );
  }
  if (name === "book") {
    return (
      <svg {...common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 5.25A2.25 2.25 0 0 1 6.75 3H20v15.75H6.75A2.25 2.25 0 0 0 4.5 21V5.25Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 18.75A2.25 2.25 0 0 1 6.75 16.5H20" />
      </svg>
    );
  }
  if (name === "target") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4" />
        <path strokeLinecap="round" d="M12 3.5V2M12 22v-1.5M20.5 12H22M2 12h1.5" />
      </svg>
    );
  }
  if (name === "heart") {
    return (
      <svg {...common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5h6M9 3h6a1.5 1.5 0 0 1 1.5 1.5V6H18a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 18 21H6a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 6 6h1.5V4.5A1.5 1.5 0 0 1 9 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.5 13 2.25 2.25 4.75-5" />
    </svg>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800/80 bg-neutral-950/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,0.5rem)]">
      <div className="mx-auto flex max-w-md sm:max-w-xl md:max-w-2xl px-2">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : item.href === "/review"
              ? pathname === "/review" ||
                pathname.startsWith("/night") ||
                pathname.startsWith("/weekly") ||
                pathname.startsWith("/monthly") ||
                pathname.startsWith("/insights")
              : item.href === "/health"
              ? pathname === "/health" || pathname.startsWith("/screen-time")
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              aria-label={item.label}
              className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 py-1.5 transition-colors ${
                active ? "text-white font-medium" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <NavIcon name={item.icon} />
              <span className="text-xs font-mono tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
