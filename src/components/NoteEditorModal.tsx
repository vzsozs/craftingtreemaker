"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type NoteEditorModalProps = {
  open: boolean;
  nodeId: string | null;
  currentNote: string | null;
  onSave: (nodeId: string, note: string | null) => void;
  onClose: () => void;
};

export default function NoteEditorModal({
  open,
  nodeId,
  currentNote,
  onSave,
  onClose,
}: NoteEditorModalProps) {
  const [note, setNote] = useState(currentNote ?? "");

  useEffect(() => {
    setNote(currentNote ?? "");
  }, [currentNote, open]);

  function handleSave() {
    if (!nodeId) return;
    onSave(nodeId, note.trim() || null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>📝 Edit Note</DialogTitle>
          <DialogDescription className="text-slate-400">
            Add a note to this node (shown with a yellow banner).
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. HV machine needed here!"
          rows={4}
          className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white
                     placeholder:text-slate-500 text-sm resize-none focus:outline-none
                     focus:ring-2 focus:ring-emerald-500/40"
        />
        <div className="flex gap-2 justify-end mt-2">
          {currentNote && (
            <button
              onClick={() => { onSave(nodeId!, null); onClose(); }}
              className="px-4 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors border border-red-500/20"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-700 transition-colors border border-white/10"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500
                       text-white transition-colors"
          >
            Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
