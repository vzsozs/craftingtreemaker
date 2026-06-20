"use client";

import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { formatAmount, getEdgeColor } from "@/lib/batchCalc";
import type { TreeNodeData } from "@/lib/batchCalc";
import { IconImage } from "@/components/IconImage";

type MachineNodeProps = NodeProps & {
  data: TreeNodeData & {
    onAddChild: (nodeId: string, inputItemId: string, requestedAmount: number) => void;
    onEditNote: (nodeId: string, currentNote: string | null) => void;
    onToggleLock?: (nodeId: string) => void;
  };
};

const HANDLE_SIZE = 12;
const HANDLE_OFFSET = -(HANDLE_SIZE / 2);


export function LockedIcon({ size = 10, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle" }}>
      {/* Padlock shackle (locked: closed) */}
      <path d="M8 10V6a4 4 0 0 1 8 0v4" />
      {/* Padlock body as a mechanical gear */}
      <circle cx="12" cy="15" r="5" />
      <circle cx="12" cy="15" r="1.5" />
      {/* Gear teeth */}
      <line x1="12" y1="8" x2="12" y2="10" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="5" y1="15" x2="7" y2="15" />
      <line x1="17" y1="15" x2="19" y2="15" />
      <line x1="7.5" y1="10.5" x2="9" y2="12" />
      <line x1="15" y1="12" x2="16.5" y2="10.5" />
      <line x1="7.5" y1="19.5" x2="9" y2="18" />
      <line x1="15" y1="18" x2="16.5" y2="19.5" />
    </svg>
  );
}

export function UnlockedIcon({ size = 10, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle" }}>
      {/* Padlock shackle (unlocked: open) */}
      <path d="M8 10V6a4 4 0 0 1 7.5 -2" />
      {/* Padlock body as a mechanical gear */}
      <circle cx="12" cy="15" r="5" />
      <circle cx="12" cy="15" r="1.5" />
      {/* Gear teeth */}
      <line x1="12" y1="8" x2="12" y2="10" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="5" y1="15" x2="7" y2="15" />
      <line x1="17" y1="15" x2="19" y2="15" />
      <line x1="7.5" y1="10.5" x2="9" y2="12" />
      <line x1="15" y1="12" x2="16.5" y2="10.5" />
      <line x1="7.5" y1="19.5" x2="9" y2="18" />
      <line x1="15" y1="18" x2="16.5" y2="19.5" />
    </svg>
  );
}

// ── Icon Component is imported from IconImage.tsx ────────────────────────────

// ── Large output item slot ───────────────────────────────────────────────────
function MainItemSlot({ itemId, itemName, type, size = 46 }: { itemId: string; itemName: string; type: "item" | "fluid" | "gas"; size?: number }) {
  const borderColors = { item: "#4a4a4a", fluid: "#2563eb", gas: "#7c3aed" };
  const textColors   = { item: "#aaa",    fluid: "#93c5fd", gas: "#c4b5fd" };
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      background: "#282828",
      border: `2px solid ${borderColors[type]}`,
      borderRadius: 6,
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative",
    }}>
      <IconImage 
        itemId={itemId}
        itemName={itemName} 
        size={size} 
        itemType={type}
        textStyle={{
          color: textColors[type], fontSize: size * 0.32,
          fontWeight: 700, fontFamily: "monospace",
          letterSpacing: "-0.04em", userSelect: "none",
        }} 
      />
      <div style={{
        position: "absolute", bottom: 2, right: 2,
        width: 4, height: 4, borderRadius: "50%",
        background: borderColors[type],
      }} />
    </div>
  );
}

