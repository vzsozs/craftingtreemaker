import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { items, recipes } from "@/db/schema";
import { inArray, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const itemId = req.nextUrl.searchParams.get("itemId");

  if (!itemId) {
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  }

  // H-02 FIX: SQL-szintű JSONB szűrés az outputs mezőn,
  // ahelyett hogy az egész táblát memóriába töltenénk JS szűréssel.
  const matching = await db
    .select()
    .from(recipes)
    .where(sql`outputs @> ${JSON.stringify([{ itemId }])}::jsonb`);

  if (matching.length === 0) {
    return NextResponse.json([]);
  }

  // H-03 FIX: Összegyűjtjük az összes szükséges item ID-t EGY lekérésbe,
  // ahelyett hogy recept-enként az egész items táblát töltenénk be.
  const allInputIds = matching.flatMap((r) => r.inputs.map((i) => i.itemId));
  const allOutputIds = matching.flatMap((r) => r.outputs.map((o) => o.itemId));
  const allIds = [...new Set([...allInputIds, ...allOutputIds])];

  const itemDetails = await db
    .select()
    .from(items)
    .where(inArray(items.id, allIds));

  const itemMap = new Map(itemDetails.map((i) => [i.id, i]));

  const enriched = matching.map((recipe) => ({
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
  }));

  return NextResponse.json(enriched);
}
