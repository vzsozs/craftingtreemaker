import { useState } from "react";

function getInitials(name: string): string {
  return name
    .split(/[\s_:]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
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
  
  if (error > 1 || !itemId) {
    return <span style={textStyle}>{getInitials(itemName)}</span>;
  }
  
  // Convert gregtech:iron_rod -> gregtech__iron_rod.png
  let src = `/icons/${itemId.replace(":", "__")}.png`;
  if (error === 1) {
      if (itemType === "fluid") {
          src = `/icons/fluid__${itemId.replace(":", "__")}.png`;
      } else if (itemId.startsWith("gtceu:")) {
          // Strip tier prefix (lv_, mv_, hv_, stb.) és lv_ fallbacket próbálunk
          const TIERS = ["ulv_", "lv_", "mv_", "hv_", "ev_", "iv_", "luv_", "zpm_", "uv_", "uhv_"];
          let baseName = itemId.substring(6); // pl. "mv_centrifuge"
          for (const t of TIERS) {
              if (baseName.startsWith(t)) {
                  baseName = baseName.substring(t.length); // "centrifuge"
                  break;
              }
          }
          src = `/icons/gtceu__lv_${baseName}.png`; // "gtceu__lv_centrifuge.png"
      }
  }
  
  // Fluid/gas esetén teljesen kitölti a slotot, item esetén 75%-os padding marad
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
