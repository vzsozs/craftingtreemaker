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
  textStyle, 
  itemType 
}: { 
  itemId: string, 
  itemName: string, 
  size: number, 
  textStyle: React.CSSProperties, 
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
          // Try appending lv_ for generic machines
          src = `/icons/gtceu__lv_${itemId.substring(6)}.png`;
      }
  }
  
  const imgSize = size * 0.75; // leave some padding inside the slot
  
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
