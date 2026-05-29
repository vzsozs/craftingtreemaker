import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { items } from "@/db/schema";
import { ilike, or, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("q") ?? "";

  const results = await db
    .select()
    .from(items)
    .where(
      or(
        ilike(items.name, `%${search}%`),
        ilike(items.id, `%${search}%`)
      )
    )
    .orderBy(asc(items.name))
    .limit(100);

  return NextResponse.json(results);
}
