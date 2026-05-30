"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatAmount } from "@/lib/batchCalc";
import type { TreeNodeData } from "@/lib/batchCalc";
import { IconImage } from "@/components/IconImage";

type EnrichedRecipe = {
  id: string;
  machineId: string;
  machineName: string;
  durationTicks: number;
  inputs: {
    itemId: string;
    amount: number;
    catalyst: boolean;
    itemName: string;
    itemType: "item" | "fluid" | "gas";
  }[];
  outputs: {
    itemId: string;
    amount: number;
    itemName: string;
    itemType: "item" | "fluid" | "gas";
  }[];
};

type RecipePickerModalProps = {
  open: boolean;
  itemId: string | null;
  itemName: string | null;
  requestedAmount: number;
  onSelect: (recipe: EnrichedRecipe, nodeData: Partial<TreeNodeData>) => void;
  onClose: () => void;
};

const typeColors: Record<string, string> = {
  item:  "#555",
  fluid: "#2563eb",
  gas:   "#7c3aed",
};

function TypeDot({ type }: { type: string }) {
  return (
    <div
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: typeColors[type] ?? "#555",
        flexShrink: 0,
      }}
    />
  );
}

function ItemMiniSlot({ itemId, itemName, type }: { itemId: string; itemName: string; type: string }) {
  return (
    <div
      style={{
        width: 26,
        height: 26,
        flexShrink: 0,
        background: "#2a2a2a",
        border: `1.5px solid ${typeColors[type] ?? "#555"}`,
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <IconImage
        itemId={itemId}
        itemName={itemName}
        size={26}
        itemType={type}
        textStyle={{
          color: "#777",
          fontSize: 8,
          fontWeight: 700,
          fontFamily: "monospace",
        }}
      />
    </div>
  );
}

// GTCEu tier sorrend (index = prioritás, kisebb = alacsonyabb tier)
const TIER_ORDER = ["ulv", "lv", "mv", "hv", "ev", "iv", "luv", "zpm", "uv", "uhv"];

function getBaseMachineId(machineId: string): string {
  if (!machineId.startsWith("gtceu:")) return machineId;
  const part = machineId.substring(6);
  for (const tier of TIER_ORDER) {
    if (part.startsWith(tier + "_")) return "gtceu:" + part.substring(tier.length + 1);
  }
  return machineId;
}

function getTierIndex(machineId: string): number {
  if (!machineId.startsWith("gtceu:")) return -1;
  const part = machineId.substring(6);
  for (let i = 0; i < TIER_ORDER.length; i++) {
    if (part.startsWith(TIER_ORDER[i] + "_")) return i;
  }
  return -1;
}

export default function RecipePickerModal({
  open,
  itemId,
  itemName,
  requestedAmount,
  onSelect,
  onClose,
}: RecipePickerModalProps) {
  const [recipes, setRecipes] = useState<EnrichedRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [activeTab, setActiveTab] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId || !open) return;
    setLoading(true);
    setFilter("");
    fetch(`/api/recipes?itemId=${encodeURIComponent(itemId)}`)
      .then((r) => r.json())
      .then((data) => setRecipes(data))
      .finally(() => setLoading(false));
  }, [itemId, open]);

  // #2 fix: base machine szerint csoportosítunk (tier nélkül)
  // Pl. gtceu:lv_centrifuge és gtceu:mv_centrifuge → "gtceu:centrifuge" csoportba kerülnek
  const groupedByBase = recipes.reduce((acc, r) => {
    const base = getBaseMachineId(r.machineId || "unknown");
    if (!acc[base]) acc[base] = [];
    acc[base].push(r);
    return acc;
  }, {} as Record<string, EnrichedRecipe[]>);

  // Minden base-csoportból a legkisebb tier-ű recept az ikon és a gomb reprezentánsa
  const baseMachineKeys = Object.keys(groupedByBase).sort();
  const lowestTierRepresentative = (base: string): EnrichedRecipe => {
    const group = groupedByBase[base];
    return group.reduce((best, r) => {
      const bi = getTierIndex(best.machineId);
      const ri = getTierIndex(r.machineId);
      return ri < bi ? r : best;
    });
  };

  useEffect(() => {
    if (baseMachineKeys.length > 0 && (!activeTab || !baseMachineKeys.includes(activeTab))) {
      setActiveTab(baseMachineKeys[0]);
    }
  }, [baseMachineKeys.join(","), activeTab]);

  const currentTabRecipes = activeTab ? groupedByBase[activeTab] || [] : [];
  
  const filtered = currentTabRecipes.filter(
    (r) =>
      filter === "" ||
      r.machineName.toLowerCase().includes(filter.toLowerCase()) ||
      r.machineId.toLowerCase().includes(filter.toLowerCase()) ||
      r.inputs.some((i) => i.itemName.toLowerCase().includes(filter.toLowerCase())) ||
      r.outputs.some((o) => o.itemName.toLowerCase().includes(filter.toLowerCase()))
  );

  function handleSelect(recipe: EnrichedRecipe) {
    const outputEntry = recipe.outputs.find((o) => o.itemId === itemId);
    const outputAmount = outputEntry?.amount ?? 1;
    const batchMultiplier = requestedAmount / outputAmount;

    const nodeData: Partial<TreeNodeData> = {
      itemId: itemId!,
      itemName: itemName!,
      itemType: outputEntry?.itemType ?? "item",
      recipeId: recipe.id,
      machineId: recipe.machineId,
      machineName: recipe.machineName,
      requestedAmount,
      batchMultiplier,
      inputs: recipe.inputs,
      outputs: recipe.outputs,
      notes: null,
    };
    onSelect(recipe, nodeData);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-lg max-h-[90vh] flex flex-col"
        style={{
          background: "#1e1e1e",
          border: "1px solid #2d2d2d",
          color: "#e5e5e5",
          fontFamily: "var(--font-geist-mono, monospace)",
        }}
      >
        {/* Fejléc – fix, nem shrinkelhető */}
        <div style={{ flexShrink: 0 }}>
          <DialogHeader>
            <DialogTitle
              style={{ color: "#e5e5e5", fontSize: 13, fontWeight: 700, letterSpacing: "0.02em" }}
            >
              Select Recipe
            </DialogTitle>
            <DialogDescription style={{ color: "#555", fontSize: 10 }}>
              <span style={{ color: "#34d399", fontWeight: 700 }}>{itemName ?? itemId}</span>
              {"  "}·{"  "}
              ×{formatAmount(requestedAmount)} requested
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Gépválasztó tab sor – fix magasság, soha nem shrinkelhető */}
        {baseMachineKeys.length > 0 && (
          <div style={{
            flexShrink: 0,
            display: "flex",
            gap: 8,
            overflowX: "auto",
            overflowY: "hidden",
            height: 56,
            alignItems: "flex-start",
            paddingTop: 2,
            borderBottom: "1px solid #2d2d2d",
            marginBottom: 8,
            scrollbarWidth: "thin",
            scrollbarColor: "#3a3a3a #1a1a1a",
          }}>
            {baseMachineKeys.map(base => {
              const rep = lowestTierRepresentative(base);
              const isActive = activeTab === base;
              const count = groupedByBase[base].length;
              return (
                <button
                  key={base}
                  onClick={() => setActiveTab(base)}
                  data-tooltip={`${rep.machineName}${count > 1 ? ` (+${count - 1} tier)` : ""}`}
                  style={{
                    width: 36,
                    height: 36,
                    flexShrink: 0,
                    background: isActive ? "#262626" : "#1a1a1a",
                    border: `1.5px solid ${isActive ? "#34d399" : "#3a3a3a"}`,
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    opacity: isActive ? 1 : 0.6,
                    position: "relative",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.opacity = "1";
                      e.currentTarget.style.borderColor = "#555";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.opacity = "0.6";
                      e.currentTarget.style.borderColor = "#3a3a3a";
                    }
                  }}
                >
                  <IconImage
                    itemId={rep.machineId || ""}
                    itemName={rep.machineName}
                    size={34}
                    textStyle={{ color: "#888", fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}
                  />
                  {/* Több tier jelvény */}
                  {count > 1 && (
                    <div style={{
                      position: "absolute", bottom: 0, right: 0,
                      background: "#34d399", color: "#000",
                      fontSize: 6, fontWeight: 900, lineHeight: 1,
                      padding: "1px 2px", borderRadius: "3px 0 4px 0",
                    }}>{count}</div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Kereső – fix, nem shrinkelhető */}
        {recipes.length > 1 && (
          <div style={{ flexShrink: 0, marginBottom: 6 }}>
            <input
              placeholder="Filter recipes in this tab..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                background: "#262626",
                border: "1px solid #3a3a3a",
                borderRadius: 6,
                color: "#e5e5e5",
                fontSize: 11,
                padding: "6px 10px",
                fontFamily: "inherit",
                outline: "none",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
          </div>
        )}

        <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {loading && (
            <div style={{ textAlign: "center", color: "#444", padding: "32px 0", fontSize: 11 }}>
              Loading recipes...
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: "center", color: "#444", padding: "32px 0" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 10, marginBottom: 12 }}>No recipes found</div>
              <button
                onClick={() => {
                  const nodeData: Partial<TreeNodeData> = {
                    itemId: itemId!, itemName: itemName!, itemType: "item",
                    recipeId: null, machineId: null, machineName: null,
                    requestedAmount, batchMultiplier: 1, inputs: [], outputs: [], notes: null,
                  };
                  onSelect({} as EnrichedRecipe, nodeData);
                  onClose();
                }}
                style={{
                  background: "rgba(161,98,7,0.1)",
                  border: "1px solid rgba(161,98,7,0.3)",
                  borderRadius: 6,
                  color: "#d97706",
                  padding: "7px 14px",
                  fontSize: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  letterSpacing: "0.05em",
                }}
              >
                ⛏ Add as Raw Material
              </button>
            </div>
          )}

          {!loading &&
            filtered.map((recipe) => {
              const outputEntry = recipe.outputs.find((o) => o.itemId === itemId);
              const outputAmount = outputEntry?.amount ?? 1;
              const batchMultiplier = requestedAmount / outputAmount;
              const durationSec = (recipe.durationTicks / 20).toFixed(1);

              return (
                <button
                  key={recipe.id}
                  onClick={() => handleSelect(recipe)}
                  style={{
                    textAlign: "left",
                    background: "#262626",
                    border: "1px solid #3a3a3a",
                    borderRadius: 8,
                    padding: "10px 12px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                    color: "inherit",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#2d2d2d";
                    e.currentTarget.style.borderColor = "#34d399";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#262626";
                    e.currentTarget.style.borderColor = "#3a3a3a";
                  }}
                >
                  {/* Machine header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {/* Gép ikon keret nélkül */}
                      <IconImage 
                        itemId={recipe.machineId || ""} 
                        itemName={recipe.machineName || "M"} 
                        size={36} 
                        textStyle={{ color: "#a8a29e", fontSize: 13, fontWeight: 700, fontFamily: "monospace" }} 
                      />
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ color: "#e5e5e5", fontWeight: 700, fontSize: 12 }}>
                          {recipe.machineName}
                        </span>
                        <span style={{ color: "#444", fontSize: 9 }}>
                          {recipe.machineId}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      <span
                        style={{
                          background: "#2a2a2a",
                          border: "1px solid #3a3a3a",
                          borderRadius: 4,
                          color: "#555",
                          fontSize: 9,
                          padding: "2px 6px",
                        }}
                      >
                        ⏱ {durationSec}s
                      </span>
                      <span
                        style={{
                          background: "rgba(52,211,153,0.08)",
                          border: "1px solid rgba(52,211,153,0.2)",
                          borderRadius: 4,
                          color: "#34d399",
                          fontSize: 9,
                          padding: "2px 6px",
                          fontWeight: 700,
                        }}
                      >
                        ×{formatAmount(batchMultiplier)} batch
                      </span>
                    </div>
                  </div>

                  {/* Inputs */}
                  <div style={{ marginBottom: 6 }}>
                    <div
                      style={{
                        fontSize: 8,
                        color: "#444",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        marginBottom: 4,
                        fontWeight: 600,
                      }}
                    >
                      Inputs
                    </div>
                    {recipe.inputs.map((inp, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 3,
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <ItemMiniSlot itemId={inp.itemId} itemName={inp.itemName} type={inp.itemType} />
                          <span style={{ color: "#aaa", fontSize: 10 }}>{inp.itemName}</span>
                          {inp.catalyst && (
                            <span
                              style={{
                                fontSize: 8,
                                color: "#c2410c",
                                background: "rgba(194,65,12,0.1)",
                                border: "1px solid rgba(194,65,12,0.25)",
                                borderRadius: 3,
                                padding: "0 3px",
                                textTransform: "uppercase",
                              }}
                            >
                              cat
                            </span>
                          )}
                        </div>
                        <span style={{ color: inp.catalyst ? "#fb923c" : "#666", fontSize: 11, fontWeight: 700 }}>
                          {inp.itemId === "gtceu:programmed_circuit"
                            ? `Conf ${inp.amount}`
                            : <>×{formatAmount(inp.catalyst ? inp.amount : inp.amount * batchMultiplier)}{(inp.itemType === "fluid" || inp.itemType === "gas") && <span style={{ fontSize: 8, opacity: 0.65, marginLeft: 2 }}>(mB)</span>}</>}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Outputs (if multiple) */}
                  {recipe.outputs.length > 1 && (
                    <div style={{ borderTop: "1px solid #2a2a2a", paddingTop: 6, marginTop: 4 }}>
                      <div
                        style={{
                          fontSize: 8,
                          color: "#444",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          marginBottom: 4,
                          fontWeight: 600,
                        }}
                      >
                        Outputs
                      </div>
                      {recipe.outputs.map((out, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 3,
                            gap: 8,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <ItemMiniSlot itemId={out.itemId} itemName={out.itemName} type={out.itemType} />
                            <span
                              style={{
                                color: out.itemId === itemId ? "#34d399" : "#888",
                                fontSize: 10,
                                fontWeight: out.itemId === itemId ? 700 : 400,
                              }}
                            >
                              {out.itemName}
                            </span>
                          </div>
                          <span style={{ color: "#666", fontSize: 11, fontWeight: 700 }}>
                            ×{formatAmount(out.amount * batchMultiplier)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
