import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { db } from "@/db";
import { items } from "@/db/schema";
import { inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

const dumpsDir = path.join(process.cwd(), "src/db/dumps/kubejs");
const tagsDir = path.join(dumpsDir, "tags/minecraft/item");
const fluidTagsDir = path.join(dumpsDir, "tags/minecraft/fluid");

function resolveTagRecursive(tagId: string, type: "item" | "fluid" = "item", visited = new Set<string>()): string[] {
  const normalized = tagId.startsWith("#") ? tagId.substring(1) : tagId;
  if (visited.has(normalized)) return [];
  visited.add(normalized);

  const parts = normalized.split(":");
  if (parts.length < 2) return [];
  const namespace = parts[0];
  const tagPath = parts[1];

  const baseDir = type === "fluid" ? fluidTagsDir : tagsDir;
  const jsonPath = path.join(baseDir, namespace, `${tagPath}.json`);

  if (!fs.existsSync(jsonPath)) {
    return [];
  }

  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    if (Array.isArray(data)) {
      const results: string[] = [];
      for (const entry of data) {
        if (entry.startsWith("#")) {
          results.push(...resolveTagRecursive(entry, type, visited));
        } else {
          results.push(entry);
        }
      }
      return results;
    }
  } catch (e) {
    console.error(`Error parsing tag file ${jsonPath}:`, e);
  }
  return [];
}

export async function GET(req: NextRequest) {
  const tagId = req.nextUrl.searchParams.get("tagId");
  const type = (req.nextUrl.searchParams.get("type") ?? "item") as "item" | "fluid";

  if (!tagId) {
    return NextResponse.json({ error: "tagId required" }, { status: 400 });
  }

  const resolvedIds = resolveTagRecursive(tagId, type);
  
  if (resolvedIds.length === 0) {
    return NextResponse.json([]);
  }

  const uniqueIds = Array.from(new Set(resolvedIds)).slice(0, 100);
  
  if (uniqueIds.length === 0) {
    return NextResponse.json([]);
  }

  const dbItems = await db
    .select()
    .from(items)
    .where(inArray(items.id, uniqueIds));

  // Rendezzük név szerint az eredményeket a szebb UI érdekében
  dbItems.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(dbItems);
}
