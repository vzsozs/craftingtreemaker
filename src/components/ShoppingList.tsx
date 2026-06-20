"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { buildShoppingList, formatAmount } from "@/lib/batchCalc";
import type { TreeNodeData, ShoppingListEntry } from "@/lib/batchCalc";
import { IconImage } from "@/components/IconImage";
import type { Edge } from "@xyflow/react";

type ShoppingListProps = {
  nodes: TreeNodeData[];
  edges: Edge[];
  targetItemName: string | null;
  targetAmount: number;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  onSelectNode?: (nodeId: string) => void;
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
        gap: 12,
        padding: "10px 14px",
        borderBottom: "1px solid #222222",
        fontFamily: "var(--font-geist-mono, monospace)",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#252525")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* mini slot */}
      <div
        style={{
          width: 42,
          height: 42,
          flexShrink: 0,
          background: "#222",
          border: `1.5px solid ${typeColors[entry.itemType] ?? "#555"}`,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)",
        }}
      >
        <IconImage
          itemId={entry.itemId}
          itemName={entry.itemName}
          size={42}
          itemType={entry.itemType}
          textStyle={{
            color: "#888",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "monospace",
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#e5e5e5", fontSize: 12, fontWeight: 600, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry.itemName}
        </div>
        <div style={{ color: "#555", fontSize: 9.5, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry.itemId}
        </div>
      </div>
      <div
        style={{
          flexShrink: 0,
          color: entry.isCatalyst ? "#fb923c" : "#34d399",
          fontSize: 13,
          fontWeight: 700,
          background: "rgba(0,0,0,0.2)",
          padding: "4px 9px",
          borderRadius: 4,
          border: "1px solid rgba(255,255,255,0.03)",
        }}
      >
        {entry.itemId === "gtceu:programmed_circuit" 
          ? `Conf ${entry.amount}` 
          : <>×{formatAmount(entry.amount)}{(entry.itemType === "fluid" || entry.itemType === "gas") && <span style={{ fontSize: 9, opacity: 0.65, marginLeft: 1 }}>mB</span>}</>}
      </div>
    </div>
  );
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

// Recursive tree node component for the visual machine pipeline
function PipelineCard({
  mNode,
  onSelectNode,
}: {
  mNode: TreeNodeData;
  onSelectNode?: (nodeId: string) => void;
}) {
  return (
    <div
      onClick={() => onSelectNode?.(mNode.id)}
      data-node-id={mNode.id}
      style={{
        background: mNode.isLockedRaw ? "#11221a" : "#1e1e1e",
        border: mNode.isLockedRaw ? "1.5px solid #10b981" : "1px solid #282828",
        borderRadius: 6,
        padding: "4px 6px",
        minWidth: 90,
        maxWidth: 120,
        textAlign: "center",
        boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
        cursor: "pointer",
        transition: "border-color 0.12s, transform 0.12s, background-color 0.12s",
        userSelect: "none",
        zIndex: 2,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#3b82f6";
        e.currentTarget.style.transform = "scale(1.03)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = mNode.isLockedRaw ? "#10b981" : "#282828";
        e.currentTarget.style.transform = "scale(1)";
      }}
      title={`Click to focus in canvas\n${mNode.machineName ?? "Crafting"}`}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        {/* Machine Icon - 3x of 12 = 36 */}
        <div
          style={{
            width: 36,
            height: 36,
            background: "#111",
            border: "1px solid #333",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <IconImage itemId={mNode.machineId ?? "minecraft:crafting_table"} itemName={mNode.machineName ?? "Crafting"} size={36} />
        </div>
        
        {/* Machine Name */}
        <div
          style={{
            color: "#fff",
            fontSize: 7,
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            width: "100%",
            textAlign: "center",
            fontFamily: "var(--font-geist-sans), sans-serif",
          }}
        >
          {mNode.machineName}
        </div>
      </div>

      {/* Output Item & Amount (Icon size: 4x of 8 = 32) */}
      <div
        style={{
          marginTop: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          fontSize: 10,
          color: "#10b981",
        }}
      >
        <div style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <IconImage itemId={mNode.itemId} itemName={mNode.itemName} size={32} itemType={mNode.itemType} />
        </div>
        <span
          style={{
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "var(--font-geist-sans), sans-serif",
          }}
        >
          ×{formatAmount(mNode.requestedAmount)}
        </span>
      </div>
      
      {/* Product Name */}
      <div
        style={{
          color: "#bbb",
          fontSize: 7,
          fontWeight: 400,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          width: "100%",
          textAlign: "center",
          fontFamily: "var(--font-geist-sans), sans-serif",
          marginTop: 2,
        }}
        title={mNode.itemName}
      >
        {mNode.itemName}
      </div>
      
      {/* Lock indicator */}
      {mNode.isLockedRaw && (
        <div style={{ color: "#10b981", fontSize: 6, fontWeight: 700, marginTop: 2 }}>
          🔒 Locked
        </div>
      )}
    </div>
  );
}

function MachineRow({
  index,
  mNode,
  onSelectNode,
}: {
  index: number;
  mNode: TreeNodeData;
  onSelectNode?: (nodeId: string) => void;
}) {
  return (
    <div
      onClick={() => onSelectNode?.(mNode.id)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderBottom: "1px solid #222222",
        fontFamily: "var(--font-geist-sans), sans-serif",
        cursor: "pointer",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#252525")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      title="Click to focus in canvas"
    >
      {/* Step index */}
      <span style={{ fontSize: 9, color: "#666", fontWeight: 700, minWidth: 16 }}>
        {index}.
      </span>

      {/* Machine Icon */}
      <div
        style={{
          width: 42,
          height: 42,
          flexShrink: 0,
          background: "#1a1a1a",
          border: "1px solid #333",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <IconImage
          itemId={mNode.machineId ?? "minecraft:crafting_table"}
          itemName={mNode.machineName ?? "Crafting"}
          size={42}
        />
      </div>

      {/* Machine Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#e5e5e5", fontSize: 12, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {mNode.machineName}
        </div>
        <div style={{ color: "#555", fontSize: 9.5, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {mNode.machineId}
        </div>
      </div>

      {/* Product Image & Info */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(0,0,0,0.2)",
          padding: "3px 8px",
          borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.03)",
          maxWidth: "35%",
          minWidth: 0,
        }}
      >
        <div style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <IconImage itemId={mNode.itemId} itemName={mNode.itemName} size={32} itemType={mNode.itemType} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#10b981", fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            ×{formatAmount(mNode.requestedAmount)}
          </div>
          <div 
            style={{ color: "#666", fontSize: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title={mNode.itemName}
          >
            {mNode.itemName}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ShoppingList({ nodes, edges, targetItemName, targetAmount, dragHandleProps, onSelectNode }: ShoppingListProps) {
  const [activeTab, setActiveTab] = useState<"equipment" | "materials" | "machines">("equipment");
  const [zoom, setZoom] = useState(1);

  // Build raw materials and catalysts
  const { rawMaterials, catalysts } = useMemo(
    () => buildShoppingList(nodes, edges),
    [nodes, edges]
  );

  // Topological sort of machines
  const sortedMachines = useMemo(() => {
    const machineNodes = nodes.filter((n) => n.machineId !== null && n.requestedAmount > 0);
    const visited = new Set<string>();
    const result: TreeNodeData[] = [];

    function visit(nodeId: string) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      // Incoming edges (source = child, target = parent)
      const incomingEdges = edges.filter((e) => e.target === nodeId);
      for (const edge of incomingEdges) {
        const childNode = nodes.find((n) => n.id === edge.source);
        if (childNode && childNode.machineId !== null) {
          visit(childNode.id);
        }
      }

      const currentNode = nodes.find((n) => n.id === nodeId);
      if (currentNode && currentNode.machineId !== null) {
        result.push(currentNode);
      }
    }

    for (const mNode of machineNodes) {
      visit(mNode.id);
    }

    return result;
  }, [nodes, edges]);

  // DAG levels calculation
  const levelMap = useMemo(() => {
    const map: Record<string, number> = {};
    const reversed = [...sortedMachines].reverse();
    for (const m of reversed) {
      if (map[m.id] === undefined) {
        map[m.id] = 0;
      }
      const childEdges = edges.filter(e => e.target === m.id);
      for (const edge of childEdges) {
        const childNode = sortedMachines.find(n => n.id === edge.source);
        if (childNode) {
          map[childNode.id] = Math.max(map[childNode.id] ?? 0, map[m.id] + 1);
        }
      }
    }
    return map;
  }, [sortedMachines, edges]);

  const levelsArray = useMemo(() => {
    if (sortedMachines.length === 0) return [];
    const maxLevel = Math.max(0, ...Object.values(levelMap));
    const arr: TreeNodeData[][] = Array.from({ length: maxLevel + 1 }, () => []);
    for (const m of sortedMachines) {
      const lvl = levelMap[m.id] ?? 0;
      arr[lvl].push(m);
    }
    return arr;
  }, [sortedMachines, levelMap]);

  // Coordinate measuring and SVG path connections
  const containerRef = useRef<HTMLDivElement>(null);
  const [connections, setConnections] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([]);

  const updateConnections = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const cardElements = containerRef.current.querySelectorAll<HTMLElement>("[data-node-id]");
    const coords: Record<string, { x: number; y: number; w: number; h: number }> = {};
    
    cardElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const nodeId = el.getAttribute("data-node-id")!;
      coords[nodeId] = {
        x: (rect.left - containerRect.left) / zoom,
        y: (rect.top - containerRect.top) / zoom,
        w: rect.width / zoom,
        h: rect.height / zoom,
      };
    });
    
    const newConnections: typeof connections = [];
    for (const edge of edges) {
      const sourceCoords = coords[edge.source];
      const targetCoords = coords[edge.target];
      if (sourceCoords && targetCoords) {
        newConnections.push({
          x1: sourceCoords.x + sourceCoords.w / 2,
          y1: sourceCoords.y,
          x2: targetCoords.x + targetCoords.w / 2,
          y2: targetCoords.y + targetCoords.h,
        });
      }
    }
    setConnections(newConnections);
  }, [edges, zoom]);

  useEffect(() => {
    updateConnections();
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      const observer = new ResizeObserver(() => {
        updateConnections();
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, [sortedMachines, edges, zoom, updateConnections]);

  const isEmpty = nodes.length === 0;

  function buildMarkdownExport() {
    const lines = [
      `# Materials and Equipment: ${targetItemName ?? "Unknown"} ×${formatAmount(targetAmount)}`,
      "",
      "## Equipment Pipeline (Order of assembly)",
    ];

    if (sortedMachines.length === 0) {
      lines.push("No machinery required.");
    } else {
      sortedMachines.forEach((mNode, idx) => {
        lines.push(`${idx + 1}. **${mNode.machineName}** (produces: *${mNode.itemName}* ×${formatAmount(mNode.requestedAmount)})`);
        mNode.inputs.forEach((input) => {
          const edge = edges.find((e) => e.target === mNode.id && e.targetHandle === `input-${input.itemId}`);
          if (edge) {
            const childNode = nodes.find((n) => n.id === edge.source);
            if (childNode && childNode.machineId !== null) {
              const sourceIdx = sortedMachines.findIndex((m) => m.id === childNode.id);
              lines.push(`   - Requires: *${input.itemName}* ×${formatAmount(input.amount * mNode.batchMultiplier)} (↳ Step ${sourceIdx + 1}: ${childNode.machineName})`);
              return;
            }
          }
          lines.push(`   - Requires: *${input.itemName}* ×${formatAmount(input.amount * mNode.batchMultiplier)}`);
        });
      });
    }

    lines.push("", "## Raw Materials Required");
    rawMaterials.forEach((e) => {
      lines.push(`- ${e.itemName}: **${formatAmount(e.amount)}** ${(e.itemType === "fluid" || e.itemType === "gas") ? "mB" : ""}`);
    });

    if (catalysts.length > 0) {
      lines.push("", "## Catalysts Required", ...catalysts.map((e) => {
        if (e.itemId === "gtceu:programmed_circuit") return `- ${e.itemName}: **Conf ${e.amount}**`;
        return `- ${e.itemName}: **${formatAmount(e.amount)}×**`;
      }));
    }

    return lines.join("\n");
  }

  function buildJsonExport() {
    return JSON.stringify(
      {
        target: { name: targetItemName, amount: targetAmount },
        pipeline: sortedMachines.map((m, idx) => ({
          step: idx + 1,
          machineId: m.machineId,
          machineName: m.machineName,
          produces: { itemId: m.itemId, itemName: m.itemName, amount: m.requestedAmount },
          inputs: m.inputs.map((input) => {
            let fromStep = null;
            const edge = edges.find((e) => e.target === m.id && e.targetHandle === `input-${input.itemId}`);
            if (edge) {
              const childNode = nodes.find((n) => n.id === edge.source);
              if (childNode && childNode.machineId !== null) {
                fromStep = sortedMachines.findIndex((sm) => sm.id === childNode.id) + 1;
              }
            }
            return {
              itemId: input.itemId,
              itemName: input.itemName,
              amount: input.amount * m.batchMultiplier,
              fromStep,
            };
          }),
        })),
        rawMaterials,
        catalysts,
      },
      null,
      2
    );
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#181818",
        borderLeft: "1px solid #2d2d2d",
        boxShadow: "-4px 0 20px rgba(0, 0, 0, 0.4)",
      }}
    >
      {/* Title Header */}
      <div
        {...dragHandleProps}
        style={{
          padding: "16px 14px 12px",
          borderBottom: "1px solid #282828",
          flexShrink: 0,
          fontFamily: "var(--font-geist-mono, monospace)",
          cursor: dragHandleProps?.style?.cursor ?? "grab",
          userSelect: "none",
          ...dragHandleProps?.style,
        }}
      >
        <div style={{ color: "#e5e5e5", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
          🛠️ Materials & Equipment
        </div>
        {targetItemName && (
          <div style={{ marginTop: 6, color: "#666", fontSize: 9 }}>
            Target:{" "}
            <span style={{ color: "#34d399", fontWeight: 700 }}>{targetItemName}</span>{" "}
            ×{formatAmount(targetAmount)}
          </div>
        )}
      </div>

      {/* Tabs */}
      {!isEmpty && (
        <div
          style={{
            display: "flex",
            background: "#1e1e1e",
            borderBottom: "1px solid #282828",
            padding: "2px",
            gap: 2,
            flexShrink: 0,
          }}
        >
          {[
            { id: "equipment", label: "Pipeline" },
            { id: "materials", label: "Materials" },
            { id: "machines",  label: "Machines" },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as "equipment" | "materials" | "machines")}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  background: active ? "#2a2a2a" : "transparent",
                  border: "none",
                  borderRadius: 4,
                  color: active ? "#e5e5e5" : "#666",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  fontFamily: "var(--font-geist-mono, monospace)",
                  transition: "all 0.15s ease",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content Area */}
      {isEmpty ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#333",
            fontFamily: "var(--font-geist-mono, monospace)",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 32 }}>🌱</div>
          <div style={{ fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "center", lineHeight: 1.6 }}>
            Define a target item<br />to plan materials
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* TAB 1: EQUIPMENT PIPELINE */}
          {activeTab === "equipment" && (
            <div
              style={{
                flex: 1,
                overflow: "auto",
                padding: "12px 8px 16px",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              {/* Zoom controls */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                maxWidth: 240,
                marginBottom: 10,
                padding: "4px 8px",
                background: "#161616",
                borderRadius: 6,
                border: "1px solid #282828",
                fontFamily: "var(--font-geist-mono, monospace)",
                fontSize: 9,
                flexShrink: 0,
                boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              }}>
                <span style={{ color: "#888" }}>Zoom: {(zoom * 100).toFixed(0)}%</span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
                    style={{
                      background: "#222", border: "1px solid #333", color: "#ccc",
                      padding: "2px 5px", borderRadius: 4, cursor: "pointer", fontSize: 9,
                      lineHeight: 1
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#2a2a2a"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "#222"}
                  >
                    -
                  </button>
                  <button
                    onClick={() => setZoom(1)}
                    style={{
                      background: "#222", border: "1px solid #333", color: "#ccc",
                      padding: "2px 5px", borderRadius: 4, cursor: "pointer", fontSize: 9,
                      lineHeight: 1
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#2a2a2a"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "#222"}
                  >
                    1:1
                  </button>
                  <button
                    onClick={() => setZoom(z => Math.min(2.0, z + 0.1))}
                    style={{
                      background: "#222", border: "1px solid #333", color: "#ccc",
                      padding: "2px 5px", borderRadius: 4, cursor: "pointer", fontSize: 9,
                      lineHeight: 1
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#2a2a2a"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "#222"}
                  >
                    +
                  </button>
                </div>
              </div>

              {sortedMachines.length === 0 ? (
                <div style={{ color: "#444", fontSize: 9, textAlign: "center", marginTop: 24, fontFamily: "monospace" }}>
                  No machines required (raw items only)
                </div>
              ) : (
                <div
                  ref={containerRef}
                  style={{
                    width: "max-content",
                    minWidth: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 32,
                    alignItems: "center",
                    zoom: zoom,
                    transition: "zoom 0.12s ease",
                    position: "relative",
                    padding: "16px 16px 32px",
                    boxSizing: "border-box",
                  }}
                >
                  {/* SVG Overlay behind the cards */}
                  <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
                    {connections.map((c, idx) => {
                      const controlHeight = Math.min(24, Math.abs(c.y2 - c.y1) / 2);
                      const pathStr = `M ${c.x1} ${c.y1} C ${c.x1} ${c.y1 - controlHeight}, ${c.x2} ${c.y2 + controlHeight}, ${c.x2} ${c.y2}`;
                      return (
                        <path
                          key={idx}
                          d={pathStr}
                          stroke="#3b82f6"
                          strokeWidth="1.5"
                          fill="none"
                          opacity="0.45"
                        />
                      );
                    })}
                  </svg>

                  {/* Level-by-level Row Rendering */}
                  {levelsArray.map((rowNodes, lvlIdx) => (
                    <div
                      key={lvlIdx}
                      style={{
                        display: "flex",
                        gap: 24,
                        justifyContent: "center",
                        flexWrap: "nowrap",
                        zIndex: 1,
                      }}
                    >
                      {rowNodes.map((mNode) => (
                        <PipelineCard
                          key={mNode.id}
                          mNode={mNode}
                          onSelectNode={onSelectNode}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TOTAL MATERIALS */}
          {activeTab === "materials" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              {/* Raw Materials – always shown */}
              <div style={{ padding: "8px 12px 6px", fontSize: 9.5, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, borderBottom: "1px solid #222", display: "flex", alignItems: "center", gap: 6 }}>
                <span>📦 Raw Materials</span>
                <span style={{ color: "#333", background: "#222", borderRadius: 3, padding: "0 4px", fontSize: 9 }}>{rawMaterials.length}</span>
              </div>
              {rawMaterials.length === 0 ? (
                <div style={{ padding: "12px 10px", fontSize: 10, color: "#333", fontFamily: "monospace", textAlign: "center" }}>
                  ✓ All inputs connected
                </div>
              ) : (
                rawMaterials.map((e) => (
                  <EntryRow key={e.itemId} entry={e} />
                ))
              )}

              {/* Catalysts – shown only when present */}
              {catalysts.length > 0 && (
                <>
                  <div style={{ padding: "12px 12px 6px", fontSize: 9.5, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, borderBottom: "1px solid #222", display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid #1a1a1a", marginTop: 6 }}>
                    <span>⚗️ Catalysts</span>
                    <span style={{ color: "#333", background: "#222", borderRadius: 3, padding: "0 4px", fontSize: 9 }}>{catalysts.length}</span>
                  </div>
                  {catalysts.map((e) => (
                    <EntryRow key={e.itemId} entry={e} />
                  ))}
                </>
              )}
            </div>
          )}

          {/* TAB 3: INDIVIDUAL MACHINES */}
          {activeTab === "machines" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              <div style={{ padding: "6px 10px 4px", fontSize: 8, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, borderBottom: "1px solid #222", display: "flex", alignItems: "center", gap: 5 }}>
                <span>⚙️ Active Machines</span>
                <span style={{ color: "#333", background: "#222", borderRadius: 3, padding: "0 4px" }}>{sortedMachines.length}</span>
              </div>
              {sortedMachines.length === 0 ? (
                <div style={{ padding: "10px 10px", fontSize: 9, color: "#333", fontFamily: "monospace", textAlign: "center" }}>
                  No machines active (raw items only)
                </div>
              ) : (
                sortedMachines.map((mNode, idx) => (
                  <MachineRow
                    key={mNode.id}
                    index={idx + 1}
                    mNode={mNode}
                    onSelectNode={onSelectNode}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Export Footer */}
      {!isEmpty && (
        <div
          style={{
            padding: "8px 10px",
            borderTop: "1px solid #282828",
            flexShrink: 0,
            fontFamily: "var(--font-geist-mono, monospace)",
          }}
        >
          <div style={{ fontSize: 8, color: "#444", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>
            Export Materials & Pipeline
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
                  background: "#222",
                  border: "1px solid #333",
                  borderRadius: 5,
                  color: "#666",
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textTransform: "uppercase",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#2a2a2a";
                  e.currentTarget.style.borderColor = "#444";
                  e.currentTarget.style.color = "#ccc";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#222";
                  e.currentTarget.style.borderColor = "#333";
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
