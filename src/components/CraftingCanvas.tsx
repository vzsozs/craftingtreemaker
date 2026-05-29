"use client";

import { useState, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  BackgroundVariant,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import MachineNode from "@/components/nodes/MachineNode";
import RecipePickerModal from "@/components/RecipePickerModal";
import NoteEditorModal from "@/components/NoteEditorModal";
import ShoppingList from "@/components/ShoppingList";
import { Input } from "@/components/ui/input";
import { getEdgeColor } from "@/lib/batchCalc";
import type { TreeNodeData } from "@/lib/batchCalc";

// ─── React Flow node types ───────────────────────────────────────────────────
const nodeTypes = { machineNode: MachineNode };

// ─── Collect a node + its entire subtree (to delete on replace) ──────────────
// Edge model: source=child (producer below), target=parent (consumer above)
// So "children of nodeId" = edges where target === nodeId → source values
function collectSubtree(rootId: string, allEdges: Edge[]): Set<string> {
  const ids = new Set<string>([rootId]);
  const childEdges = allEdges.filter((e) => e.target === rootId);
  for (const edge of childEdges) {
    collectSubtree(edge.source, allEdges).forEach((id) => ids.add(id));
  }
  return ids;
}

// Dashed edge style matching reference image
const defaultEdgeOptions = {
  type: "default",
  style: {
    strokeWidth: 1.5,
    strokeDasharray: "6 3",
  },
  animated: false,
};

type PendingChild = {
  parentNodeId: string;
  inputItemId: string;
  requestedAmount: number;
};

type RootSetup = {
  searching: boolean;
  results: { id: string; name: string; type: "item" | "fluid" | "gas" }[];
  query: string;
  focused: boolean;
};

// ─── Main component ──────────────────────────────────────────────────────────
export default function CraftingCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Root item selection
  const [rootSetup, setRootSetup] = useState<RootSetup>({
    searching: false,
    results: [],
    query: "",
    focused: false,
  });
  const [targetAmount, setTargetAmount] = useState(1);
  const [rootItem, setRootItem] = useState<{
    id: string;
    name: string;
    type: "item" | "fluid" | "gas";
  } | null>(null);

  // Recipe picker
  const [pendingChild, setPendingChild] = useState<PendingChild | null>(null);
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [recipeItemName, setRecipeItemName] = useState<string | null>(null);

  // Note editor
  const [noteModal, setNoteModal] = useState<{
    open: boolean;
    nodeId: string | null;
    currentNote: string | null;
  }>({ open: false, nodeId: null, currentNote: null });

  const nodeIdCounter = useRef(0);
  const generateId = () => `node-${++nodeIdCounter.current}`;

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function getNodeDataList(): TreeNodeData[] {
    return nodes.map((n) => n.data as TreeNodeData);
  }

  // Search items – also called with "" to show all items on focus
  async function searchItems(q: string) {
    setRootSetup((s) => ({ ...s, query: q, searching: true }));
    const res = await fetch(`/api/items?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setRootSetup((s) => ({ ...s, results: data, searching: false }));
  }

  // Called on input focus to immediately show all items
  function handleSearchFocus() {
    setRootSetup((s) => ({ ...s, focused: true }));
    if (rootSetup.results.length === 0) {
      searchItems(rootSetup.query);
    }
  }

  function handleSearchBlur() {
    // Delay so click on result registers first
    setTimeout(() => setRootSetup((s) => ({ ...s, focused: false })), 150);
  }

  // Start with a root item
  function startTree(item: { id: string; name: string; type: "item" | "fluid" | "gas" }) {
    setRootItem(item);
    setRootSetup({ searching: false, results: [], query: "", focused: false });
    setPendingChild({ parentNodeId: "ROOT", inputItemId: item.id, requestedAmount: targetAmount });
    setRecipeItemName(item.name);
    setRecipeModalOpen(true);
  }

  // Add child node when user picks a recipe
  // VERTICAL LAYOUT: root at top, children cascade downward
  function handleRecipeSelect(
    _recipe: unknown,
    nodeData: Partial<TreeNodeData>,
    parentNodeId: string,
    inputItemId: string
  ) {
    const id = parentNodeId === "ROOT" ? "node-root" : generateId();

    const parentNode = nodes.find((n) => n.id === parentNodeId);
    const parentX = parentNode?.position.x ?? 400;
    const parentY = parentNode?.position.y ?? 50;

    // Count existing children of this parent to offset horizontally
    const siblingCount = nodes.filter((n) =>
      edges.some((e) => e.source === n.id && e.target === parentNodeId)
    ).length;

    // Vertical: children go BELOW parent, spread horizontally
    const NODE_HEIGHT = 300; // approximate node height + gap
    const NODE_WIDTH  = 260; // approximate node width

    let newPosition: { x: number; y: number };
    if (parentNodeId === "ROOT") {
      // Root node at top center
      newPosition = { x: 400, y: 60 };
    } else {
      // Spread children horizontally below parent
      // Center around parent X, offset right for each sibling
      const offsetX = siblingCount * NODE_WIDTH - (siblingCount > 0 ? NODE_WIDTH * 0.5 : 0);
      newPosition = {
        x: parentX + offsetX,
        y: parentY + NODE_HEIGHT,
      };
    }

    const newNode: Node = {
      id,
      type: "machineNode",
      position: newPosition,
      data: {
        ...nodeData,
        id,
        onAddChild: handleAddChild,
        onEditNote: handleEditNote,
      } as TreeNodeData & { onAddChild: unknown; onEditNote: unknown },
    };

    if (parentNodeId === "ROOT") {
      setNodes((nds) => [...nds, newNode]);
      return;
    }

    if (!nodeData.itemId) {
      setNodes((nds) => [...nds, newNode]);
      return;
    }

    // FIX 2: If there's already a node connected to this input slot, remove it
    // and its entire subtree before adding the replacement.
    const existingEdge = edges.find(
      (e) => e.target === parentNodeId && e.targetHandle === `input-${inputItemId}`
    );
    const idsToRemove: Set<string> = existingEdge
      ? collectSubtree(existingEdge.source, edges)
      : new Set();

    const itemType = nodeData.itemType ?? "item";
    const edgeColor = getEdgeColor(itemType);
    const newEdge: Edge = {
      id: `edge-${parentNodeId}-${id}`,
      source: id,
      target: parentNodeId,
      sourceHandle: "output",
      targetHandle: `input-${inputItemId}`,
      style: {
        stroke: edgeColor,
        strokeWidth: 1.5,
        strokeDasharray: itemType === "item" ? "6 3" : "none",
      },
      animated: itemType !== "item",
    };

    setNodes((nds) => [
      ...nds.filter((n) => !idsToRemove.has(n.id)),
      newNode,
    ]);
    setEdges((eds) => [
      ...eds.filter(
        (e) => !idsToRemove.has(e.source) && !idsToRemove.has(e.target)
      ),
      newEdge,
    ]);
  }

  const handleAddChild = useCallback(
    (nodeId: string, inputItemId: string, requestedAmount: number) => {
      const node = nodes.find((n) => n.id === nodeId);
      const nodeData = node?.data as TreeNodeData | undefined;
      const inputInfo = nodeData?.inputs.find((i) => i.itemId === inputItemId);
      const name = inputInfo?.itemName ?? inputItemId;

      setPendingChild({ parentNodeId: nodeId, inputItemId, requestedAmount });
      setRecipeItemName(name);
      setRecipeModalOpen(true);
    },
    [nodes]
  );

  const handleEditNote = useCallback((nodeId: string, currentNote: string | null) => {
    setNoteModal({ open: true, nodeId, currentNote });
  }, []);

  function handleNoteSave(nodeId: string, note: string | null) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, notes: note } } : n
      )
    );
  }

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  function handleTargetAmountChange(val: number) {
    setTargetAmount(val);
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === "node-root") {
          const data = n.data as TreeNodeData;
          const outputAmount =
            data.outputs.find((o) => o.itemId === data.itemId)?.amount ?? 1;
          return {
            ...n,
            data: {
              ...data,
              requestedAmount: val,
              batchMultiplier: val / outputAmount,
            },
          };
        }
        return n;
      })
    );
  }

  function resetTree() {
    setNodes([]);
    setEdges([]);
    setRootItem(null);
    setTargetAmount(1);
  }

  const showDropdown =
    !rootItem && (rootSetup.focused || rootSetup.results.length > 0);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", height: "100%", background: "#1a1a1a" }}>

      {/* ── Left sidebar ──────────────────────────────────────────────────── */}
      <div
        style={{
          width: 260,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          background: "#1e1e1e",
          borderRight: "1px solid #2d2d2d",
          zIndex: 10,
          fontFamily: "var(--font-geist-mono, monospace)",
        }}
      >
        {/* Logo */}
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #2d2d2d" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>🌲</span>
            <span style={{ color: "#e5e5e5", fontWeight: 700, fontSize: 14, letterSpacing: "0.02em" }}>
              Crafting Tree
            </span>
          </div>
          <div style={{ color: "#444", fontSize: 9, marginTop: 3, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Minecraft modpack planner
          </div>
        </div>

        {/* Controls */}
        <div style={{ padding: "14px 14px 0", borderBottom: "1px solid #2d2d2d", paddingBottom: 14 }}>
          {/* Target amount */}
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                display: "block",
                fontSize: 9,
                color: "#555",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 5,
                fontWeight: 600,
              }}
            >
              Target Amount
            </label>
            <input
              type="number"
              min={1}
              value={targetAmount}
              onChange={(e) =>
                handleTargetAmountChange(Math.max(1, parseInt(e.target.value) || 1))
              }
              style={{
                width: "100%",
                background: "#262626",
                border: "1px solid #3a3a3a",
                borderRadius: 6,
                color: "#e5e5e5",
                fontSize: 13,
                fontWeight: 700,
                padding: "6px 10px",
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Target item */}
          {rootItem ? (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 9,
                  color: "#555",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginBottom: 5,
                  fontWeight: 600,
                }}
              >
                Target Item
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#262626",
                  border: "1px solid #3a3a3a",
                  borderRadius: 6,
                  padding: "7px 10px",
                }}
              >
                <span style={{ color: "#34d399", fontSize: 12, fontWeight: 700 }}>
                  {rootItem.name}
                </span>
                <button
                  onClick={resetTree}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#555",
                    cursor: "pointer",
                    fontSize: 12,
                    padding: 0,
                    lineHeight: 1,
                  }}
                  title="Reset tree"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <label
                style={{
                  display: "block",
                  fontSize: 9,
                  color: "#555",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginBottom: 5,
                  fontWeight: 600,
                }}
              >
                Search Target Item
              </label>
              <input
                placeholder="Filter items..."
                value={rootSetup.query}
                onChange={(e) => searchItems(e.target.value)}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                style={{
                  width: "100%",
                  background: "#262626",
                  border: "1px solid #3a3a3a",
                  borderRadius: 6,
                  color: "#e5e5e5",
                  fontSize: 11,
                  padding: "6px 10px",
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {rootSetup.searching && (
                <div style={{ color: "#555", fontSize: 9, marginTop: 4, letterSpacing: "0.08em" }}>
                  Searching...
                </div>
              )}
              {showDropdown && rootSetup.results.length > 0 && (
                <div
                  style={{
                    marginTop: 4,
                    background: "#262626",
                    border: "1px solid #3a3a3a",
                    borderRadius: 6,
                    overflow: "hidden",
                    maxHeight: 240,
                    overflowY: "auto",
                  }}
                >
                  {rootSetup.results.slice(0, 12).map((item) => {
                    const typeColors = { item: "#666", fluid: "#2563eb", gas: "#7c3aed" };
                    return (
                      <button
                        key={item.id}
                        onMouseDown={() => startTree(item)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "7px 10px",
                          background: "transparent",
                          border: "none",
                          borderBottom: "1px solid #2a2a2a",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          fontFamily: "inherit",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#2f2f2f")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: typeColors[item.type] ?? "#666",
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: "#ccc", fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>
                            {item.name}
                          </div>
                          <div style={{ color: "#444", fontSize: 9, marginTop: 1 }}>{item.id}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Legend + instructions */}
        <div style={{ padding: "12px 14px", flex: 1 }}>
          <div
            style={{
              fontSize: 9,
              color: "#444",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            How to use
          </div>
          {[
            "Set the target amount",
            "Select your target item",
            "Pick a recipe from modal",
            "Click + on any input to expand",
            "Export shopping list when done",
          ].map((step, i) => (
            <div
              key={i}
              style={{ display: "flex", gap: 7, marginBottom: 5, alignItems: "flex-start" }}
            >
              <span style={{ color: "#333", fontSize: 9, minWidth: 14, fontWeight: 700 }}>
                {i + 1}.
              </span>
              <span style={{ color: "#444", fontSize: 10, lineHeight: 1.4 }}>{step}</span>
            </div>
          ))}

          {/* Legend */}
          <div
            style={{
              marginTop: 14,
              paddingTop: 10,
              borderTop: "1px solid #2a2a2a",
              fontSize: 9,
              color: "#444",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 7,
              fontWeight: 600,
            }}
          >
            Edge Colors
          </div>
          {[
            { label: "Solid item", color: "#6B7280" },
            { label: "Fluid",      color: "#3B82F6" },
            { label: "Gas",        color: "#8B5CF6" },
          ].map(({ label, color }) => (
            <div
              key={label}
              style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}
            >
              <svg width="20" height="8" viewBox="0 0 20 8">
                <line
                  x1="0" y1="4" x2="20" y2="4"
                  stroke={color}
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
              </svg>
              <span style={{ color: "#444", fontSize: 10 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Canvas ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          defaultEdgeOptions={defaultEdgeOptions}
          style={{ background: "#1a1a1a" }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={28}
            size={1}
            color="#2a2a2a"
          />
          <Controls
            style={{
              background: "#262626",
              border: "1px solid #3a3a3a",
              borderRadius: 8,
            }}
          />
          <MiniMap
            style={{
              background: "#1e1e1e",
              border: "1px solid #2d2d2d",
              borderRadius: 8,
            }}
            nodeColor="#333"
            maskColor="rgba(20,20,20,0.75)"
          />
        </ReactFlow>

        {/* Empty state */}
        {nodes.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.15 }}>🌲</div>
              <div
                style={{
                  color: "#333",
                  fontSize: 12,
                  fontFamily: "var(--font-geist-mono, monospace)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Select a target item to start
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Shopping List ─────────────────────────────────────────────────── */}
      <div style={{ width: 256, flexShrink: 0 }}>
        <ShoppingList
          nodes={getNodeDataList()}
          targetItemName={rootItem?.name ?? null}
          targetAmount={targetAmount}
        />
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <RecipePickerModal
        open={recipeModalOpen}
        itemId={pendingChild?.inputItemId ?? null}
        itemName={recipeItemName}
        requestedAmount={pendingChild?.requestedAmount ?? 1}
        onSelect={(recipe, nodeData) => {
          if (pendingChild) {
            handleRecipeSelect(
              recipe,
              nodeData,
              pendingChild.parentNodeId,
              pendingChild.inputItemId
            );
          }
        }}
        onClose={() => {
          setRecipeModalOpen(false);
          setPendingChild(null);
        }}
      />

      <NoteEditorModal
        open={noteModal.open}
        nodeId={noteModal.nodeId}
        currentNote={noteModal.currentNote}
        onSave={handleNoteSave}
        onClose={() => setNoteModal({ open: false, nodeId: null, currentNote: null })}
      />
    </div>
  );
}
