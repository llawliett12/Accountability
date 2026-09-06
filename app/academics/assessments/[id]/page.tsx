import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAssessmentById } from "@/lib/academics/queries";
import { compareToTarget, averagePracticeScore } from "@/lib/academics/engine";
import AssessmentScoreForm from "@/components/AssessmentScoreForm";
import PracticeScoreForm from "@/components/PracticeScoreForm";
import FocusTimer from "@/components/FocusTimer";

export default async function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <p className="text-sm text-neutral-500">Sign in to see this assessment.</p>;
  }

  const assessment = await fetchAssessmentById(user.id, id);
  if (!assessment) notFound();

  const comparison = compareToTarget(assessment.target_score, assessment.score);
  const practiceAvg = averagePracticeScore(assessment.practice_scores);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold capitalize">
            {assessment.type}: {assessment.title}
          </h1>
          <p className="text-sm text-neutral-500">{assessment.date}</p>
        </div>
        <Link href="/academics/assessments" className="text-xs text-neutral-500 underline">
          Back
        </Link>
      </header>

      {assessment.score !== null && assessment.max_score ? (
        <section className="rounded-2xl bg-neutral-900 p-4">
          <h2 className="mb-1 text-sm font-medium text-neutral-400">Score</h2>
          <p className="text-2xl font-semibold">
            {assessment.score}/{assessment.max_score}
          </p>
          {comparison && (
            <p className={`mt-1 text-xs ${comparison.met ? "text-emerald-400" : "text-amber-400"}`}>
              Target {comparison.target} · Actual {comparison.actual} (
              {comparison.delta >= 0 ? "+" : ""}
              {comparison.delta})
            </p>
          )}
        </section>
      ) : (
        <AssessmentScoreForm
          assessmentId={assessment.id}
          existingScore={assessment.score}
          existingMax={assessment.max_score}
        />
      )}

      {(assessment.target_score !== null || assessment.prep_hours !== null) && (
        <section className="rounded-2xl bg-neutral-900 p-4 text-sm">
          <h2 className="mb-1 text-sm font-medium text-neutral-400">Prep plan</h2>
          {assessment.target_score !== null && (
            <p className="text-neutral-300">Target score: {assessment.target_score}</p>
          )}
          {assessment.prep_hours !== null && (
            <p className="text-neutral-300">Planned prep: {assessment.prep_hours}h</p>
          )}
        </section>
      )}

      <section className="space-y-2 rounded-2xl bg-neutral-900 p-4">
        <h2 className="text-sm font-medium text-neutral-400">Practice attempts</h2>
        {assessment.practice_scores.length > 0 ? (
          <p className="text-sm text-neutral-300">
            {assessment.practice_scores.join(", ")}
            {practiceAvg !== null && <span className="text-neutral-500"> · avg {practiceAvg}</span>}
          </p>
        ) : (
          <p className="text-xs text-neutral-500">No practice attempts logged yet.</p>
        )}
        <PracticeScoreForm assessmentId={assessment.id} />
      </section>

      <FocusTimer
        assessmentId={assessment.id}
        label={`Prep session for ${assessment.title}`}
      />
    </div>
  );
}
