import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { items, recipes } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
  const itemId = req.nextUrl.searchParams.get("itemId");

  if (!itemId) {
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  }

  // Find all recipes that produce the requested item
  const allRecipes = await db.select().from(recipes);

  const matching = allRecipes.filter((r) =>
    r.outputs.some((o) => o.itemId === itemId)
  );

  // Enrich with item names for inputs/outputs
  const enriched = await Promise.all(
    matching.map(async (recipe) => {
      const inputIds = recipe.inputs.map((i) => i.itemId);
      const outputIds = recipe.outputs.map((o) => o.itemId);
      const allIds = [...new Set([...inputIds, ...outputIds])];

      const itemDetails = await db
        .select()
        .from(items)
        .then((rows) => rows.filter((r) => allIds.includes(r.id)));

      const itemMap = new Map(itemDetails.map((i) => [i.id, i]));

      return {
        ...recipe,
        inputs: recipe.inputs.map((inp) => ({
          ...inp,
          itemName: itemMap.get(inp.itemId)?.name ?? inp.itemId,
          itemType: itemMap.get(inp.itemId)?.type ?? "item",
        })),
        outputs: recipe.outputs.map((out) => ({
          ...out,
          itemName: itemMap.get(out.itemId)?.name ?? out.itemId,
          itemType: itemMap.get(out.itemId)?.type ?? "item",
        })),
      };
    })
  );

  return NextResponse.json(enriched);
}
