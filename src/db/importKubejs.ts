import fs from "fs";
import path from "path";
import crypto from "crypto";
import { db } from "./index";
import { items, recipes } from "./schema";
import "dotenv/config";

const dumpsDir = path.join(process.cwd(), "src/db/dumps/kubejs");
const tagsDir = path.join(dumpsDir, "tags/minecraft/item");
const fluidTagsDir = path.join(dumpsDir, "tags/minecraft/fluid");

const tagCache = new Map<string, string[]>();
const outputToRecipeMap = new Map<string, string[]>();

function toHumanReadable(id: string): string {
  const parts = id.split(":");
  const name = parts[parts.length - 1];
  return name.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function resolveTag(tag: string, type: "item" | "fluid" = "item"): string | null {
  if (tagCache.has(tag)) {
    const cached = tagCache.get(tag);
    return cached && cached.length > 0 ? cached[0] : null;
  }

  const parts = tag.split(":");
  if (parts.length < 2) return null;
  const namespace = parts[0];
  const tagPath = parts[1];

  const baseDir = type === "item" ? tagsDir : fluidTagsDir;
  const jsonPath = path.join(baseDir, namespace, `${tagPath}.json`);

  if (fs.existsSync(jsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      if (Array.isArray(data)) {
        tagCache.set(tag, data);
        const gtceu = data.find(id => id.startsWith("gtceu:"));
        return gtceu || data[0];
      }
    } catch (e) {}
  }
  return null;
}

const parseOutput = (outData: any, isFluid: boolean) => {
    let itemId = null;
    let amount = isFluid ? outData.content?.amount || 1000 : outData.content?.count || 1;
    
    itemId = isFluid ? outData.content?.fluid || outData.fluid : outData.content?.item || outData.item;
    
    if (!itemId && !isFluid) {
        const ing = outData.content?.ingredient;
        if (ing?.item) itemId = ing.item;
        else if (ing?.tag) itemId = resolveTag(ing.tag, "item");
    }

    if (!itemId) {
       if (outData.content?.value && outData.content?.value[0]) {
           itemId = isFluid ? outData.content.value[0].fluid : outData.content.value[0].item;
       }
    }
    return { itemId, amount };
};

const itemsToInsert = new Map<string, { id: string, name: string, type: "item"|"fluid", modId: string }>();
const recipesToInsert: any[] = [];

function parseRecipeFile(filePath: string) {

  const content = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(content);

  const relPath = path.relative(dumpsDir, filePath).replace(/\\/g, '/');
  const recipeId = "rec_" + crypto.createHash('md5').update(relPath).digest('hex').substring(0, 16);
  let type = data.type; 
  
  if (!type) return;

  let euPerTick = 0;
  if (data.tickInputs && data.tickInputs.eu && data.tickInputs.eu[0]) {
      euPerTick = data.tickInputs.eu[0].content || 0;
  }
  
  if (type.startsWith("gtceu:") && euPerTick > 0) {
      let tier = "lv";
      if (euPerTick > 8) tier = "lv";
      if (euPerTick > 32) tier = "mv";
      if (euPerTick > 128) tier = "hv";
      if (euPerTick > 512) tier = "ev";
      if (euPerTick > 2048) tier = "iv";
      if (euPerTick > 8192) tier = "luv";
      if (euPerTick > 32768) tier = "zpm";
      if (euPerTick > 131072) tier = "uv";
      if (euPerTick > 524288) tier = "uhv";
      
      const machineName = type.substring(6);
      type = `gtceu:${tier}_${machineName}`;
  } else if (type === "minecraft:crafting_shaped" || type === "minecraft:crafting_shapeless") {
      type = "minecraft:crafting_table";
  }

  let machineId = type.split(":")[1] || type;

  const duration = data.duration || 100;
  const isRemoved = filePath.includes("removed_recipes") || data.type === "recipe_hint";
  if (isRemoved) return;

  const recInputs: any[] = [];
  const recOutputs: any[] = [];

  const parseIngredient = (ingData: any, isFluid: boolean) => {
     let itemId = null;
     let amount = isFluid ? ingData.content?.amount || 1000 : ingData.content?.count || 1;
     let isCatalyst = ingData.chance === 0;

     if (isFluid) {
        itemId = ingData.content?.value?.[0]?.fluid;
     } else {
        const ing = ingData.content?.ingredient;
        if (ing?.item) itemId = ing.item;
        else if (ing?.tag) {
           itemId = resolveTag(ing.tag, "item");
        } else if (ing?.type === "gtceu:circuit") {
           itemId = `gtceu:programmed_circuit`;
           isCatalyst = true;
           amount = ing.configuration || 1;
        } else if (ing?.type === "forge:nbt" && ing.item) {
           itemId = ing.item;
        }
     }

     if (itemId) {
        const modId = itemId.includes(':') ? itemId.split(':')[0] : 'minecraft';
        if (!itemsToInsert.has(itemId)) {
           itemsToInsert.set(itemId, { id: itemId, name: toHumanReadable(itemId), type: isFluid ? "fluid" : "item", modId });
        }
        
        recInputs.push({ itemId, amount, catalyst: isCatalyst });
     }
  };

  if (data.inputs?.item) data.inputs.item.forEach((i: any) => parseIngredient(i, false));
  if (data.inputs?.fluid) data.inputs.fluid.forEach((f: any) => parseIngredient(f, true));

  if (data.type === "minecraft:crafting_shaped") {
      const counts: Record<string, number> = {};
      if (data.pattern) {
          data.pattern.forEach((row: string) => {
              for (const char of row) {
                  if (char !== ' ') {
                      counts[char] = (counts[char] || 0) + 1;
                  }
              }
          });
      }
      if (data.key) {
          for (const [k, ingData] of Object.entries(data.key)) {
              const amount = counts[k] || 1;
              const ing: any = Array.isArray(ingData) ? ingData[0] : ingData;
              let itemId = ing.item || (ing.tag ? resolveTag(ing.tag, "item") : null);
              if (itemId) {
                  const modId = itemId.includes(':') ? itemId.split(':')[0] : 'minecraft';
                  if (!itemsToInsert.has(itemId)) {
                     itemsToInsert.set(itemId, { id: itemId, name: toHumanReadable(itemId), type: "item", modId });
                  }
                  
                  const isTool = itemId.includes("tool") || itemId.includes("hammer") || itemId.includes("wrench") || itemId.includes("file") || itemId.includes("saw") || itemId.includes("screwdriver") || itemId.includes("cutter") || itemId.includes("mortar");
                  recInputs.push({ itemId, amount, catalyst: isTool });
              }
          }
      }
  }

  if (data.ingredients) {
      data.ingredients.forEach((ing: any) => {
         let itemId = ing.item || (ing.tag ? resolveTag(ing.tag, "item") : null);
         if (itemId) {
            const modId = itemId.includes(':') ? itemId.split(':')[0] : 'minecraft';
            if (!itemsToInsert.has(itemId)) itemsToInsert.set(itemId, { id: itemId, name: toHumanReadable(itemId), type: "item", modId });
          recInputs.push({ itemId, amount: 1, catalyst: false });
      }
  });
}

  const handleParsedOutput = (outEntry: any, isFluid: boolean) => {
      if (outEntry && outEntry.itemId) {
          const modId = outEntry.itemId.includes(':') ? outEntry.itemId.split(':')[0] : 'minecraft';
          if (!itemsToInsert.has(outEntry.itemId)) itemsToInsert.set(outEntry.itemId, { id: outEntry.itemId, name: toHumanReadable(outEntry.itemId), type: isFluid ? "fluid" : "item", modId });
          recOutputs.push({ itemId: outEntry.itemId, amount: outEntry.amount });
      }
  };

  if (data.outputs?.item) data.outputs.item.forEach((i: any) => handleParsedOutput(parseOutput(i, false), false));
  if (data.outputs?.fluid) data.outputs.fluid.forEach((f: any) => handleParsedOutput(parseOutput(f, true), true));

  if (data.result) {
      let itemId = typeof data.result === 'string' ? data.result : data.result.item;
      let amount = data.result.count || 1;
      if (itemId) {
         const modId = itemId.includes(':') ? itemId.split(':')[0] : 'minecraft';
         if (!itemsToInsert.has(itemId)) itemsToInsert.set(itemId, { id: itemId, name: toHumanReadable(itemId), type: "item", modId });
         recOutputs.push({ itemId, amount });
      }
  }

  recipesToInsert.push({
    id: recipeId,
    machineId: type,
    machineName: toHumanReadable(machineId),
    durationTicks: duration,
    inputs: recInputs,
    outputs: recOutputs,
  });
}

async function main() {
  console.log("Clearing old data...");
  await db.delete(recipes);
  await db.delete(items);

  console.log("Scanning and parsing all recipe files...");
  let count = 0;
  
  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const f of files) {
      const fullPath = path.join(dir, f.name);
      if (f.isDirectory()) {
        scanDir(fullPath);
      } else if (f.name.endsWith(".json")) {
        try {
          parseRecipeFile(fullPath);
          count++;
          if (count % 10000 === 0) console.log(`Parsed ${count} files...`);
        } catch (e) {}
      }
    }
  }

  scanDir(path.join(dumpsDir, "added_recipes"));
  scanDir(path.join(dumpsDir, "recipes"));

  console.log(`Finished parsing. Found ${recipesToInsert.length} valid recipes and ${itemsToInsert.size} unique items.`);
  
  console.log("Inserting items to DB...");
  const itemsArr = Array.from(itemsToInsert.values());
  if (itemsArr.length > 0) {
      for (let i = 0; i < itemsArr.length; i += 1000) {
          await db.insert(items).values(itemsArr.slice(i, i + 1000)).onConflictDoNothing();
      }
  }
  
  console.log("Inserting recipes to DB...");
  if (recipesToInsert.length > 0) {
      for (let i = 0; i < recipesToInsert.length; i += 1000) {
          await db.insert(recipes).values(recipesToInsert.slice(i, i + 1000)).onConflictDoNothing();
      }
  }

  console.log("Done! Inserted the full database successfully.");
  process.exit(0);
}

main().catch(console.error);
