"use client";

import { useRef, useState, useTransition } from "react";
import { deleteAcademicScheduleScreenshot, saveAcademicScheduleScreenshot, type AcademicScreenshotKind } from "@/lib/academics/screenshot-actions";

type Document = { kind: AcademicScreenshotKind; url: string | null };
const rows: { kind: AcademicScreenshotKind; label: string }[] = [
  { kind: "timetable", label: "Class timetable" },
  { kind: "quiz_schedule", label: "Quiz schedule" },
  { kind: "exam_schedule", label: "Midsem / exam schedule" },
  { kind: "other", label: "Other schedule" },
];

export default function AcademicScheduleScreenshots({ initialDocuments }: { initialDocuments: Document[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const byKind = new Map(documents.map((document) => [document.kind, document]));
  function upload(kind: AcademicScreenshotKind, file: File) {
    setError(null);
    startTransition(async () => {
      try { const form = new FormData(); form.set("kind", kind); form.set("screenshot", file); await saveAcademicScheduleScreenshot(form); setDocuments((items) => items.map((item) => item.kind === kind ? { ...item, url: URL.createObjectURL(file) } : item).concat(items.some((item) => item.kind === kind) ? [] : [{ kind, url: URL.createObjectURL(file) }])); }
      catch (err) { setError(err instanceof Error ? err.message : "Could not save screenshot."); }
    });
  }
  return <section className="space-y-2"><div className="ledger-heading"><div><h2>Schedule screenshots</h2><p>Original reference images only. They never change structured rows.</p></div></div>{error && <p className="text-xs text-red-400">{error}</p>}<div className="ledger-scroll"><table className="ledger-table min-w-[420px]"><thead><tr><th>Schedule</th><th>Screenshot mode</th><th className="w-28 text-right">Action</th></tr></thead><tbody>{rows.map((row) => { const document = byKind.get(row.kind); return <tr key={row.kind}><td className="text-neutral-200">{row.label}</td><td>{document?.url ? <a href={document.url} target="_blank" rel="noreferrer" className="text-amber-400 hover:text-amber-300">View / zoom ↗</a> : <span className="text-neutral-600">No screenshot</span>}</td><td className="text-right whitespace-nowrap"><input ref={(element) => { inputRefs.current[row.kind] = element; }} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(row.kind, file); event.currentTarget.value = ""; }} /><button type="button" disabled={pending} onClick={() => inputRefs.current[row.kind]?.click()} className="min-h-9 px-1 text-xs text-amber-400">{document ? "Replace" : "Upload"}</button>{document && <button type="button" disabled={pending} onClick={() => { if (!confirm(`Remove ${row.label} screenshot?`)) return; const prior = documents; setDocuments((items) => items.filter((item) => item.kind !== row.kind)); startTransition(async () => { try { await deleteAcademicScheduleScreenshot(row.kind); } catch { setDocuments(prior); setError("Could not remove screenshot."); } }); }} className="min-h-9 px-1 text-xs text-red-400">Remove</button>}</td></tr>; })}</tbody></table></div></section>;
}