// ── Compact input slot (NO Handle inside – handles live at node root) ─────────
function InputSlot({
  inp, batchMultiplier, onAddChild, nodeId, isLockedNode,
}: {
  inp: TreeNodeData["inputs"][0];
  batchMultiplier: number;
  onAddChild: (nodeId: string, itemId: string, amount: number) => void;
  nodeId: string;
  isLockedNode?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const isCat = inp.catalyst;
  const displayAmount = isCat ? inp.amount : inp.amount * batchMultiplier;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Slot box */}
      <div
        onMouseEnter={() => !isCat && !isLockedNode && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => { if (!isCat && !isLockedNode) onAddChild(nodeId, inp.itemId, inp.amount * batchMultiplier); }}
        data-tooltip={isCat ? `${inp.itemName} (catalyst)` : isLockedNode ? `${inp.itemName} (locked as raw)` : `Add recipe for ${inp.itemName}`}
        style={{
          width: 44, height: 44,
          background: isCat ? "rgba(234,88,12,0.07)" : hovered && !isLockedNode ? "rgba(52,211,153,0.1)" : "#282828",
          border: `2px solid ${isCat ? "rgba(234,88,12,0.45)" : hovered && !isLockedNode ? "rgba(52,211,153,0.55)" : "#3a3a3a"}`,
          borderRadius: 6,
          position: "relative",
          cursor: isCat || isLockedNode ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "border-color 0.12s, background 0.12s",
          overflow: "hidden",
        }}
      >
        {/* Icon or Initials */}
        <IconImage 
          itemId={inp.itemId} 
          itemName={inp.itemName} 
          size={44} 
          itemType={inp.itemType}
          textStyle={{
            color: isCat ? "#fb923c" : hovered && !isLockedNode ? "#6ee7b7" : "#888",
            fontSize: 14, fontWeight: 700, fontFamily: "monospace",
            letterSpacing: "-0.03em", userSelect: "none",
            transition: "color 0.12s",
          }} 
        />

        {/* Amount badge – bottom-right */}
        <div style={{
          position: "absolute", bottom: 1, right: 1,
          background: "rgba(0,0,0,0.72)",
          borderRadius: 2, padding: "0 2px",
          lineHeight: 1.2, fontSize: 8, fontWeight: 700,
          fontFamily: "monospace",
          color: isCat ? "#fb923c" : "#e5e5e5",
          pointerEvents: "none",
        }}>
          {inp.itemId === "gtceu:programmed_circuit" 
            ? `Conf ${displayAmount}` 
            : <>{`×${formatAmount(displayAmount)}`}{(inp.itemType === "fluid" || inp.itemType === "gas") && <span style={{ fontSize: 6, opacity: 0.65 }}> mB</span>}</>}
        </div>

        {/* Catalyst lock – top-left */}
        {isCat && (
          <div style={{
            position: "absolute", top: 1, left: 2,
            fontSize: 9, lineHeight: 1, pointerEvents: "none",
          }}>🔒</div>
        )}

        {/* Hover + overlay */}
        {hovered && !isCat && !isLockedNode && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#34d399", fontSize: 22, fontWeight: 700,
            pointerEvents: "none",
          }}>+</div>
        )}
      </div>

      {/* Name below */}
      <div style={{
        width: 50, marginTop: 3,
        fontSize: 7, color: isCat ? "#7a3a1a" : "#666",
        textAlign: "center", overflow: "hidden",
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        wordBreak: "break-word",
        overflowWrap: "break-word",
        fontFamily: "var(--font-geist-mono, monospace)",
        lineHeight: 1.2,
      }}>
        {inp.itemName}
      </div>
    </div>
  );
}

