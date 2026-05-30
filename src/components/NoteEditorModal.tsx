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
      <DialogContent
        style={{
          background: "#1e1e1e",
          border: "1px solid #2d2d2d",
          color: "#e5e5e5",
          fontFamily: "var(--font-geist-mono, monospace)",
          maxWidth: 420,
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "#e5e5e5", fontSize: 13, fontWeight: 700 }}>
            📝 Edit Note
          </DialogTitle>
          <DialogDescription style={{ color: "#555", fontSize: 10 }}>
            Add a note to this node (shown with a yellow banner).
          </DialogDescription>
        </DialogHeader>

        {/* H-13 FIX: Tailwind osztályok → inline style, konzisztensen a többi komponenssel */}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. HV machine needed here!"
          rows={4}
          style={{
            width: "100%",
            background: "#262626",
            border: "1px solid #3a3a3a",
            borderRadius: 8,
            padding: "8px 12px",
            color: "#e5e5e5",
            fontSize: 12,
            fontFamily: "var(--font-geist-mono, monospace)",
            resize: "none",
            outline: "none",
            boxSizing: "border-box",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(52,211,153,0.4)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#3a3a3a")}
        />

        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 4 }}>
          {currentNote && (
            <button
              onClick={() => { onSave(nodeId!, null); onClose(); }}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#f87171",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.15)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "inherit",
              background: "#262626",
              border: "1px solid #3a3a3a",
              color: "#888",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#2f2f2f")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#262626")}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              background: "#059669",
              border: "1px solid #047857",
              color: "#fff",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#10b981")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#059669")}
          >
            Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
