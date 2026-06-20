import { NextResponse } from "next/server";
import { db } from "@/db";
import { items, recipes } from "@/db/schema";
import { count } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [{ value: recipesCount }] = await db.select({ value: count() }).from(recipes);
    const [{ value: itemsCount }] = await db.select({ value: count() }).from(items);

    return NextResponse.json({
      recipesCount,
      itemsCount,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch database stats" },
      { status: 500 }
    );
  }
}
