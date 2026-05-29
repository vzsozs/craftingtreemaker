# CraftingTreeMaker - Projekt Folyamatok és Fejlesztések

Ez a dokumentum összefoglalja azokat a főbb funkciókat, rendszereket és hibajavításokat, amelyeket a CraftingTreeMaker projektben eddig megvalósítottunk. A projekt célja egy interaktív és vizuális gyártási fa (crafting tree) tervező alkalmazás készítése, kifejezetten a TerraFirmaGreg (TFG) / GTCEu modpackekhez.

## 1. Alapvető Architektúra és Setup
- **Next.js és React:** A projekt alapját a Next.js framework adja, modern React funkciókkal (React Server Components, kliens oldali állapotkezelés).
- **Adatbázis (SQLite & Drizzle ORM):** Létrehoztunk egy helyi SQLite adatbázist, amelyet a Drizzle ORM kezel. Két fő táblát definiáltunk:
  - `items`: Az alapanyagokat, folyadékokat és végtermékeket tárolja.
  - `recipes`: A gépek receptjeit, azok bemeneteit (inputs), kimeneteit (outputs), gyártási idejét (duration) és a szükséges gépet tárolja.
- **Git verziókövetés:** A projektet inicializáltuk Git repóként. A `.gitignore` fájl megfelelően van konfigurálva, hogy a hatalmas adatbázis dumpok (`src/db/dumps`), a rengeteg generált ikon (`public/icons`) és a függőségek (`node_modules`) ne kerüljenek feltöltésre a GitHubra, biztosítva a gyors és tiszta szinkronizálást.

## 2. KubeJS Adatbázis Importáló Rendszer (`importKubejs.ts`)
Mivel a modpack (TFG) több mint 130,000 receptet tartalmaz, szükség volt egy robusztus importáló scriptre, amely feldolgozza a KubeJS által kiexportált JSON fájlokat.
- **Kétfázisú feldolgozás:** 
  1. A script először végigszkenneli a több mint százezer JSON recept fájlt, és felépít egy térképet (Map), ami megmondja, melyik itemet/folyadékot melyik recept állítja elő.
  2. Egy megadott cél-itemből (pl. `tfg:bakelite`) kiindulva rekurzívan visszaköveti a gyártási láncot, így csak a ténylegesen szükséges recepteket menti le.
- **GTCEu Fluid Fix:** Kezdetben a script figyelmen kívül hagyta a folyadék (fluid) alapú kimeneteket a szkennelés során. Ezt sikeresen javítottuk (a `parseOutput` függvény globálissá tételével és kiterjesztésével), így most már az olyan köztes folyadékok, mint a *Phenolic Resin*, tökéletesen megjelennek a fában.
- **Tier (Szint) kalkuláció:** A GTCEu gépek energiaszükséglete (EU/t) alapján a script automatikusan besorolja a receptet a megfelelő Tier-be (LV, MV, HV, EV, stb.), és a gép nevét ehhez igazítja.
- **Memóriakezelés és optimalizálás:** A több ezer elem beszúrásánál fellépő `Maximum call stack size exceeded` hiba elkerülése érdekében az adatbázis INSERTEK-et "chunk"-okra (1000 elemes blokkokra) osztottuk.

## 3. Felhasználói Felület (UI) és Crafting Tree Vizualizáció
- **ReactFlow Integráció (`CraftingCanvas.tsx`):** A vizuális fa megjelenítése a ReactFlow könyvtárral történik.
- **Egyedi Csomópontok (`MachineNode.tsx`):** A fában minden csomópont (node) egy egyedi komponenst használ, amely grafikusan, kis ikonokkal és mennyiségekkel mutatja be a szükséges alapanyagokat, a használt gépet, és a kimenetet.
- **Vizuális elemek (`IconImage` & `ItemMiniSlot`):** Az ikonok kezelése intelligens módon történik. Olyan rendszert alakítottunk ki, ahol az itemek, folyadékok és gépek miniatűr slotokban (`ItemMiniSlot`) jelennek meg, színkódolva (pl. kék a folyadékoknak).

## 4. Recept Választó Modal (`RecipePickerModal.tsx`)
Mivel sok alapanyagnak több előállítási módja is van (pl. Asbestos Dust kiégethető többféle Tier-ű Smelterben, vagy kémiai úton is előállítható), készítettünk egy dedikált ablakot a megfelelő recept kiválasztására.
- **Gép alapú fülek (Tabs):** A receptek gépnév szerint csoportosítva jelennek meg a modal tetején. Minden gép egy vizuális fül (Tab), a gép ikonjával és tooltip-es nevével.
- **Kereső (Filter):** A kiválasztott fülön belül működő, azonnali szöveges szűrő, ami a bemenetek, kimenetek vagy gépnév alapján keres.
- **Egységes Output design:** Kezdetben a kimenetek csak egyszerű színes pöttyökként jelentek meg. Ezt továbbfejlesztettük, így a recept választóban a kimenetek most már pontosan ugyanolyan kis 26x26 pixeles, keretes `ItemMiniSlot` ikonokként látszanak, mint a bemenetek.
- **Dinamikus Batch kalkuláció:** A modal menet közben kiszámolja, hogy a kért mennyiség alapján hány "batch" (adag) szükséges az adott receptből, és a szükséges bemeneteket is felszorozza a megjelenítésnél.

## 5. Kiegészítő Funkciók
- **Shopping List (Bevásárlólista):** Összesíti a fa alján lévő "nyersanyagokat" (olyan itemek, amelyeknek már nincs további bontott receptje a fában), és egy jól áttekinthető listában mutatja meg, miből mennyit kell összeszedni a teljes lánc megépítéséhez.
- **Jegyzetelő (Note Editor):** Lehetőség van a fában lévő csomópontokhoz egyedi szöveges megjegyzéseket fűzni egy felugró ablak segítségével, amely aztán megjelenik a node felületén.

## Összegzés
A rendszer magja (adatbázis modell, rekurzív KubeJS importálás, ReactFlow canvas, dinamikus receptválasztás, UI komponensek) stabilan és hatékonyan működik. A komplex GTCEu láncok (mint pl. a Bakelite gyártás) vizualizálása automatikussá és könnyen nyomonkövethetővé vált.
