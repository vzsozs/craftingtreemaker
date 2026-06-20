import type { RecipeIngredient, RecipeOutput } from "@/db/schema";

export type TreeNodeData = {
  id: string;
  itemId: string;
  itemName: string;
  itemType: "item" | "fluid" | "gas";
  recipeId: string | null;
  machineId: string | null;
  machineName: string | null;
  requestedAmount: number;
  batchMultiplier: number;
  inputs: (RecipeIngredient & { itemName: string; itemType: "item" | "fluid" | "gas" })[];
  outputs: (RecipeOutput & { itemName: string; itemType: "item" | "fluid" | "gas" })[];
  notes: string | null;
  isRoot?: boolean;
  isLockedRaw?: boolean; // Manual toggle to lock as in-stock raw material
};

/**
 * Calculate the batch multiplier for a node given:
 *  - parentRequestedAmount: how many of this item the parent needs
 *  - recipeOutputAmount: how many this recipe produces per run
 */
export function calcBatchMultiplier(
  parentRequestedAmount: number,
  recipeOutputAmount: number
): number {
  return parentRequestedAmount / recipeOutputAmount;
}

/**
 * Calculate the required input amount for an ingredient.
 * If catalyst=true, the ingredient is not multiplied (it never gets consumed).
 */
export function calcInputAmount(
  ingredient: RecipeIngredient,
  batchMultiplier: number
): number {
  if (ingredient.catalyst) {
    return ingredient.amount; // fixed, non-consumable
  }
  return ingredient.amount * batchMultiplier;
}

/**
 * Edge color based on item type (halmazállapot).
 */
export const EDGE_COLORS: Record<"item" | "fluid" | "gas", string> = {
  item:  "#6B7280", // dark gray  – solid
  fluid: "#3B82F6", // blue       – liquid
  gas:   "#8B5CF6", // purple     – gas
};

export function getEdgeColor(type: "item" | "fluid" | "gas"): string {
  return EDGE_COLORS[type] ?? EDGE_COLORS.item;
}

/**
 * Build a shopping list from the tree nodes.
 * Returns raw materials (leaf nodes with no recipe or locked raw materials) and catalysts.
 */
export type ShoppingListEntry = {
  itemId: string;
  itemName: string;
  itemType: "item" | "fluid" | "gas";
  amount: number;
  isCatalyst: boolean;
};

export function buildShoppingList(
  nodes: TreeNodeData[],
  edges?: { source: string; target: string; targetHandle?: string | null }[]
): {
  rawMaterials: ShoppingListEntry[];
  catalysts: ShoppingListEntry[];
} {
  const rawMap = new Map<string, ShoppingListEntry>();
  const catalystMap = new Map<string, ShoppingListEntry>();

  // Build a set of "connected input handles" from edges: "nodeId|itemId" → true
  const connectedInputs = new Set<string>();
  if (edges) {
    for (const edge of edges) {
      if (edge.targetHandle?.startsWith("input-")) {
        const inputItemId = edge.targetHandle.replace("input-", "");
        connectedInputs.add(`${edge.target}|${inputItemId}`);
      }
    }
  }

  // Build a node lookup map
  const nodeMap = new Map<string, TreeNodeData>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  for (const node of nodes) {
    // If a node is inactive, skip it
    if (node.requestedAmount <= 0) continue;

    // Leaf node (no recipe chosen) OR manually locked as raw material
    if (!node.recipeId || node.isLockedRaw) {
      const existing = rawMap.get(node.itemId);
      if (existing) {
        existing.amount += node.requestedAmount;
      } else {
        rawMap.set(node.itemId, {
          itemId: node.itemId,
          itemName: node.itemName,
          itemType: node.itemType,
          amount: node.requestedAmount,
          isCatalyst: false,
        });
      }
    }

    // If this node has a recipe and is not locked, check each non-catalyst input:
    // if there is no child node connected to that input slot, it counts as a raw material
    if (node.recipeId && !node.isLockedRaw && edges) {
      for (const input of node.inputs) {
        if (input.catalyst) continue; // catalysts handled separately below
        const key = `${node.id}|${input.itemId}`;
        if (!connectedInputs.has(key)) {
          // This input has no child node attached → treat as raw material
          const requiredAmount = input.amount * node.batchMultiplier;
          if (requiredAmount <= 0) continue;
          const existing = rawMap.get(input.itemId);
          if (existing) {
            existing.amount += requiredAmount;
          } else {
            rawMap.set(input.itemId, {
              itemId: input.itemId,
              itemName: input.itemName,
              itemType: input.itemType,
              amount: requiredAmount,
              isCatalyst: false,
            });
          }
        }
      }
    }

    // Collect catalysts from recipe inputs - ONLY if node is active and NOT locked as raw!
    if (!node.isLockedRaw) {
      for (const input of node.inputs) {
        if (input.catalyst) {
          const existing = catalystMap.get(input.itemId);
          if (existing) {
            existing.amount = Math.max(existing.amount, input.amount);
          } else {
            catalystMap.set(input.itemId, {
              itemId: input.itemId,
              itemName: input.itemName,
              itemType: input.itemType,
              amount: input.amount,
              isCatalyst: true,
            });
          }
        }
      }
    }
  }

  return {
    rawMaterials: Array.from(rawMap.values()),
    catalysts: Array.from(catalystMap.values()),
  };
}

/**
 * Format amount for display: trim unnecessary decimals.
 */
export function formatAmount(amount: number): string {
  if (Number.isInteger(amount)) return amount.toString();
  return amount.toFixed(2).replace(/\.?0+$/, "");
}
