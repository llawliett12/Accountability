"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Note } from "@/lib/notes/types";
import { createNote, updateNote, deleteNote } from "@/lib/notes/actions";
import TrashIcon from "@/components/icons/TrashIcon";

interface NotesSectionProps {
  title?: string;
  notes: Note[];
  courseId?: string | null;
  category?: string;
}

export default function NotesSection({
  title = "Notes",
  notes: initialNotes = [],
  courseId,
  category = "general",
}: NotesSectionProps) {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>(initialNotes);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotes((curr) => {
      const serverIds = new Set(initialNotes.map((n) => n.id));
      const localOnly = curr.filter((n) => !serverIds.has(n.id));
      return [...localOnly, ...initialNotes];
    });
  }, [initialNotes]);

  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [pending, startTransition] = useTransition();

  // Add new note (optimistically prepends to top)
  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newContent.trim();
    if (!trimmed) return;

    const tempNote: Note = {
      id: "temp-" + Date.now(),
      user_id: "",
      content: trimmed,
      course_id: courseId ?? null,
      category,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setNotes((prev) => [tempNote, ...prev]);
    setNewContent("");
    setIsAdding(false);

    startTransition(async () => {
      try {
        const saved = await createNote({
          content: trimmed,
          course_id: courseId,
          category,
        });
        setNotes((prev) => prev.map((n) => (n.id === tempNote.id ? saved : n)));
        router.refresh();
      } catch (err) {
        console.error("Failed to save note:", err);
        setNotes((prev) => prev.filter((n) => n.id !== tempNote.id));
      }
    });
  };

  // Edit existing note
  const handleStartEdit = (note: Note) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const handleSaveEdit = (noteId: string) => {
    const trimmed = editContent.trim();
    if (!trimmed) return;

    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, content: trimmed, updated_at: new Date().toISOString() } : n))
    );
    setEditingId(null);

    startTransition(async () => {
      try {
        await updateNote(noteId, trimmed, courseId, category);
        router.refresh();
      } catch (err) {
        console.error("Failed to update note:", err);
      }
    });
  };

  // Delete note
  const handleDelete = (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    startTransition(async () => {
      try {
        await deleteNote(noteId, courseId, category);
        router.refresh();
      } catch (err) {
        console.error("Failed to delete note:", err);
      }
    });
  };

  // Helper date formatter: e.g. "Sep 20, 09:14"
  const formatNoteDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <section className="space-y-3 pt-1 font-mono text-sm">
      <div className="flex items-center justify-between border-b border-neutral-800/70 pb-2">
        <h3 className="font-semibold uppercase tracking-wider text-neutral-300">
          {title} {notes.length > 0 && `(${notes.length})`}
        </h3>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors"
          >
            + Add Note
          </button>
        )}
      </div>

      {/* Inline add note input */}
      {isAdding && (
        <form onSubmit={handleAdd} className="space-y-2 rounded-lg border border-neutral-700 bg-neutral-950 p-2.5">
          <textarea
            autoFocus
            rows={2}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            className="w-full rounded border border-neutral-800 bg-neutral-900 p-2 text-sm text-neutral-100 placeholder-neutral-600 focus:border-neutral-600 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewContent("");
              }}
              className="px-2.5 py-1 text-neutral-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !newContent.trim()}
              className="rounded bg-neutral-100 px-3 py-1 font-semibold text-neutral-950 hover:bg-neutral-200 disabled:opacity-50"
            >
              Save Note
            </button>
          </div>
        </form>
      )}

      {/* Infinite chronological list, newest first */}
      {notes.length === 0 && !isAdding ? (
        <p className="text-neutral-500 py-1">No notes yet.</p>
      ) : (
        <div className="divide-y divide-neutral-800/60">
          {notes.map((note) => (
            <div key={note.id} className="py-2.5 space-y-1 group">
              {editingId === note.id ? (
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full rounded border border-neutral-700 bg-neutral-900 p-2 text-sm text-neutral-100 focus:border-amber-500 focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-2 py-0.5 text-xs text-neutral-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={pending || !editContent.trim()}
                      onClick={() => handleSaveEdit(note.id)}
                      className="rounded bg-neutral-100 px-2.5 py-0.5 font-semibold text-neutral-950 hover:bg-neutral-200 text-xs"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <p className="whitespace-pre-wrap text-neutral-200 flex-1 leading-relaxed">
                    {note.content}
                  </p>
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <span className="text-xs text-neutral-500">
                      {formatNoteDate(note.created_at)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(note)}
                      className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                      title="Edit note"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(note.id)}
                      className="p-1 rounded text-neutral-600 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                      title="Delete note"
                      aria-label="Delete note"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
