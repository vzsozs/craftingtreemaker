"use client";

import { useMemo } from "react";
import { buildShoppingList, formatAmount } from "@/lib/batchCalc";
import type { TreeNodeData, ShoppingListEntry } from "@/lib/batchCalc";
import { IconImage } from "@/components/IconImage";

type ShoppingListProps = {
  nodes: TreeNodeData[];
  targetItemName: string | null;
  targetAmount: number;
};

const typeColors: Record<string, string> = {
  item:  "#555",
  fluid: "#2563eb",
  gas:   "#7c3aed",
};

function EntryRow({ entry }: { entry: ShoppingListEntry }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderBottom: "1px solid #252525",
        fontFamily: "var(--font-geist-mono, monospace)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#252525")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* mini slot – H-11 FIX: IconImage a puszta initials helyett */}
      <div
        style={{
          width: 28,
          height: 28,
          flexShrink: 0,
          background: "#2a2a2a",
          border: `1.5px solid ${typeColors[entry.itemType] ?? "#555"}`,
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <IconImage
          itemId={entry.itemId}
          itemName={entry.itemName}
          size={28}
          itemType={entry.itemType}
          textStyle={{
            color: "#888",
            fontSize: 9,
            fontWeight: 700,
            fontFamily: "monospace",
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#ccc", fontSize: 10, fontWeight: 600, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry.itemName}
        </div>
        <div style={{ color: "#444", fontSize: 8, marginTop: 1 }}>{entry.itemId}</div>
      </div>
      <div
        style={{
          flexShrink: 0,
          color: entry.isCatalyst ? "#fb923c" : "#34d399",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        ×{formatAmount(entry.isCatalyst ? 1 : entry.amount)}{(entry.itemType === "fluid" || entry.itemType === "gas") && <span style={{ fontSize: 9, opacity: 0.65, marginLeft: 2 }}>(mB)</span>}
      </div>
    </div>
  );
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

export default function ShoppingList({ nodes, targetItemName, targetAmount }: ShoppingListProps) {
  const { rawMaterials, catalysts } = useMemo(
    () => buildShoppingList(nodes),
    [nodes]
  );

  const isEmpty = rawMaterials.length === 0 && catalysts.length === 0;

  function buildMarkdownExport() {
    const lines = [
      `# Shopping List: ${targetItemName ?? "Unknown"} ×${formatAmount(targetAmount)}`,
      "",
      "## Raw Materials",
      ...rawMaterials.map((e) => `- ${e.itemName}: **${formatAmount(e.amount)}**`),
    ];
    if (catalysts.length > 0) {
      lines.push("", "## Catalysts", ...catalysts.map((e) => `- ${e.itemName}: **1×**`));
    }
    return lines.join("\n");
  }

  function buildJsonExport() {
    return JSON.stringify({ rawMaterials, catalysts }, null, 2);
  }

  const sectionLabel = (text: string, count: number) => (
    <div
      style={{
        padding: "6px 10px 4px",
        fontSize: 9,
        color: "#444",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        fontWeight: 600,
        fontFamily: "var(--font-geist-mono, monospace)",
        borderBottom: "1px solid #252525",
      }}
    >
      {text} <span style={{ color: "#333" }}>({count})</span>
    </div>
  );

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#1e1e1e",
        borderLeft: "1px solid #2d2d2d",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 12px 10px",
          borderBottom: "1px solid #2d2d2d",
          flexShrink: 0,
          fontFamily: "var(--font-geist-mono, monospace)",
        }}
      >
        <div style={{ color: "#888", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
          🛒 Shopping List
        </div>
        {targetItemName && (
          <div style={{ marginTop: 4, color: "#555", fontSize: 9 }}>
            Goal:{" "}
            <span style={{ color: "#34d399", fontWeight: 700 }}>{targetItemName}</span>{" "}
            ×{formatAmount(targetAmount)}
          </div>
        )}
      </div>

      {/* Content */}
      {isEmpty ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#2d2d2d",
            fontFamily: "var(--font-geist-mono, monospace)",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ fontSize: 28 }}>🌱</div>
          <div style={{ fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "center", lineHeight: 1.6 }}>
            Build the tree to see<br />the shopping list
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          {rawMaterials.length > 0 && (
            <>
              {sectionLabel("Raw Materials", rawMaterials.length)}
              {rawMaterials.map((e) => (
                <EntryRow key={e.itemId} entry={e} />
              ))}
            </>
          )}
          {catalysts.length > 0 && (
            <>
              {sectionLabel("Catalysts", catalysts.length)}
              {catalysts.map((e) => (
                <EntryRow key={e.itemId} entry={{ ...e, amount: 1 }} />
              ))}
            </>
          )}
        </div>
      )}

      {/* Export buttons */}
      {!isEmpty && (
        <div
          style={{
            padding: "8px 10px",
            borderTop: "1px solid #2d2d2d",
            flexShrink: 0,
            fontFamily: "var(--font-geist-mono, monospace)",
          }}
        >
          <div style={{ fontSize: 9, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
            Export
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { label: "Markdown", fn: buildMarkdownExport },
              { label: "JSON",     fn: buildJsonExport },
            ].map(({ label, fn }) => (
              <button
                key={label}
                onClick={() => copyToClipboard(fn())}
                style={{
                  flex: 1,
                  padding: "5px 0",
                  background: "#262626",
                  border: "1px solid #3a3a3a",
                  borderRadius: 5,
                  color: "#666",
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textTransform: "uppercase",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#2f2f2f";
                  e.currentTarget.style.color = "#aaa";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#262626";
                  e.currentTarget.style.color = "#666";
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
