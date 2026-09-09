import Link from "next/link";

export default function SectionBlock({
  href,
  title,
  summary,
  tone = "neutral",
}: {
  href: string;
  title: string;
  summary: string;
  tone?: "neutral" | "active" | "good" | "warn";
}) {
  return (
    <Link href={href} prefetch={false} className="section-block">
      <span className={`section-block-dot section-block-dot--${tone}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-neutral-100">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-neutral-500">{summary}</span>
      </span>
      <span className="section-block-chevron" aria-hidden="true">›</span>
    </Link>
  );
}
