import {
  pgTable,
  text,
  integer,
  jsonb,
  uuid,
  timestamp,
  real,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────
// Items / Fluids / Gases
// ─────────────────────────────────────────────
export const items = pgTable("items", {
  id: text("id").primaryKey(), // e.g. "gregtech:bronze_ingot"
  name: text("name").notNull(), // e.g. "Bronze Ingot"
  modId: text("mod_id").notNull(), // e.g. "gregtech"
  type: text("type", { enum: ["item", "fluid", "gas"] })
    .notNull()
    .default("item"),
  iconPath: text("icon_path"), // path to icon image file (optional)
});

// ─────────────────────────────────────────────
// Recipes
// ─────────────────────────────────────────────
export type RecipeIngredient = {
  itemId: string;
  amount: number;
  catalyst: boolean; // if true, amount is not multiplied by batch size
};

export type RecipeOutput = {
  itemId: string;
  amount: number;
};

export const recipes = pgTable("recipes", {
  id: text("id").primaryKey(), // e.g. "gregtech:extruder_bronze_gear"
  machineId: text("machine_id").notNull(), // e.g. "gregtech:extruder"
  machineName: text("machine_name").notNull(), // e.g. "Extruder"
  durationTicks: integer("duration_ticks").notNull().default(100),
  inputs: jsonb("inputs").$type<RecipeIngredient[]>().notNull(),
  outputs: jsonb("outputs").$type<RecipeOutput[]>().notNull(),
});

// ─────────────────────────────────────────────
// Saved Trees (projects)
// ─────────────────────────────────────────────
export const savedTrees = pgTable("saved_trees", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().default("local"), // no auth yet
  name: text("name").notNull(),
  targetItemId: text("target_item_id").notNull(),
  targetAmount: integer("target_amount").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─────────────────────────────────────────────
// Tree Nodes (separate table instead of JSONB)
// ─────────────────────────────────────────────
export const treeNodes = pgTable("tree_nodes", {
  id: text("id").primaryKey(), // react-flow node id
  treeId: uuid("tree_id")
    .notNull()
    .references(() => savedTrees.id, { onDelete: "cascade" }),
  recipeId: text("recipe_id").references(() => recipes.id), // null = raw material node
  itemId: text("item_id")
    .notNull()
    .references(() => items.id),
  requestedAmount: real("requested_amount").notNull().default(1),
  batchMultiplier: real("batch_multiplier").notNull().default(1),
  posX: real("pos_x").notNull().default(0),
  posY: real("pos_y").notNull().default(0),
  notes: text("notes"),
});

// ─────────────────────────────────────────────
// Tree Edges (connections between nodes)
// ─────────────────────────────────────────────
export const treeEdges = pgTable("tree_edges", {
  id: text("id").primaryKey(), // react-flow edge id
  treeId: uuid("tree_id")
    .notNull()
    .references(() => savedTrees.id, { onDelete: "cascade" }),
  sourceNodeId: text("source_node_id")
    .notNull()
    .references(() => treeNodes.id, { onDelete: "cascade" }),
  targetNodeId: text("target_node_id")
    .notNull()
    .references(() => treeNodes.id, { onDelete: "cascade" }),
  sourceHandle: text("source_handle"), // which output port
  targetHandle: text("target_handle"), // which input port
  itemId: text("item_id").references(() => items.id), // for coloring by type
});
