"use client";

import { useState, useTransition } from "react";
import { deleteReviewNote, saveReviewNote } from "@/lib/review/actions";

export default function ReviewNotesLedger({ date, initialContent }: { date: string; initialContent: string | null }) {
  const [content, setContent] = useState(initialContent ?? "");
  const [savedContent, setSavedContent] = useState(initialContent ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasContent = content.trim().length > 0;
  const isChanged = content.trim() !== savedContent;

  function save() {
    if (!hasContent || !isChanged) return;
    setError(null);
    startTransition(async () => {
      try {
        const trimmedContent = content.trim();
        await saveReviewNote({ date, content: trimmedContent });
        setContent(trimmedContent);
        setSavedContent(trimmedContent);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save this note. Please try again.");
      }
    });
  }

  function remove() {
    if (!savedContent || !confirm("Delete this closing note?")) return;
    startTransition(async () => {
      try { await deleteReviewNote(date); setContent(""); setSavedContent(""); }
      catch (err) { setError(err instanceof Error ? err.message : "Could not delete this note."); }
    });
  }

  return (
    <div className="overflow-hidden border-y sm:border border-neutral-800/80 sm:rounded-xl bg-neutral-950/50">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-900/80 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
            <th className="py-2 px-3">Date</th>
            <th className="py-2 px-3">Closing Note</th>
            <th className="py-2 px-3 text-right">Status</th>
          </tr>
        </thead>
        <tbody className="font-mono text-xs">
          <tr className="align-top hover:bg-neutral-900/50 transition-colors">
            <td className="py-3 px-3 whitespace-nowrap text-amber-300">{date}</td>
            <td className="py-2 px-3">
              <label className="sr-only" htmlFor="review-note">Closing note</label>
              <textarea
                id="review-note"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="What worked, what did not, or what should tomorrow remember?"
                rows={3}
                maxLength={5000}
                disabled={pending}
                className="w-full resize-y rounded border border-neutral-700 bg-neutral-900 px-2.5 py-2 text-sm leading-5 text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-amber-500/70 disabled:opacity-60"
              />
              {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
              {!savedContent && !hasContent && !error && (
                <p className="mt-1.5 text-[11px] text-neutral-500">
                  No closing note yet — leave a short record for tomorrow.
                </p>
              )}
            </td>
            <td className="py-2 px-3 text-right whitespace-nowrap">
              <button
                type="button"
                onClick={save}
                disabled={!hasContent || !isChanged || pending}
                className="min-h-9 rounded border border-amber-700/70 bg-amber-500/10 px-3 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-transparent disabled:text-neutral-600"
              >
                {pending ? "Saving…" : isChanged ? "Save" : savedContent ? "Saved" : "Save"}
              </button>
              {savedContent && <button type="button" onClick={remove} disabled={pending} className="ml-2 min-h-9 text-xs text-red-400 disabled:opacity-50">Delete</button>}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