// ── Main node ────────────────────────────────────────────────────────────────
function MachineNode({ id, data, selected }: MachineNodeProps) {
  const isRaw = !data.recipeId;
  const inputCount = data.inputs.length;
  // Dynamic width: smaller baseline, tighter scaling per input (since slot is 44px)
  const nodeMinWidth = Math.max(180, inputCount * 54 + 16);

  // Opacity should never change (always 1)
  const opacity = 1;

  // Background and borders based on recipe state and manual locks
  const bg = data.isLockedRaw 
    ? "#11221a" // Highlighted deep forest green for locked raw material
    : isRaw 
    ? "#231f16" 
    : "#202020";

  const border = selected 
    ? "1.5px solid #34d399" 
    : data.isLockedRaw 
    ? "1.5px solid #10b981" // Strong green border for locked raw
    : isRaw 
    ? "1.5px solid #78350f" 
    : "1.5px solid #333";

  return (
    <div style={{
      background: bg,
      border: border,
      borderRadius: 8,
      boxShadow: selected ? "0 0 12px rgba(52,211,153,0.15)" : "none",
      fontFamily: "var(--font-geist-mono, monospace)",
      position: "relative",
      minWidth: nodeMinWidth,
      opacity: opacity,
      transition: "opacity 0.15s ease, border-color 0.15s ease, background 0.15s ease",
    }}>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Top}
        id="output"
        style={{
          position: "absolute",
          top: HANDLE_OFFSET,
          left: "50%",
          transform: "translateX(-50%)",
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
          background: getEdgeColor(data.itemType),
          border: "2px solid #202020",
          borderRadius: "50%",
        }}
      />

      {/* Input handles */}
      {!isRaw && data.inputs.map((inp, idx) => {
        const leftPct = ((idx + 1) / (inputCount + 1)) * 100;
        return (
          <Handle
            key={`h-${inp.itemId}-${idx}`}
            type="target"
            position={Position.Bottom}
            id={`input-${inp.itemId}`}
            style={{
              position: "absolute",
              bottom: HANDLE_OFFSET,
              left: `${leftPct}%`,
              transform: "translateX(-50%)",
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              background: getEdgeColor(inp.itemType as "item" | "fluid" | "gas"),
              border: "2px solid #202020",
              borderRadius: "50%",
              top: "auto",
            }}
          />
        );
      })}

      {/* ── Note banner ── */}
      {data.notes && (
        <div style={{
          background: "rgba(234,179,8,0.1)", borderBottom: "1px solid rgba(234,179,8,0.2)",
          padding: "3px 8px", borderRadius: "8px 8px 0 0",
        }}>
          <span style={{ color: "#fde047", fontSize: 9 }}>📝 {data.notes}</span>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "4px 8px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <span style={{
          fontSize: 9, letterSpacing: "0.02em", color: "#888", fontWeight: 600,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%"
        }}>
          {data.isLockedRaw ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, verticalAlign: "middle" }}>
              <LockedIcon size={9} color="#10b981" /> {data.itemId}
            </span>
          ) : isRaw ? (
            `⛏ ${data.itemId}`
          ) : (
            `⚙ ${data.itemId}`
          )}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Lock Button (manual raw material toggle) - not available on root node */}
          {id !== "node-root" && (
            <button
              onClick={() => data.onToggleLock?.(id)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: data.isLockedRaw ? "#10b981" : "#444", fontSize: 10, padding: "0 1px", lineHeight: 1,
                transition: "color 0.12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = data.isLockedRaw ? "#059669" : "#10b981")}
              onMouseLeave={(e) => (e.currentTarget.style.color = data.isLockedRaw ? "#10b981" : "#444")}
              title={data.isLockedRaw ? "Unlock recipe (re-enable sub-assembly)" : "Lock as raw material (already in-stock)"}
            >
              {data.isLockedRaw ? <LockedIcon size={10} color="#10b981" /> : <UnlockedIcon size={10} color="#444" />}
            </button>
          )}
          {/* Edit Note Button */}
          <button
            onClick={() => data.onEditNote(id, data.notes)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#444", fontSize: 10, padding: "0 1px", lineHeight: 1,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ca8a04")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}
            title="Edit note"
          >✏</button>
        </div>
      </div>

      {/* ── Middle: Machine & Item side-by-side ── */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 10,
        padding: "10px 8px",
        borderBottom: !isRaw && inputCount > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
      }}>
        
        {/* LEFT: Machine – keret nélkül, közvetlenül az ikon */}
        {!isRaw && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 70 }}>
            <IconImage 
              itemId={data.machineId || ""} 
              itemName={data.machineName || "M"} 
              size={56} 
              textStyle={{ color: "#a8a29e", fontSize: 18, fontWeight: 700, fontFamily: "monospace" }} 
            />
            <div style={{ 
              color: "#ddd", fontSize: 9, fontWeight: 700, marginTop: 6, 
              textAlign: "center", lineHeight: 1.1,
              overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflowWrap: "break-word", wordBreak: "break-word"
            }}>
              {data.machineName}
            </div>
            <div style={{ color: "#777", fontSize: 7, marginTop: 2, textAlign: "center" }}>
               Machine
            </div>
          </div>
        )}

        {/* MIDDLE: Vertical Line */}
        {!isRaw && (
          <div style={{ 
            width: 1, 
            height: 46, 
            background: "rgba(255,255,255,0.08)", 
            alignSelf: "flex-start",
            marginTop: 4
          }} />
        )}

        {/* RIGHT: Output Item */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 70 }}>
           <div style={{ position: "relative" }}>
             <MainItemSlot itemId={data.itemId} itemName={data.itemName} type={data.itemType} size={46} />
             {/* Amount badge popping out at bottom right */}
              <div style={{
                 position: "absolute", bottom: -4, right: -4,
                 background: "rgba(0,0,0,0.9)", border: "1px solid #34d399",
                 borderRadius: 4, padding: "1px 4px",
                 fontSize: 8, fontWeight: 700, color: "#6ee7b7", fontFamily: "monospace",
                 zIndex: 2,
              }}>
                 ×{formatAmount(data.requestedAmount)}{(data.itemType === "fluid" || data.itemType === "gas") && <span style={{ fontSize: 6, opacity: 0.7 }}> mB</span>}
              </div>
           </div>
           <div style={{ 
              color: "#ddd", fontSize: 9, fontWeight: 700, marginTop: 6, 
              textAlign: "center", lineHeight: 1.1,
              overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflowWrap: "break-word", wordBreak: "break-word"
            }}>
              {data.itemName}
           </div>
           {data.batchMultiplier !== 1 && !isRaw ? (
             <div style={{ color: "#34d399", fontSize: 7, marginTop: 2, textAlign: "center" }}>
               {formatAmount(data.batchMultiplier)}× batch
             </div>
           ) : (
             <div style={{ color: "#777", fontSize: 7, marginTop: 2, textAlign: "center" }}>
               Product
             </div>
           )}
        </div>
      </div>

      {/* ── Input slots: absolutely positioned to sync with handles ── */}
      {!isRaw && inputCount > 0 && (
        <div style={{
          position: "relative",
          height: 76, // 44px slot + 3px margin + 2×7px label sorok + 6px top offset + 2px breathing room
          width: "100%",
        }}>
          {data.inputs.map((inp, idx) => {
            const leftPct = ((idx + 1) / (inputCount + 1)) * 100;
            return (
              <div
                key={inp.itemId + idx}
                style={{
                  position: "absolute",
                  top: 6,
                  left: `${leftPct}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <InputSlot
                  inp={inp}
                  nodeId={id}
                  batchMultiplier={data.batchMultiplier}
                  onAddChild={data.onAddChild}
                  isLockedNode={data.isLockedRaw}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(MachineNode);
