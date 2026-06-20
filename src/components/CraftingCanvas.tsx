"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
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
import { IconImage } from "@/components/IconImage";
import { getEdgeColor } from "@/lib/batchCalc";
import type { TreeNodeData } from "@/lib/batchCalc";

// ─── React Flow node types ───────────────────────────────────────────────────
const nodeTypes = { machineNode: MachineNode };

// ─── Collect a node + its entire subtree (to delete on replace) ──────────────
// Edge model: source=child (producer below), target=parent (consumer above)
// So "children of nodeId" = edges where target === nodeId → source values
function collectSubtree(
  nodeId: string,
  allEdges: Edge[],
  edgesBeingRemoved: Set<string>
): Set<string> {
  // If this node is used by any OTHER parent (an edge where source is this node and edge is NOT being removed)
  // then we should NOT delete this node (and thus its subtree remains attached).
  const parentEdges = allEdges.filter(e => e.source === nodeId && !edgesBeingRemoved.has(e.id));
  if (parentEdges.length > 0) {
    return new Set<string>(); // Used elsewhere, do not delete
  }

  const ids = new Set<string>([nodeId]);
  const childEdges = allEdges.filter((e) => e.target === nodeId);
  for (const edge of childEdges) {
    edgesBeingRemoved.add(edge.id);
    collectSubtree(edge.source, allEdges, edgesBeingRemoved).forEach((id) => ids.add(id));
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

function recalculateTreeAmounts(nds: Node[], eds: Edge[], currentTargetAmount: number): Node[] {
  const updatedNodes = nds.map((n) => ({ ...n, data: { ...n.data as TreeNodeData } }));

  // Initialize all nodes to 0 requestedAmount
  for (const n of updatedNodes) {
    (n.data as TreeNodeData).requestedAmount = 0;
  }

  // Set target on root
  const rootIndex = updatedNodes.findIndex((n) => n.id === "node-root");
  if (rootIndex !== -1) {
    (updatedNodes[rootIndex].data as TreeNodeData).requestedAmount = currentTargetAmount;
  }

  // Topological sort from parents to children
  const visited = new Set<string>();
  const orderedIds: string[] = [];

  function visit(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const childEdges = eds.filter((e) => e.target === nodeId);
    for (const edge of childEdges) {
      visit(edge.source);
    }
    orderedIds.push(nodeId);
  }

  // Start topological sort from root
  visit("node-root");
  for (const n of updatedNodes) {
    visit(n.id);
  }

  const parentsFirstIds = [...orderedIds].reverse();

  // Propagate top-down
  for (const nodeId of parentsFirstIds) {
    const nodeIndex = updatedNodes.findIndex((n) => n.id === nodeId);
    if (nodeIndex === -1) continue;

    const data = updatedNodes[nodeIndex].data as TreeNodeData;
    const outputAmount = data.outputs?.find((o) => o.itemId === data.itemId)?.amount ?? 1;
    const newBatchMultiplier = data.requestedAmount / outputAmount;
    data.batchMultiplier = newBatchMultiplier;

    const incomingEdges = eds.filter((e) => e.target === nodeId);
    for (const edge of incomingEdges) {
      const childIndex = updatedNodes.findIndex((n) => n.id === edge.source);
      if (childIndex === -1) continue;

      const inputItemId = edge.targetHandle?.replace("input-", "");
      if (!inputItemId) continue;

      const inputDef = data.inputs?.find((i) => i.itemId === inputItemId);
      if (!inputDef) continue;

      const childRequested = data.isLockedRaw
        ? 0
        : inputDef.catalyst
        ? inputDef.amount
        : inputDef.amount * newBatchMultiplier;

      (updatedNodes[childIndex].data as TreeNodeData).requestedAmount += childRequested;
    }
  }

  return updatedNodes as Node[];
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function CraftingCanvas() {
  const [nodes, setNodes] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);

  // Refs to prevent stale closures in React Flow node callbacks
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const styledEdges = edges; // Opacity/mute styling disabled, nothing should fade out!

  // Intercept node/edge changes to recalculate amounts if elements are removed via UI (e.g. Backspace)
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => {
      const nextNodes = applyNodeChanges(changes, nds) as Node[];
      if (changes.some(c => c.type === "remove")) {
        return recalculateTreeAmounts(nextNodes, edgesRef.current, targetAmountRef.current);
      }
      return nextNodes;
    });
  }, []);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => {
      const nextEdges = applyEdgeChanges(changes, eds) as Edge[];
      if (changes.some(c => c.type === "remove")) {
        setNodes((nds) => recalculateTreeAmounts(nds, nextEdges, targetAmountRef.current));
      }
      return nextEdges;
    });
  }, []);

  // Root item selection
  const [rootSetup, setRootSetup] = useState<RootSetup>({
    searching: false,
    results: [],
    query: "",
    focused: false,
  });
  const [targetAmount, setTargetAmount] = useState(1);
  const targetAmountRef = useRef(targetAmount);
  targetAmountRef.current = targetAmount;

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
    // Fix #5: fluid esetén minimum 1000mB (1 vödör) ha alacsonyabb lenne a cél
    const effectiveAmount = item.type === "fluid" && targetAmount < 1000 ? 1000 : targetAmount;
    if (item.type === "fluid" && targetAmount < 1000) setTargetAmount(1000);
    setPendingChild({ parentNodeId: "ROOT", inputItemId: item.id, requestedAmount: effectiveAmount });
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
        onToggleLock: handleToggleLock,
      } as TreeNodeData & { onAddChild: unknown; onEditNote: unknown; onToggleLock: unknown },
    };

    if (parentNodeId === "ROOT") {
      const nextNodes = [...nodes, newNode];
      setNodes(recalculateTreeAmounts(nextNodes, edges, targetAmount));
      return;
    }

    if (!nodeData.itemId) {
      const nextNodes = [...nodes, newNode];
      setNodes(recalculateTreeAmounts(nextNodes, edges, targetAmount));
      return;
    }

    // FIX 2: If there's already a node connected to this input slot, remove it
    // and its entire subtree before adding the replacement.
    const existingEdge = edges.find(
      (e) => e.target === parentNodeId && e.targetHandle === `input-${inputItemId}`
    );
    const removedEdges = new Set<string>();
    if (existingEdge) removedEdges.add(existingEdge.id);

    const idsToRemove: Set<string> = existingEdge
      ? collectSubtree(existingEdge.source, edges, removedEdges)
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

    const nextNodes = [
      ...nodes.filter((n) => !idsToRemove.has(n.id)),
      newNode,
    ];
    const nextEdges = [
      ...edges.filter(
        (e) => !idsToRemove.has(e.source) && !idsToRemove.has(e.target)
      ),
      newEdge,
    ];

    setEdges(nextEdges);
    setNodes(recalculateTreeAmounts(nextNodes, nextEdges, targetAmount));
  }

  const handleAddChild = useCallback(
    (nodeId: string, inputItemId: string, requestedAmount: number) => {
      const node = nodesRef.current.find((n) => n.id === nodeId);
      const nodeData = node?.data as TreeNodeData | undefined;
      const inputInfo = nodeData?.inputs.find((i) => i.itemId === inputItemId);
      const name = inputInfo?.itemName ?? inputItemId;

      setPendingChild({ parentNodeId: nodeId, inputItemId, requestedAmount });
      setRecipeItemName(name);
      setRecipeModalOpen(true);
    },
    []
  );

  const handleEditNote = useCallback((nodeId: string, currentNote: string | null) => {
    setNoteModal({ open: true, nodeId, currentNote });
  }, []);

  const handleToggleLock = useCallback(
    (nodeId: string) => {
      setNodes((nds) => {
        const nextNodes = nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data as TreeNodeData,
                  isLockedRaw: !(n.data as TreeNodeData).isLockedRaw,
                },
              }
            : n
        );
        return recalculateTreeAmounts(nextNodes, edgesRef.current, targetAmountRef.current);
      });
    },
    []
  );

  function handleNoteSave(nodeId: string, note: string | null) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, notes: note } } : n
      )
    );
  }

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const nextEdges = addEdge(connection, eds);
        setNodes((nds) => recalculateTreeAmounts(nds, nextEdges, targetAmountRef.current));
        return nextEdges;
      });
    },
    []
  );

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      const sourceNode = nodesRef.current.find((n) => n.id === connection.source);
      const sourceItemId = (sourceNode?.data as TreeNodeData)?.itemId;

      const expectedItemId = connection.targetHandle?.replace("input-", "");

      if (!sourceItemId || !expectedItemId) return false;

      return sourceItemId === expectedItemId;
    },
    []
  );

  function handleTargetAmountChange(val: number) {
    setTargetAmount(val);
    setNodes((nds) => recalculateTreeAmounts(nds, edges, val));
  }

  function resetTree() {
    setNodes([]);
    setEdges([]);
    setRootItem(null);
    setTargetAmount(1);
    setRootSetup({ searching: false, results: [], query: "", focused: false });
  }

  const showDropdown =
    !rootItem && (rootSetup.focused || rootSetup.results.length > 0);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", height: "100%", background: "#1a1a1a" }}>

      {/* ── Left sidebar ──────────────────────────────────────────────────── */}
      <div
        style={{
          width: 320,
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
              {/* Fix #5: fluid esetén mB egységet mutatunk */}
              Target Amount {rootItem?.type === "fluid" ? <span style={{ color: "#2563eb" }}>(mB)</span> : null}
            </label>
            <input
              type="number"
              min={rootItem?.type === "fluid" ? 1000 : 1}
              step={rootItem?.type === "fluid" ? 1000 : 1}
              value={targetAmount}
              onChange={(e) => {
                const raw = parseInt(e.target.value) || 1;
                // Fix #5: fluid esetén 1000-es lépésközre kerekítünk
                const val = rootItem?.type === "fluid"
                  ? Math.max(1000, Math.round(raw / 1000) * 1000)
                  : Math.max(1, raw);
                handleTargetAmountChange(val);
              }}
              style={{
                width: "100%",
                background: "#262626",
                border: `1px solid ${rootItem?.type === "fluid" ? "#1d4ed8" : "#3a3a3a"}`,
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
            {rootItem?.type === "fluid" && (
              <div style={{ fontSize: 8, color: "#2563eb", marginTop: 3, letterSpacing: "0.06em" }}>
                {(targetAmount / 1000).toFixed(targetAmount % 1000 === 0 ? 0 : 3)}× bucket
              </div>
            )}
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
                  background: "#262626",
                  border: "1px solid #3a3a3a",
                  borderRadius: 6,
                  padding: "8px 10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Item icon slot */}
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      background: "#1a1a1a",
                      border: `1.5px solid ${
                        rootItem.type === "fluid" ? "#2563eb"
                        : rootItem.type === "gas" ? "#7c3aed"
                        : "#3a3a3a"
                      }`,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)",
                    }}
                  >
                    <IconImage
                      itemId={rootItem.id}
                      itemName={rootItem.name}
                      size={40}
                      itemType={rootItem.type}
                      textStyle={{
                        color: rootItem.type === "fluid" ? "#93c5fd"
                          : rootItem.type === "gas" ? "#c4b5fd"
                          : "#aaa",
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: "monospace",
                        letterSpacing: "-0.04em",
                      }}
                    />
                  </div>
                  {/* Name + id */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#34d399", fontSize: 12, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {rootItem.name}
                    </div>
                    <div style={{ color: "#444", fontSize: 8, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {rootItem.id}
                    </div>
                  </div>
                  {/* Reset button */}
                  <button
                    onClick={resetTree}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#444",
                      cursor: "pointer",
                      fontSize: 14,
                      padding: "2px 3px",
                      lineHeight: 1,
                      flexShrink: 0,
                      borderRadius: 4,
                      transition: "color 0.12s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}
                    title="Reset tree"
                  >
                    ✕
                  </button>
                </div>
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
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: -80,
                    marginTop: 4,
                    background: "#1e1e1e",
                    border: "1px solid #3a3a3a",
                    borderRadius: 8,
                    overflow: "hidden",
                    maxHeight: 380,
                    overflowY: "auto",
                    zIndex: 100,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 1,
                      padding: 2,
                      background: "#1a1a1a",
                    }}
                  >
                    {rootSetup.results.slice(0, 32).map((item) => {
                      const borderColors = { item: "#3a3a3a", fluid: "#2563eb", gas: "#7c3aed" };
                      const textColors = { item: "#aaa", fluid: "#93c5fd", gas: "#c4b5fd" };
                      return (
                        <button
                          key={item.id}
                          onMouseDown={() => startTree(item)}
                          style={{
                            textAlign: "left",
                            padding: "6px 8px",
                            background: "#1e1e1e",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontFamily: "inherit",
                            transition: "background 0.12s",
                            minWidth: 0,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#1e1e1e")}
                        >
                          {/* Icon slot */}
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              flexShrink: 0,
                              background: "#141414",
                              border: `1.5px solid ${borderColors[item.type] ?? "#3a3a3a"}`,
                              borderRadius: 5,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)",
                            }}
                          >
                            <IconImage
                              itemId={item.id}
                              itemName={item.name}
                              size={32}
                              itemType={item.type}
                              textStyle={{
                                color: textColors[item.type] ?? "#aaa",
                                fontSize: 10,
                                fontWeight: 700,
                                fontFamily: "monospace",
                                letterSpacing: "-0.04em",
                              }}
                            />
                          </div>
                          {/* Text */}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ color: "#ccc", fontSize: 10, fontWeight: 600, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.name}
                            </div>
                            <div style={{ color: "#444", fontSize: 8, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.id}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
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
          edges={styledEdges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
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
          edges={edges}
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
