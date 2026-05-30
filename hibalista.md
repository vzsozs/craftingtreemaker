\# CraftingTreeMaker – Kód Audit \& Hibalista



> \*\*Vizsgálat dátuma:\*\* 2026-05-30  

> \*\*Vizsgált fájlok:\*\* importKubejs.ts, schema.ts, db/index.ts, drizzle.config.ts, route.ts (items+recipes), CraftingCanvas.tsx, MachineNode.tsx, RecipePickerModal.tsx, ShoppingList.tsx, NoteEditorModal.tsx, IconImage.tsx, batchCalc.ts, package.json  

> \*\*Dump fájlok mintavételezve:\*\* added\_recipes/gtceu (4,074 fájl) + recipes (102,412 fájl) + added\_recipes összesen (32,493 fájl)



\---



\## 🔴 KRITIKUS HIBÁK (azonnal javítandó)



\### H-01 – Séma vs. Driver ütközés: `pgTable` + PostgreSQL driver (SQLite vs. PG zavar)

\*\*Fájlok:\*\* `src/db/schema.ts`, `src/db/index.ts`



A séma `pgTable`-t importál (`drizzle-orm/pg-core`), a `db/index.ts` PostgreSQL `Pool`-t (`drizzle-orm/node-postgres`) használ, és a `drizzle.config.ts` dialect is `postgresql`. Viszont a `folyamatok.md` végig SQLite-ot (`sqlite.db`) említ. Ez azt jelenti a kód jelenleg PostgreSQL-t használ (valószínűleg Dockerben), de ha a Docker leáll, az egész app meghal. Nincs dokumentálva ez a döntés, a `README.md` és `folyamatok.md` félrevezető.



\*\*Javítás:\*\* Döntsd el: SQLite vagy PostgreSQL. Ha PostgreSQL marad, frissítsd a dokumentációt és írd le a Docker előfeltételt.



\---



\### H-02 – Recipes API: TELJES TÁBLA betöltés minden kérésnél

\*\*Fájl:\*\* `src/app/api/recipes/route.ts` (16–21. sor)



```typescript

// PROBLÉMA: az egész recipes táblát tölti be memóriába minden egyes kérésnél!

const allRecipes = await db.select().from(recipes);

const matching = allRecipes.filter((r) =>

&#x20; r.outputs.some((o) => o.itemId === itemId)

);

