import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchCourseDetails } from "@/lib/courses/queries";
import CourseDetailClient from "@/components/CourseDetailClient";

export default async function CourseDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const courseId = params.id;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <p className="text-sm text-neutral-500 p-4">Sign in to view course.</p>;
  }

  const details = await fetchCourseDetails(user.id, courseId);
  if (!details) notFound();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-amber-300">
              {details.course.code}
            </span>
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${
              details.course.active
                ? "bg-emerald-950/60 border-emerald-800/60 text-emerald-400"
                : "bg-neutral-800 border-neutral-700 text-neutral-400"
            }`}>
              {details.course.active ? "Active" : "Archived"}
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-100 mt-0.5">
            {details.course.name}
          </h1>
          {(details.course.instructor || details.course.location) && (
            <p className="text-sm text-neutral-400 font-mono mt-0.5">
              {details.course.instructor ? `Prof. ${details.course.instructor}` : ""}
              {details.course.instructor && details.course.location ? " · " : ""}
              {details.course.location ? details.course.location : ""}
            </p>
          )}
        </div>

        <Link
          href="/academics"
          className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors font-mono"
        >
          &larr; Academics
        </Link>
      </header>

      <CourseDetailClient details={details} />
    </div>
  );
}
