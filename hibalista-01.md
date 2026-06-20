# CraftingTreeMaker - Logikai Audit és Hibalista

A `folyamatok.md` és a forráskód átvizsgálása alapján a következő logikai hibákat és hiányosságokat tártam fel a rendszerben. Ezek javítása javasolt a stabilabb és hibaállóbb működés érdekében.

## 1. DAG (Irányított Körmentes Gráf) Node Törlési Hiba (`CraftingCanvas.tsx`)
**Kritikusság: MAGAS**
- **Jelenség:** A `handleRecipeSelect` függvényben egy recept cseréjekor a `collectSubtree` eltávolítja a régi input node-ot és annak teljes részfáját.
- **Logikai hiba:** A rendszer lehetővé teszi, hogy egy alapanyagot több gép is felhasználjon (DAG felépítés, `+=` összegzés a `folyamatok.md` szerint). Ha egy közös node-ot (pl. rézpor) több szülő is használ, és az egyik szülő receptjét lecseréljük, a `collectSubtree` letörli a rézport! Ezzel a *másik* szülő kapcsolata is a semmibe vész, és a rézpor eltűnik az ő ágáról is.
- **Megoldás:** A `collectSubtree` vagy a törlési logika során vizsgálni kell a bejövő éleket (`edges.filter(e => e.source === childId)`). Egy node-ot (és részfáját) csak akkor szabad törölni, ha a lecserélt szülőn kívül *nincs másik* szülője, amelyik hivatkozik rá.

## 2. React Flow beépített törlésének (Backspace/Delete) szinkronizálatlansága (`CraftingCanvas.tsx`)
**Kritikusság: MAGAS**
- **Jelenség:** A felhasználó a React Flow alapértelmezett viselkedése miatt kijelölhet egy node-ot vagy élet, és a Backspace gombbal letörölheti azt.
- **Logikai hiba:** A törlés hatására az `onNodesChange` / `onEdgesChange` frissíti a React Flow belső állapotát, így az elem eltűnik a képernyőről. **DE!** Nem hívódik meg a `recalculateTreeAmounts`. Így a letörölt elem "szellemként" a bevásárlólistán maradhat, a fában maradt gyerek-node-ok pedig továbbra is a régi `requestedAmount` értékkel fognak számolni, mintha a szülő még létezne.
- **Megoldás:** Meg kell fogni a törlési eseményeket az `onNodesChange` és `onEdgesChange` hookokban (amikor a change típusa `"remove"`), és utána manuálisan meg kell hívni a `recalculateTreeAmounts`-ot.

## 3. Duplikált kulcsok beszúrása a Bulk Insert során (`importKubejs.ts`)
**Kritikusság: KÖZEPES**
- **Jelenség:** Ha az `added_recipes/` és a `recipes/` mappában is szerepel azonos nevű fájl (pl. `foo.json`), a szkript mindkettőnek ugyanazt az MD5 alapú `recipeId`-t adja a `relPath` alapján.
- **Logikai hiba:** A szkript egy tömbbe (`recipesToInsert`) gyűjti a recepteket, így mindkét változat bekerül a tömbbe *ugyanazzal az azonosítóval*. Bár a Drizzle `onConflictDoNothing()` a PostgreSQL szintjén eldobja a másodikat (ami helyes, mert az `added_recipes` felülírja az alapértelmezettet), a Drizzle bulk insert működésétől függően ez memóriapazarló, illetve bizonyos adatbázis-konfigurációknál SQL hibát dobhat ("ON CONFLICT... duplicated key").
- **Megoldás:** Az `itemsToInsert`-hez hasonlóan a `recipesToInsert`-et is egy `Map<string, any>` adatszerkezetben kellene gyűjteni, így a memóriában már csak a felülírt (legfrissebb) recept maradna meg, mielőtt az SQL lekérés lefutna.

## 4. Katalizátorok mennyiségének alulreprezentálása (`batchCalc.ts` & `ShoppingList.tsx`)
**Kritikusság: ALACSONY**
- **Jelenség:** A `buildShoppingList` a katalizátorokat (eszközöket) egyszerűen beteszi egy Map-be, majd a `ShoppingList.tsx` keménykódoltan `×1` mennyiséget jelenít meg hozzájuk.
- **Logikai hiba:** Ha egy recept kifejezetten 2 db eszközt kér katalizátorként (pl. két üres vödröt, ami megmarad), a `catalystMap` csak az elsőt jegyzi fel, a felület pedig fixen 1-et ír ki. Ha több géphez ugyanaz az eszköz kell, szintén csak 1 darabot ír ki, hiába fut a két gép párhuzamosan. A `gtceu:programmed_circuit` esetén ez ráadásul azért trükkös, mert az `amount` ott a konfigurációs számot jelenti.
- **Megoldás:** Érdemes lenne a `catalystMap`-ben a `Math.max(existing.amount, input.amount)` logikát használni (hogy a legmagasabb követelmény meglegyen), a `ShoppingList.tsx`-ben pedig ezt a maximum értéket kiírni a fix `1` helyett (kivéve a `gtceu:programmed_circuit` esetén, ahol valóban 1 kell, és az `amount` a konfiguráció).

## 5. Secondary Output (Melléktermék) felhasználásának blokkolása (`CraftingCanvas.tsx`)
**Kritikusság: ALACSONY / TERVEZÉSI DÖNTÉS**
- **Jelenség:** Ha egy gép főterméke az "A" elem, de gyárt "B" mellékterméket is, a felhasználó nem tudja bekötni a gép kimenetét egy másik gép "B" bemenetére.
- **Logikai hiba:** Az `isValidConnection` szigorúan csak a `sourceNode.data.itemId` értékét ellenőrzi, ami mindig a főtermék. Így a melléktermékeket a fa nem tudja láncba kötni.
- **Megoldás:** Ha a rendszer jövőbeli célja a melléktermékek felhasználása, a `sourceHandle`-nek és az `isValidConnection`-nek támogatnia kell a `data.outputs` tömb összes elemét, nem csak a fő `itemId`-t.
