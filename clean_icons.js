import fs from "fs";
import path from "path";

const dir = path.join(process.cwd(), "public/icons");
const files = fs.readdirSync(dir);

let renamed = 0;
let deleted = 0;

for (const file of files) {
  if (!file.endsWith(".png")) continue;
  
  // Find where the NBT data starts: usually "___{" or "__{"
  let newName = file;
  const match = newName.match(/_+{/); // match one or more underscores followed by {
  
  if (match) {
     const idx = match.index;
     newName = newName.substring(0, idx) + ".png";
  }

  if (newName !== file) {
    const oldPath = path.join(dir, file);
    const newPath = path.join(dir, newName);
    
    if (!fs.existsSync(newPath)) {
      fs.renameSync(oldPath, newPath);
      renamed++;
    } else {
      // If the base item already exists, we don't need the NBT duplicate
      fs.unlinkSync(oldPath);
      deleted++;
    }
  }
}

console.log(`Cleaned up icons: Renamed ${renamed}, Deleted ${deleted} duplicates.`);
