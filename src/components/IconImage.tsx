import { useState } from "react";

function getInitials(name: string): string {
  return name
    .split(/[\s_:]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

function getIconCandidates(itemId: string, itemType?: string): string[] {
  const candidates: string[] = [];

  if (!itemId) return candidates;

  // Normalize ID (colon to double-underscore, slash to triple-underscore)
  const normalized = itemId.replace(":", "__").replace(/\//g, "___");
  candidates.push(`/icons/${normalized}.png`);

  // Fluid/gas specific candidate
  if (itemType === "fluid") {
    candidates.push(`/icons/fluid__${normalized}.png`);
  }

  // Parse namespace and path
  let parts = itemId.split(":");
  let ns = parts[0];
  let path = parts[1] || "";

  // Strip leading '#' for tags
  if (ns.startsWith("#")) {
    ns = ns.substring(1);
  }

  // Common Tiers to strip
  const TIERS = ["ulv_", "lv_", "mv_", "hv_", "ev_", "iv_", "luv_", "zpm_", "uv_", "uhv_"];
  let baseName = path;
  let tier = "";
  for (const t of TIERS) {
    if (path.startsWith(t)) {
      baseName = path.substring(t.length);
      tier = t;
      break;
    }
  }

  // 1. Suffix & Suffix Replacements (e.g., Centrifugation -> Centrifuge, Rolling -> Rolling Mill, Cutting -> Mechanical Saw, etc.)
  let replacedBase = baseName;
  if (baseName.includes("centrifugation")) {
    replacedBase = baseName.replace("centrifugation", "centrifuge");
  } else if (baseName.includes("rolling")) {
    replacedBase = baseName.replace("rolling", "rolling_mill");
  } else if (baseName.includes("milling")) {
    replacedBase = baseName.replace("milling", "millstone");
  } else if (baseName.includes("mixing")) {
    replacedBase = baseName.replace("mixing", "mechanical_mixer");
  } else if (baseName.includes("pressing")) {
    replacedBase = baseName.replace("pressing", "mechanical_press");
  } else if (baseName.includes("cutting")) {
    replacedBase = baseName.replace("cutting", "mechanical_saw");
  } else if (baseName.includes("splashing")) {
    replacedBase = baseName.replace("splashing", "encased_fan");
  }

  if (replacedBase !== baseName) {
    candidates.push(`/icons/${ns}__${replacedBase}.png`);
    candidates.push(`/icons/create__${replacedBase}.png`); // Create standard machine fallback
  }

  // 2. Generic Tag & Material Replacements (e.g. rods/amethyst -> amethyst_rod, powder/flux -> powder___flux, etc.)
  if (path.includes("/")) {
    const pathParts = path.split("/");
    const category = pathParts[0];
    const material = pathParts[pathParts.length - 1]; // e.g. amethyst

    // Try translating common TFC/forge tags to GregTech item styles
    if (category === "rods") {
      candidates.push(`/icons/gtceu__${material}_rod.png`);
      candidates.push(`/icons/tfg__${material}_rod.png`);
    } else if (category === "gems") {
      candidates.push(`/icons/gtceu__${material}.png`);
      candidates.push(`/icons/minecraft__${material}.png`);
      candidates.push(`/icons/tfc__gem___${material}.png`);
    } else if (category === "plates" || category === "sheets" || pathParts.includes("sheet") || pathParts.includes("plate")) {
      const matNormal = material.replace("aluminum", "aluminium");
      const matUS = material.replace("aluminium", "aluminum");
      candidates.push(`/icons/gtceu__${matNormal}_plate.png`);
      candidates.push(`/icons/gtceu__double_${matNormal}_plate.png`);
      candidates.push(`/icons/gtceu__${matNormal}_foil.png`);
      candidates.push(`/icons/gtceu__${matUS}_plate.png`);
      candidates.push(`/icons/gtceu__double_${matUS}_plate.png`);
    }
  }

  // 3. Spellings & Suffix variations for general metals (e.g. "aluminum_sheet", "aluminium_plate")
  const pathNormal = path.replace("aluminum", "aluminium");
  const pathUS = path.replace("aluminium", "aluminum");
  if (pathNormal !== path || pathUS !== path) {
    candidates.push(`/icons/${ns}__${pathNormal.replace(/\//g, "___")}.png`);
    candidates.push(`/icons/${ns}__${pathUS.replace(/\//g, "___")}.png`);
  }

  // Suffix fallback for plates and sheets
  if (path.includes("plate") || path.includes("sheet")) {
    const mat = path.replace("double_", "").replace("_plate", "").replace("_sheet", "");
    const matNormal = mat.replace("aluminum", "aluminium");
    candidates.push(`/icons/gtceu__double_${matNormal}_plate.png`);
    candidates.push(`/icons/gtceu__${matNormal}_plate.png`);
    candidates.push(`/icons/gtceu__${matNormal}_foil.png`);
    candidates.push(`/icons/tfc__metal___sheet___${matNormal}.png`);
    candidates.push(`/icons/tfc__metal___double_sheet___${matNormal}.png`);
  }

  // 4. Tier based candidates (for machines like gtceu:lv_pisciculture_fishery or tfg:lv_pisciculture_fishery)
  if (tier) {
    candidates.push(`/icons/${ns}__lv_${baseName}.png`); // lv fallback
    candidates.push(`/icons/${ns}__${baseName}.png`); // tier-less fallback
    
    // Cross-namespace machine fallbacks
    const otherNamespaces = ["tfg", "gtceu", "tfc", "create", "minecraft"];
    for (const otherNs of otherNamespaces) {
      if (otherNs !== ns) {
        candidates.push(`/icons/${otherNs}__lv_${baseName}.png`);
        candidates.push(`/icons/${otherNs}__${baseName}.png`);
      }
    }
  }

  // 5. Special explicit mappings (as a fallback in case heuristics failed)
  const machineMapping: Record<string, string> = {
    "create:mechanical_crafting": "create__mechanical_crafter.png",
    "create:sequenced_assembly": "create__precision_mechanism.png",
    "create:mixing": "create__mechanical_mixer.png",
    "create:pressing": "create__mechanical_press.png",
    "create:filling": "create__spout.png",
    "create:deploying": "create__deployer.png",
    "create:milling": "create__millstone.png",
    "greate:compacting": "create__mechanical_press.png",
    "greate:pressing": "create__mechanical_press.png",
    "greate:mixing": "create__mechanical_mixer.png",
    "greate:milling": "create__millstone.png",
    "greate:splashing": "create__encased_fan.png",
    "create:splashing": "create__encased_fan.png",
    "tfc:anvil": "minecraft__anvil.png",
    "tfc:heating": "minecraft__furnace.png",
    "tfc:welding": "minecraft__anvil.png",
    "minecraft:crafting_table": "minecraft__crafting_table.png",
    "minecraft:stonecutting": "minecraft__stonecutter.png",
    "vintageimprovements:vacuumizing": "vintageimprovements__vacuum_chamber.png",
    "tfg:artisan": "tfg__artisan_table.png",
    "tfg:artisan_table": "tfg__artisan_table.png",
    "ae2:transform": "ae2__fluix_crystal.png"
  };

  if (machineMapping[itemId]) {
    candidates.push(`/icons/${machineMapping[itemId]}`);
  }

  // Name based heuristics
  const lowerId = itemId.toLowerCase();
  if (lowerId.includes("anvil")) {
    candidates.push("/icons/minecraft__anvil.png");
  }
  if (lowerId.includes("furnace") || lowerId.includes("heating") || lowerId.includes("smelting") || lowerId.includes("oven")) {
    candidates.push("/icons/minecraft__furnace.png");
  }
  if (lowerId.includes("mixer")) {
    candidates.push("/icons/create__mechanical_mixer.png");
  }
  if (lowerId.includes("press")) {
    candidates.push("/icons/create__mechanical_press.png");
  }
  if (lowerId.includes("saw") || lowerId.includes("cutting")) {
    candidates.push("/icons/create__mechanical_saw.png");
  }

  // Filter unique values and return
  return Array.from(new Set(candidates)).filter(Boolean);
}

export function IconImage({ 
  itemId, 
  itemName, 
  size, 
  textStyle = {}, 
  itemType 
}: { 
  itemId: string, 
  itemName: string, 
  size: number, 
  textStyle?: React.CSSProperties, 
  itemType?: string 
}) {
  const [error, setError] = useState(0);
  
  const candidates = getIconCandidates(itemId, itemType);

  if (error >= candidates.length || !itemId) {
    return <span style={textStyle}>{getInitials(itemName)}</span>;
  }
  
  const src = candidates[error];
  
  // Fluid/gas gets 95% size, items get 75%
  const isFluidOrGas = itemType === "fluid" || itemType === "gas";
  const imgSize = isFluidOrGas ? size * 0.95 : size * 0.75;
  
  return (
    <img 
      src={src} 
      alt={itemName} 
      width={imgSize} 
      height={imgSize} 
      style={{ imageRendering: "pixelated", objectFit: "contain" }}
      onError={() => setError(e => e + 1)} 
      draggable={false}
    />
  );
}
