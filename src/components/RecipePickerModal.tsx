"use client";

import { useState, useEffect, useMemo } from "react";
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
  itemType?: "item" | "fluid" | "gas";
  requestedAmount: number;
  onSelect: (recipe: EnrichedRecipe, nodeData: Partial<TreeNodeData>) => void;
  onClose: () => void;
};

const typeColors: Record<string, string> = {
  item:  "#555",
  fluid: "#2563eb",
  gas:   "#7c3aed",
};


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
  itemType = "item",
  requestedAmount,
  onSelect,
  onClose,
}: RecipePickerModalProps) {
  const [recipes, setRecipes] = useState<EnrichedRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Tag resolution and item substitution state
  const [localItemId, setLocalItemId] = useState<string | null>(null);
  const [localItemName, setLocalItemName] = useState<string | null>(null);
  const [resolvedTagItems, setResolvedTagItems] = useState<any[]>([]);
  const [tagLoading, setTagLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingGlobal, setSearchingGlobal] = useState(false);

  // Sync props to local state on open or change
  useEffect(() => {
    setLocalItemId(itemId);
    setLocalItemName(itemName);
    setResolvedTagItems([]);
    setSearchQuery("");
    setSearchResults([]);
  }, [itemId, itemName, open]);

  // Global database search debounce
  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }
    const delayDebounce = setTimeout(() => {
      setSearchingGlobal(true);
      fetch(`/api/items?q=${encodeURIComponent(searchQuery)}`)
        .then((r) => r.json())
        .then((data) => setSearchResults(data))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchingGlobal(false));
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Fetch recipes or resolve tag based on localItemId
  useEffect(() => {
    if (!localItemId || !open) return;

    if (localItemId.startsWith("#")) {
      setRecipes([]);
      setTagLoading(true);
      fetch(`/api/tags/resolve?tagId=${encodeURIComponent(localItemId)}&type=${itemType}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data) && data.length === 1) {
            setLocalItemId(data[0].id);
            setLocalItemName(data[0].name);
          } else {
            setResolvedTagItems(data || []);
          }
        })
        .catch(() => setResolvedTagItems([]))
        .finally(() => setTagLoading(false));
      return;
    }

    requestAnimationFrame(() => {
      setLoading(true);
      setFilter("");
    });
    fetch(`/api/recipes?itemId=${encodeURIComponent(localItemId)}`)
      .then((r) => r.json())
      .then((data) => setRecipes(data))
      .catch(() => setRecipes([]))
      .finally(() => {
        requestAnimationFrame(() => setLoading(false));
      });
  }, [localItemId, open, itemType]);

  // #2 fix: base machine szerint csoportosítunk (tier nélkül)
  // Pl. gtceu:lv_centrifuge és gtceu:mv_centrifuge → "gtceu:centrifuge" csoportba kerülnek
  const groupedByBase = useMemo(() => {
    return recipes.reduce((acc, r) => {
      const base = getBaseMachineId(r.machineId || "unknown");
      if (!acc[base]) acc[base] = [];
      acc[base].push(r);
      return acc;
    }, {} as Record<string, EnrichedRecipe[]>);
  }, [recipes]);

  // Minden base-csoportból a legkisebb tier-ű recept az ikon és a gomb reprezentánsa
  const baseMachineKeys = useMemo(() => {
    return Object.keys(groupedByBase).sort();
  }, [groupedByBase]);

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
      requestAnimationFrame(() => {
        setActiveTab(baseMachineKeys[0]);
      });
    }
  }, [baseMachineKeys, activeTab]);

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
    const outputEntry = recipe.outputs.find((o) => o.itemId === localItemId);
    const outputAmount = outputEntry?.amount ?? 1;
    const batchMultiplier = requestedAmount / outputAmount;

    const nodeData: Partial<TreeNodeData> = {
      itemId: localItemId!,
      itemName: localItemName!,
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
            <div className="text-sm text-muted-foreground" style={{ color: "#555", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <span style={{ color: "#34d399", fontWeight: 700 }}>{localItemName ?? localItemId}</span>
                {"  "}·{"  "}
                ×{formatAmount(requestedAmount)} requested
              </div>
              {itemId && itemId.startsWith("#") && localItemId !== itemId && (
                <button
                  onClick={() => {
                    setLocalItemId(itemId);
                    setLocalItemName(itemName);
                  }}
                  style={{
                    background: "rgba(59,130,246,0.1)",
                    border: "1px solid rgba(59,130,246,0.25)",
                    borderRadius: 4,
                    color: "#60a5fa",
                    fontSize: 8,
                    padding: "2px 6px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: 700,
                  }}
                >
                  ↩ Back to Tag
                </button>
              )}
            </div>
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
          {/* Tag resolution interface */}
          {localItemId && localItemId.startsWith("#") && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0" }}>
              <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 10, color: "#93c5fd", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  Tag Ingredient Detected
                </div>
                <div style={{ fontSize: 11, color: "#ccc", wordBreak: "break-all" }}>
                  This requires any item matching the tag: <code style={{ color: "#60a5fa", fontWeight: 700, fontFamily: "monospace" }}>{localItemId}</code>
                </div>
              </div>

              {/* Tag items list */}
              <div>
                <div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                  Select variations to craft:
                </div>

                {tagLoading && (
                  <div style={{ fontSize: 10, color: "#666", padding: "16px 0", textAlign: "center" }}>
                    Resolving items for tag...
                  </div>
                )}

                {!tagLoading && resolvedTagItems.length === 0 && (
                  <div style={{ fontSize: 10, color: "#e11d48", padding: "8px 12px", background: "rgba(225,29,72,0.05)", border: "1px solid rgba(225,29,72,0.15)", borderRadius: 6, marginBottom: 8 }}>
                    Could not automatically resolve any items under this tag. Please search database below to manually select an item.
                  </div>
                )}

                {!tagLoading && resolvedTagItems.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, maxHeight: 180, overflowY: "auto", paddingRight: 4, scrollbarWidth: "thin" }}>
                    {resolvedTagItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setLocalItemId(item.id);
                          setLocalItemName(item.name);
                        }}
                        style={{
                          textAlign: "left",
                          padding: "8px 10px",
                          background: "#262626",
                          border: "1px solid #3a3a3a",
                          borderRadius: 6,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontFamily: "inherit",
                          transition: "all 0.12s",
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
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            flexShrink: 0,
                            background: "#1a1a1a",
                            border: `1px solid ${item.type === "fluid" ? "#2563eb" : "#3a3a3a"}`,
                            borderRadius: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <IconImage itemId={item.id} itemName={item.name} size={24} itemType={item.type} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ color: "#e5e5e5", fontSize: 10, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.name}
                          </div>
                          <div style={{ color: "#444", fontSize: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.id}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>



              {/* Add raw material button */}
              <div style={{ borderTop: "1px solid #2d2d2d", paddingTop: 10, display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    const nodeData: Partial<TreeNodeData> = {
                      itemId: localItemId!, itemName: localItemName!, itemType: "item",
                      recipeId: null, machineId: null, machineName: null,
                      requestedAmount, batchMultiplier: 1, inputs: [], outputs: [], notes: null,
                    };
                    onSelect({} as EnrichedRecipe, nodeData);
                    onClose();
                  }}
                  style={{
                    background: "rgba(161,98,7,0.08)",
                    border: "1px solid rgba(161,98,7,0.25)",
                    borderRadius: 6,
                    color: "#d97706",
                    padding: "6px 12px",
                    fontSize: 9,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                  }}
                >
                  ⛏ Add tag as raw material
                </button>
              </div>
            </div>
          )}

          {!localItemId?.startsWith("#") && loading && (
            <div style={{ textAlign: "center", color: "#444", padding: "32px 0", fontSize: 11 }}>
              Loading recipes...
            </div>
          )}

          {!localItemId?.startsWith("#") && !loading && filtered.length === 0 && (
            <div style={{ textAlign: "center", color: "#444", padding: "32px 0" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 10, marginBottom: 12 }}>No recipes found</div>
              <button
                onClick={() => {
                  const nodeData: Partial<TreeNodeData> = {
                    itemId: localItemId!, itemName: localItemName!, itemType: "item",
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

          {!localItemId?.startsWith("#") && !loading &&
            filtered.map((recipe) => {
              const outputEntry = recipe.outputs.find((o) => o.itemId === localItemId);
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
                                color: out.itemId === localItemId ? "#34d399" : "#888",
                                fontSize: 10,
                                fontWeight: out.itemId === localItemId ? 700 : 400,
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
