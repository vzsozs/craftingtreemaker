/**
 * Extra seed: complex multi-step crafting chain for testing.
 * Goal: Electric Motor (LV)
 *
 * Chain overview:
 * Electric Motor (LV)
 * └─ Assembler
 *    ├─ Iron Rod ×2        → Extruder (rod mold) ← Iron Ingot ← EF ← Iron Dust ← Macerator ← Iron Ore
 *    ├─ Copper Wire ×16   → [A] Wire Drawing Machine (drawing die) ← Copper Ingot ← EF ← Copper Dust ← Mac ← Copper Ore
 *    │                    → [B] Crafting Table (alternative, less efficient)
 *    ├─ Steel Plate ×2    → Extruder (plate mold) ← Steel Ingot
 *    │                            ← [A] Electric Blast Furnace: Iron Dust + Carbon Dust
 *    │                            ← [B] Arc Furnace: Iron Ingot ×3 (alternative)
 *    └─ Iron Plate ×2     → Extruder (plate mold) ← Iron Ingot (already in chain)
 *
 * Run: npx tsx --env-file=.env.local src/db/seed_extra.ts
 */

import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function main() {
  console.log("🌱 Seeding extra complex chain (Electric Motor LV)...");

  // ── New items ───────────────────────────────────────────────────────────────
  await db.insert(schema.items).values([
    // Steel chain
    { id: "gregtech:steel_ingot",   name: "Steel Ingot",        modId: "gregtech",  type: "item" },
    { id: "gregtech:steel_dust",    name: "Steel Dust",          modId: "gregtech",  type: "item" },
    { id: "gregtech:steel_plate",   name: "Steel Plate",         modId: "gregtech",  type: "item" },
    { id: "gregtech:steel_rod",     name: "Steel Rod",           modId: "gregtech",  type: "item" },
    { id: "gregtech:steel_pipe",    name: "Steel Pipe",          modId: "gregtech",  type: "item" },

    // Copper Wire
    { id: "gregtech:copper_wire",   name: "Copper Wire",         modId: "gregtech",  type: "item" },

    // Carbon (from coal)
    { id: "gregtech:carbon_dust",   name: "Carbon Dust",         modId: "gregtech",  type: "item" },

    // Fluids
    { id: "gregtech:nitrogen",      name: "Nitrogen",            modId: "gregtech",  type: "gas" },
    { id: "gregtech:coolant",       name: "Coolant",             modId: "gregtech",  type: "fluid" },

    // End product
    { id: "gregtech:electric_motor_lv", name: "Electric Motor (LV)", modId: "gregtech", type: "item" },
    { id: "gregtech:electric_piston_lv", name: "Electric Piston (LV)", modId: "gregtech", type: "item" },

    // Catalysts / tools
    { id: "gregtech:drawing_die",         name: "Drawing Die",          modId: "gregtech", type: "item" },
    { id: "gregtech:extruder_mold_pipe",  name: "Extruder Mold (Pipe)", modId: "gregtech", type: "item" },
    { id: "gregtech:extruder_mold_wire",  name: "Extruder Mold (Wire)", modId: "gregtech", type: "item" },
  ]).onConflictDoNothing();

  // ── New recipes ─────────────────────────────────────────────────────────────
  await db.insert(schema.recipes).values([

    // ── Carbon Dust from Coal (Macerator) ───────────────────────────────────
    {
      id: "gregtech:macerator_coal_carbon",
      machineId: "gregtech:macerator",
      machineName: "Macerator",
      durationTicks: 200,
      inputs:  [{ itemId: "minecraft:coal",        amount: 1, catalyst: false }],
      outputs: [{ itemId: "gregtech:carbon_dust",  amount: 2 }],
    },

    // ── Steel Ingot – Electric Blast Furnace (Iron Dust + Carbon Dust) [A] ──
    {
      id: "gregtech:ebf_steel_ingot",
      machineId: "gregtech:electric_blast_furnace",
      machineName: "Electric Blast Furnace",
      durationTicks: 500,
      inputs: [
        { itemId: "gregtech:iron_dust",   amount: 1, catalyst: false },
        { itemId: "gregtech:carbon_dust", amount: 1, catalyst: false },
      ],
      outputs: [{ itemId: "gregtech:steel_ingot", amount: 1 }],
    },

    // ── Steel Ingot – Arc Furnace (Iron Ingot ×3 → Steel Ingot ×3) [B] ─────
    {
      id: "gregtech:arc_furnace_steel_ingot",
      machineId: "gregtech:arc_furnace",
      machineName: "Arc Furnace",
      durationTicks: 320,
      inputs: [
        { itemId: "gregtech:iron_ingot", amount: 3, catalyst: false },
      ],
      outputs: [{ itemId: "gregtech:steel_ingot", amount: 3 }],
    },

    // ── Steel Plate – Extruder (with plate mold) ─────────────────────────────
    {
      id: "gregtech:extruder_steel_plate",
      machineId: "gregtech:extruder",
      machineName: "Extruder",
      durationTicks: 160,
      inputs: [
        { itemId: "gregtech:steel_ingot",         amount: 1, catalyst: false },
        { itemId: "gregtech:extruder_mold_plate", amount: 1, catalyst: true  },
      ],
      outputs: [{ itemId: "gregtech:steel_plate", amount: 1 }],
    },

    // ── Steel Rod – Extruder (with rod mold) ─────────────────────────────────
    {
      id: "gregtech:extruder_steel_rod",
      machineId: "gregtech:extruder",
      machineName: "Extruder",
      durationTicks: 80,
      inputs: [
        { itemId: "gregtech:steel_ingot",        amount: 1, catalyst: false },
        { itemId: "gregtech:extruder_mold_rod",  amount: 1, catalyst: true  },
      ],
      outputs: [{ itemId: "gregtech:steel_rod", amount: 2 }],
    },

    // ── Steel Pipe – Extruder (with pipe mold) ────────────────────────────────
    {
      id: "gregtech:extruder_steel_pipe",
      machineId: "gregtech:extruder",
      machineName: "Extruder",
      durationTicks: 128,
      inputs: [
        { itemId: "gregtech:steel_ingot",        amount: 3, catalyst: false },
        { itemId: "gregtech:extruder_mold_pipe", amount: 1, catalyst: true  },
      ],
      outputs: [{ itemId: "gregtech:steel_pipe", amount: 2 }],
    },

    // ── Copper Wire – Wire Drawing Machine (×8 per ingot, drawing die cat) [A]
    {
      id: "gregtech:wire_drawing_copper_wire",
      machineId: "gregtech:wire_drawing_machine",
      machineName: "Wire Drawing Machine",
      durationTicks: 200,
      inputs: [
        { itemId: "gregtech:copper_ingot", amount: 1, catalyst: false },
        { itemId: "gregtech:drawing_die",  amount: 1, catalyst: true  },
      ],
      outputs: [{ itemId: "gregtech:copper_wire", amount: 8 }],
    },

    // ── Copper Wire – Crafting Table (×4 per ingot, simpler but less efficient) [B]
    {
      id: "minecraft:crafting_copper_wire",
      machineId: "minecraft:crafting_table",
      machineName: "Crafting Table",
      durationTicks: 1,
      inputs: [
        { itemId: "gregtech:copper_ingot", amount: 1, catalyst: false },
      ],
      outputs: [{ itemId: "gregtech:copper_wire", amount: 4 }],
    },

    // ── Electric Motor (LV) – Assembler ────────────────────────────────────
    // Needs: Iron Rod ×2, Copper Wire ×16, Steel Plate ×2, Iron Plate ×2
    {
      id: "gregtech:assembler_electric_motor_lv",
      machineId: "gregtech:assembler",
      machineName: "Assembler",
      durationTicks: 600,
      inputs: [
        { itemId: "gregtech:iron_rod",     amount: 2,  catalyst: false },
        { itemId: "gregtech:copper_wire",  amount: 16, catalyst: false },
        { itemId: "gregtech:steel_plate",  amount: 2,  catalyst: false },
        { itemId: "gregtech:iron_plate",   amount: 2,  catalyst: false },
      ],
      outputs: [{ itemId: "gregtech:electric_motor_lv", amount: 1 }],
    },

    // ── Electric Piston (LV) – Assembler ───────────────────────────────────
    // Needs: Electric Motor LV ×1, Steel Pipe ×2, Steel Rod ×2, Steel Plate ×3, Iron Plate ×2
    {
      id: "gregtech:assembler_electric_piston_lv",
      machineId: "gregtech:assembler",
      machineName: "Assembler",
      durationTicks: 800,
      inputs: [
        { itemId: "gregtech:electric_motor_lv", amount: 1, catalyst: false },
        { itemId: "gregtech:steel_pipe",         amount: 2, catalyst: false },
        { itemId: "gregtech:steel_rod",          amount: 2, catalyst: false },
        { itemId: "gregtech:steel_plate",        amount: 3, catalyst: false },
        { itemId: "gregtech:iron_plate",         amount: 2, catalyst: false },
      ],
      outputs: [{ itemId: "gregtech:electric_piston_lv", amount: 1 }],
    },

  ]).onConflictDoNothing();

  console.log("✅ Extra seed complete!");
  await pool.end();
}

main().catch((e) => {
  console.error("❌ Extra seed failed:", e);
  process.exit(1);
});
