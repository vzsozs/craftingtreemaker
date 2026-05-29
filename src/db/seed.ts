/**
 * Seed script: inserts test data (GregTech-style recipes) into the database.
 * Run with: npx tsx src/db/seed.ts
 */

import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function main() {
  console.log("🌱 Seeding database...");

  // ── Items ────────────────────────────────────────────────────
  await db.insert(schema.items).values([
    // Raw materials
    { id: "minecraft:iron_ore",      name: "Iron Ore",        modId: "minecraft",  type: "item" },
    { id: "minecraft:coal",          name: "Coal",            modId: "minecraft",  type: "item" },
    { id: "minecraft:copper_ore",    name: "Copper Ore",      modId: "minecraft",  type: "item" },
    { id: "minecraft:tin_ore",       name: "Tin Ore",         modId: "minecraft",  type: "item" },
    { id: "minecraft:sand",          name: "Sand",            modId: "minecraft",  type: "item" },
    { id: "minecraft:gravel",        name: "Gravel",          modId: "minecraft",  type: "item" },
    { id: "minecraft:flint",         name: "Flint",           modId: "minecraft",  type: "item" },

    // Intermediate items
    { id: "gregtech:iron_ingot",     name: "Iron Ingot",      modId: "gregtech",   type: "item" },
    { id: "gregtech:copper_ingot",   name: "Copper Ingot",    modId: "gregtech",   type: "item" },
    { id: "gregtech:tin_ingot",      name: "Tin Ingot",       modId: "gregtech",   type: "item" },
    { id: "gregtech:bronze_ingot",   name: "Bronze Ingot",    modId: "gregtech",   type: "item" },
    { id: "gregtech:iron_dust",      name: "Iron Dust",       modId: "gregtech",   type: "item" },
    { id: "gregtech:copper_dust",    name: "Copper Dust",     modId: "gregtech",   type: "item" },
    { id: "gregtech:tin_dust",       name: "Tin Dust",        modId: "gregtech",   type: "item" },
    { id: "gregtech:bronze_dust",    name: "Bronze Dust",     modId: "gregtech",   type: "item" },
    { id: "gregtech:iron_plate",     name: "Iron Plate",      modId: "gregtech",   type: "item" },
    { id: "gregtech:bronze_plate",   name: "Bronze Plate",    modId: "gregtech",   type: "item" },
    { id: "gregtech:bronze_gear",    name: "Bronze Gear",     modId: "gregtech",   type: "item" },
    { id: "gregtech:iron_gear",      name: "Iron Gear",       modId: "gregtech",   type: "item" },
    { id: "gregtech:iron_rod",       name: "Iron Rod",        modId: "gregtech",   type: "item" },
    { id: "gregtech:bronze_rod",     name: "Bronze Rod",      modId: "gregtech",   type: "item" },
    { id: "gregtech:glass",          name: "Glass",           modId: "gregtech",   type: "item" },
    { id: "gregtech:silicon",        name: "Silicon",         modId: "gregtech",   type: "item" },
    { id: "gregtech:circuit_lv",     name: "LV Circuit",      modId: "gregtech",   type: "item" },

    // Fluids
    { id: "gregtech:steam",          name: "Steam",           modId: "gregtech",   type: "fluid" },
    { id: "gregtech:lava",           name: "Lava",            modId: "minecraft",  type: "fluid" },
    { id: "gregtech:molten_bronze",  name: "Molten Bronze",   modId: "gregtech",   type: "fluid" },
    { id: "gregtech:molten_iron",    name: "Molten Iron",     modId: "gregtech",   type: "fluid" },

    // Gases
    { id: "gregtech:oxygen",         name: "Oxygen",          modId: "gregtech",   type: "gas" },
    { id: "gregtech:hydrogen",       name: "Hydrogen",        modId: "gregtech",   type: "gas" },

    // Catalyst / non-consumable tools
    { id: "gregtech:extruder_mold_gear",  name: "Extruder Mold (Gear)",  modId: "gregtech",  type: "item" },
    { id: "gregtech:extruder_mold_plate", name: "Extruder Mold (Plate)", modId: "gregtech",  type: "item" },
    { id: "gregtech:extruder_mold_rod",   name: "Extruder Mold (Rod)",   modId: "gregtech",  type: "item" },
    { id: "gregtech:hammer",              name: "Hammer",                modId: "gregtech",  type: "item" },
    { id: "gregtech:mortar",              name: "Mortar",                modId: "gregtech",  type: "item" },

    // End products
    { id: "gregtech:steam_furnace", name: "Steam Furnace",   modId: "gregtech",   type: "item" },
    { id: "gregtech:bronze_boiler", name: "Bronze Boiler",   modId: "gregtech",   type: "item" },
  ]).onConflictDoNothing();

  // ── Recipes ──────────────────────────────────────────────────
  await db.insert(schema.recipes).values([
    // Macerate Iron Ore → Iron Dust
    {
      id: "gregtech:macerator_iron_ore",
      machineId: "gregtech:macerator",
      machineName: "Macerator",
      durationTicks: 400,
      inputs: [{ itemId: "minecraft:iron_ore", amount: 1, catalyst: false }],
      outputs: [{ itemId: "gregtech:iron_dust", amount: 2 }],
    },
    // Macerate Copper Ore → Copper Dust
    {
      id: "gregtech:macerator_copper_ore",
      machineId: "gregtech:macerator",
      machineName: "Macerator",
      durationTicks: 400,
      inputs: [{ itemId: "minecraft:copper_ore", amount: 1, catalyst: false }],
      outputs: [{ itemId: "gregtech:copper_dust", amount: 2 }],
    },
    // Macerate Tin Ore → Tin Dust
    {
      id: "gregtech:macerator_tin_ore",
      machineId: "gregtech:macerator",
      machineName: "Macerator",
      durationTicks: 400,
      inputs: [{ itemId: "minecraft:tin_ore", amount: 1, catalyst: false }],
      outputs: [{ itemId: "gregtech:tin_dust", amount: 2 }],
    },
    // Alloy Smelter: Copper Dust + Tin Dust → Bronze Dust
    {
      id: "gregtech:alloy_smelter_bronze_dust",
      machineId: "gregtech:alloy_smelter",
      machineName: "Alloy Smelter",
      durationTicks: 200,
      inputs: [
        { itemId: "gregtech:copper_dust", amount: 3, catalyst: false },
        { itemId: "gregtech:tin_dust",    amount: 1, catalyst: false },
      ],
      outputs: [{ itemId: "gregtech:bronze_dust", amount: 4 }],
    },
    // Electric Furnace: Iron Dust → Iron Ingot
    {
      id: "gregtech:electric_furnace_iron_ingot",
      machineId: "gregtech:electric_furnace",
      machineName: "Electric Furnace",
      durationTicks: 128,
      inputs: [{ itemId: "gregtech:iron_dust", amount: 1, catalyst: false }],
      outputs: [{ itemId: "gregtech:iron_ingot", amount: 1 }],
    },
    // Electric Furnace: Bronze Dust → Bronze Ingot
    {
      id: "gregtech:electric_furnace_bronze_ingot",
      machineId: "gregtech:electric_furnace",
      machineName: "Electric Furnace",
      durationTicks: 128,
      inputs: [{ itemId: "gregtech:bronze_dust", amount: 1, catalyst: false }],
      outputs: [{ itemId: "gregtech:bronze_ingot", amount: 1 }],
    },
    // Electric Furnace: Copper Dust → Copper Ingot
    {
      id: "gregtech:electric_furnace_copper_ingot",
      machineId: "gregtech:electric_furnace",
      machineName: "Electric Furnace",
      durationTicks: 128,
      inputs: [{ itemId: "gregtech:copper_dust", amount: 1, catalyst: false }],
      outputs: [{ itemId: "gregtech:copper_ingot", amount: 1 }],
    },
    // Extruder: Iron Ingot → Iron Plate (with mold catalyst)
    {
      id: "gregtech:extruder_iron_plate",
      machineId: "gregtech:extruder",
      machineName: "Extruder",
      durationTicks: 160,
      inputs: [
        { itemId: "gregtech:iron_ingot",          amount: 1, catalyst: false },
        { itemId: "gregtech:extruder_mold_plate", amount: 1, catalyst: true },
      ],
      outputs: [{ itemId: "gregtech:iron_plate", amount: 1 }],
    },
    // Extruder: Bronze Ingot → Bronze Plate
    {
      id: "gregtech:extruder_bronze_plate",
      machineId: "gregtech:extruder",
      machineName: "Extruder",
      durationTicks: 160,
      inputs: [
        { itemId: "gregtech:bronze_ingot",        amount: 1, catalyst: false },
        { itemId: "gregtech:extruder_mold_plate", amount: 1, catalyst: true },
      ],
      outputs: [{ itemId: "gregtech:bronze_plate", amount: 1 }],
    },
    // Extruder: Bronze Ingot → Bronze Gear (with gear mold)
    {
      id: "gregtech:extruder_bronze_gear",
      machineId: "gregtech:extruder",
      machineName: "Extruder",
      durationTicks: 256,
      inputs: [
        { itemId: "gregtech:bronze_ingot",       amount: 4, catalyst: false },
        { itemId: "gregtech:extruder_mold_gear", amount: 1, catalyst: true },
      ],
      outputs: [{ itemId: "gregtech:bronze_gear", amount: 1 }],
    },
    // Extruder: Iron Ingot → Iron Gear
    {
      id: "gregtech:extruder_iron_gear",
      machineId: "gregtech:extruder",
      machineName: "Extruder",
      durationTicks: 256,
      inputs: [
        { itemId: "gregtech:iron_ingot",         amount: 4, catalyst: false },
        { itemId: "gregtech:extruder_mold_gear", amount: 1, catalyst: true },
      ],
      outputs: [{ itemId: "gregtech:iron_gear", amount: 1 }],
    },
    // Extruder: Iron Ingot → Iron Rod
    {
      id: "gregtech:extruder_iron_rod",
      machineId: "gregtech:extruder",
      machineName: "Extruder",
      durationTicks: 80,
      inputs: [
        { itemId: "gregtech:iron_ingot",        amount: 1, catalyst: false },
        { itemId: "gregtech:extruder_mold_rod", amount: 1, catalyst: true },
      ],
      outputs: [{ itemId: "gregtech:iron_rod", amount: 2 }],
    },
    // Extruder: Bronze Ingot → Bronze Rod
    {
      id: "gregtech:extruder_bronze_rod",
      machineId: "gregtech:extruder",
      machineName: "Extruder",
      durationTicks: 80,
      inputs: [
        { itemId: "gregtech:bronze_ingot",      amount: 1, catalyst: false },
        { itemId: "gregtech:extruder_mold_rod", amount: 1, catalyst: true },
      ],
      outputs: [{ itemId: "gregtech:bronze_rod", amount: 2 }],
    },
    // Assembler: Bronze Plates + Gears → Bronze Boiler
    {
      id: "gregtech:assembler_bronze_boiler",
      machineId: "gregtech:assembler",
      machineName: "Assembler",
      durationTicks: 400,
      inputs: [
        { itemId: "gregtech:bronze_plate", amount: 8, catalyst: false },
        { itemId: "gregtech:bronze_gear",  amount: 2, catalyst: false },
      ],
      outputs: [{ itemId: "gregtech:bronze_boiler", amount: 1 }],
    },
    // Assembler: Iron Plates + Rods + Circuit → Steam Furnace
    {
      id: "gregtech:assembler_steam_furnace",
      machineId: "gregtech:assembler",
      machineName: "Assembler",
      durationTicks: 512,
      inputs: [
        { itemId: "gregtech:iron_plate",  amount: 4, catalyst: false },
        { itemId: "gregtech:iron_rod",    amount: 2, catalyst: false },
        { itemId: "gregtech:circuit_lv",  amount: 1, catalyst: false },
      ],
      outputs: [{ itemId: "gregtech:steam_furnace", amount: 1 }],
    },
    // Electrolyzer: Sand → Silicon + Oxygen (gas byproduct)
    {
      id: "gregtech:electrolyzer_silicon",
      machineId: "gregtech:electrolyzer",
      machineName: "Electrolyzer",
      durationTicks: 800,
      inputs: [{ itemId: "minecraft:sand", amount: 2, catalyst: false }],
      outputs: [
        { itemId: "gregtech:silicon", amount: 1 },
        { itemId: "gregtech:oxygen", amount: 1000 },
      ],
    },
    // Electric Furnace: Sand → Glass
    {
      id: "gregtech:electric_furnace_glass",
      machineId: "gregtech:electric_furnace",
      machineName: "Electric Furnace",
      durationTicks: 128,
      inputs: [{ itemId: "minecraft:sand", amount: 1, catalyst: false }],
      outputs: [{ itemId: "gregtech:glass", amount: 1 }],
    },
  ]).onConflictDoNothing();

  console.log("✅ Seed complete!");
  await pool.end();
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
