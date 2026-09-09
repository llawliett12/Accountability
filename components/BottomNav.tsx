"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/academics", label: "Academics", icon: "book" },
  { href: "/goals", label: "Goals", icon: "target" },
  { href: "/review", label: "Review", icon: "clipboard" },
];

function NavIcon({ name }: { name: (typeof items)[number]["icon"] }) {
  const common = {
    className: "h-6 w-6",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 1.8,
    "aria-hidden": true,
  };

  if (name === "home") {
    return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="m3 10.5 9-7 9 7v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-9Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 21v-6h6v6" /></svg>;
  }
  if (name === "book") {
    return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 5.25A2.25 2.25 0 0 1 6.75 3H20v15.75H6.75A2.25 2.25 0 0 0 4.5 21V5.25Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 18.75A2.25 2.25 0 0 1 6.75 16.5H20" /></svg>;
  }
  if (name === "target") {
    return <svg {...common}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" /><path strokeLinecap="round" d="M12 3.5V2M12 22v-1.5M20.5 12H22M2 12h1.5" /></svg>;
  }
  return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5h6M9 3h6a1.5 1.5 0 0 1 1.5 1.5V6H18a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 18 21H6a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 6 6h1.5V4.5A1.5 1.5 0 0 1 9 3Z" /><path strokeLinecap="round" strokeLinejoin="round" d="m8.5 13 2.25 2.25 4.75-5" /></svg>;
}

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
              aria-label={item.label}
              className={`flex-1 min-h-[48px] flex items-center justify-center px-0.5 py-2 transition-colors ${
                active ? "text-white font-semibold" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <NavIcon name={item.icon} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
