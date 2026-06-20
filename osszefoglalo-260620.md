# CraftingTreeMaker – Összefoglaló és Fejlesztési Terv (2026-06-20)

## A projekt jelenlegi állapota

A CraftingTreeMaker egy interaktív gyártási fa tervező, amely a TerraFirmaGreg / GTCEu modpackekhez készült. Next.js + ReactFlow alapon épül, PostgreSQL adatbázissal (134k+ recept, 27k+ termék). Az alkalmazás alapvető funkciói stabilan működnek: node-alapú fa felépítése, recept választó modal, manuális lezárás (in-stock), export funkció.

---

## 1. Elvégzett Feladatok (2026-06-20)

### ✅ Bug #4 – Katalizeátor mennyiség fix
**Fájl:** `src/components/ShoppingList.tsx`

A katalizeátor-soroknál korábban `amount: 1` volt hardkódolva. Javítva: mostantól az adatbázisból jövő (`Math.max` összesített) valódi értéket mutatja.
```diff
- <EntryRow key={e.itemId} entry={{ ...e, amount: 1 }} />
+ <EntryRow key={e.itemId} entry={e} />
```

---

### ✅ Fejlesztés A – Target Item ikon a bal panelen
**Fájl:** `src/components/CraftingCanvas.tsx`

- A bal panel **300px** széles lett (volt 260px)
- A "Target Item" szekció mostantól egy 40×40px-es item-ikont, a zöld nevet, az item ID-t, és egy piros hover-ű ✕ gombot tartalmaz
- Az ikon border-e az item típusához igazodik (szürke/kék/lila)
- Az `IconImage` import hozzáadva a `CraftingCanvas.tsx`-hez

---

### ✅ Fejlesztés A+ – Keresési dropdown fejlesztés
**Fájl:** `src/components/CraftingCanvas.tsx`

- **32 elem** max (volt 12)
- **2 oszlopos grid** elrendezés
- Minden elemnél **32×32px item-ikon** + név + ID
- A dropdown `position: absolute`, magasabb (380px), lebegő, árnyékkal
- Gördíthető, sötét háttér

---

### ✅ Fejlesztés B/1 – Materials fül rendezése
**Fájlok:** `src/lib/batchCalc.ts`, `src/components/ShoppingList.tsx`

**A `buildShoppingList` kibővítve:** Mostantól az `edges`-t is megkapja, és **minden be nem kötött input slotot** (ahol a felhasználó még nem kattintott a `+`-ra) raw material-ként jelez, a helyes (`batchMultiplier`-rel felszorozott) mennyiséggel.

**A Materials fül:**
- **📦 Raw Materials** szekció **mindig látható** (ha üres: "✓ All inputs connected")
- **⚗️ Catalysts** szekció csak ha van katalizeátor
- Szekciófejlécek: emoji + darabszám badge

---

## 2. Nyitott Bugok (még nem javítva)

### Bug #1 – DAG Node törlési hiba
**Kritikusság: MAGAS** | Fájl: `src/components/CraftingCanvas.tsx` (38–57. sorok)

Ha egy közös alapanyag-node-ot (pl. rézpor) több szülő is felhasznál, és az egyik szülő receptjét lecseréljük, a `collectSubtree` hibásan törölheti a rézport. Részben javítva, de tesztelés szükséges.

### Bug #3 – Duplikált kulcsok az import scriptben
**Kritikusság: KÖZEPES** | Fájl: `importKubejs.ts` — Csak importáláskor releváns, az éles UI-t nem érinti.

### Bug #5 – Secondary Output (melléktermék) nem köthető be
**Kritikusság: ALACSONY / Tervezési döntés** | Fájl: `src/components/CraftingCanvas.tsx` — Külön tervezést igényel.

### Bug #2 – Backspace/Delete szinkronizáció
**Állapot: JAVÍTVA** — Felhasználó megerősítette, hogy működik.

---

## 3. Kész Prioritási Lista

| # | Feladat | Állapot |
|---|---------|---------|
| 1 | Bug #4 – katalizeátor amount fix | ✅ Kész |
| 2 | Fejlesztés A – Target item ikon bal panelen | ✅ Kész |
| 2+ | Dropdown fejlesztés (ikon, 32 elem, 2 oszlop) | ✅ Kész |
| 3 | Fejlesztés B/1 – Materials fül rendezése | ✅ Kész |
| 4 | Fejlesztés B/2 – Pipeline fa-diagram + lebegő panel | ⏳ Következő |
| 5 | Bug #1 – DAG törlési tesztelés | ⏳ Tesztelendő |
| 6 | Bug #3 – import script duplikáció | ⏳ Alacsony prioritás |
| 7 | Bug #5 – melléktermék bekötés | ⏳ Tervezési döntés |

---

## 4. Megvalósítási Terv – Pipeline fa-diagram + lebegő, átméretezhető panel

### Cél

A jelenlegi jobb oldali "Materials & Equipment" panel **Pipeline** fülét teljesen meg kell újítani:
- A jelenlegi szöveg-alapú, lépésszámos kártya-listát egy **vizuális fa-diagram** váltja fel
- A panel **lebegő és átméretezhető** lesz (drag to resize, vagy drag to float)

---

### A. A jobb oldali panel lebegővé tétele

**Fájl:** `src/components/CraftingCanvas.tsx`

**Jelenlegi állapot:** A `ShoppingList` egy `width: 256` fix szélességű `<div>`-ben ül a `CraftingCanvas` jobb oldalán, a flex layout részeként.

**Cél:** A panel legyen egy lebegő, átméretezhető ablak a canvas felett.

#### Implementációs lépések:

1. **Távolítsd el a jobb oldali fix div-et** a flex layoutból:
```tsx
// TÖRLENDŐ ez a rész CraftingCanvas.tsx-ből:
{/* ── Shopping List ─────────────────────────────────────────────────── */}
<div style={{ width: 256, flexShrink: 0 }}>
  <ShoppingList ... />
</div>
```

2. **Helyette adj hozzá egy lebegő panel state-et:**
```tsx
const [panelPos, setPanelPos] = useState({ x: window.innerWidth - 320, y: 60 });
const [panelSize, setPanelSize] = useState({ w: 300, h: 600 });
const [isDragging, setIsDragging] = useState(false);
const dragOffset = useRef({ x: 0, y: 0 });
```

3. **A lebegő panel JSX** (a ReactFlow canvas container-en belül, `position: absolute`):
```tsx
<div
  style={{
    position: "absolute",
    top: panelPos.y,
    left: panelPos.x,
    width: panelSize.w,
    height: panelSize.h,
    zIndex: 50,
    background: "#181818",
    border: "1px solid #2d2d2d",
    borderRadius: 10,
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    resize: "both",       // natív browser resize handle
    minWidth: 240,
    minHeight: 300,
  }}
>
  {/* Drag handle – a panel fejléce */}
  <div
    style={{ cursor: "grab", padding: "8px 12px", background: "#1e1e1e", borderBottom: "1px solid #2d2d2d", userSelect: "none" }}
    onMouseDown={(e) => {
      setIsDragging(true);
      dragOffset.current = { x: e.clientX - panelPos.x, y: e.clientY - panelPos.y };
    }}
  >
    🛠️ Materials & Equipment
  </div>
  {/* Panel tartalma */}
  <div style={{ flex: 1, overflow: "hidden" }}>
    <ShoppingList ... />
  </div>
</div>
```

4. **Mouse event handlers** a canvas `<div>`-jén:
```tsx
onMouseMove={(e) => {
  if (isDragging) {
    setPanelPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
  }
}}
onMouseUp={() => setIsDragging(false)}
```

> **Fontos:** A `resize: "both"` CSS property a böngésző natív resize handle-jét adja. Ha az igényesebb megvalósítás szükséges, érdemes a `react-resizable` vagy egyszerűbb custom resize handle megközelítést alkalmazni (jobb sarkon fogóponttal).

---

### B. A Pipeline fül vizuális fa-diagrammá alakítása

**Fájl:** `src/components/ShoppingList.tsx`

**Jelenlegi állapot:** A Pipeline fülön (`activeTab === "equipment"`) a `sortedMachines` tömb elemei lépésszámos kártyákként jelennek meg, szöveges `↳ Step X` hivatkozásokkal.

**Cél:** Egy SVG-alapú vagy CSS-alapú fa-diagram, ahol:
- Minden gép egy vizuális "kártya-node"
- A kártyák között nyilak/vonalak mutatják az anyagáramlást
- A fa gyökere (végterméket gyártó gép) felül van, a levelek (alap alapanyagok) alul

#### Az adatstruktúra már megvan:

A `sortedMachines` (topológiai sorrend) és az `edges` prop-ok megadnak minden szükséges kapcsolatot. A fa felépítéséhez:

```ts
// Példa: szülő-gyerek kapcsolat meghatározása
// edges-ből: ha edge.target === mNode.id és edge.targetHandle === `input-${input.itemId}`
// akkor a source node (edge.source) a gyereke
const childrenOf = (nodeId: string) =>
  edges
    .filter(e => e.target === nodeId)
    .map(e => nodes.find(n => n.id === e.source))
    .filter(Boolean);
```

#### Implementációs javaslat – egyszerű CSS flexbox fa:

```tsx
// Rekurzív TreeNode komponens
function PipelineTreeNode({ mNode, depth, sortedMachines, edges, nodes }) {
  const children = edges
    .filter(e => e.target === mNode.id)
    .map(e => nodes.find(n => n.id === e.source))
    .filter(n => n && n.machineId !== null);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      {/* A gép kártyája */}
      <div style={{
        background: "#1e1e1e",
        border: "1px solid #282828",
        borderRadius: 8,
        padding: "6px 10px",
        minWidth: 120,
        maxWidth: 160,
        textAlign: "center",
      }}>
        <IconImage itemId={mNode.machineId} itemName={mNode.machineName} size={24} />
        <div style={{ color: "#fff", fontSize: 8, fontWeight: 700, marginTop: 2 }}>{mNode.machineName}</div>
        <div style={{ color: "#10b981", fontSize: 8 }}>→ {mNode.itemName} ×{formatAmount(mNode.requestedAmount)}</div>
      </div>

      {/* Gyerekek vízszintesen elosztva */}
      {children.length > 0 && (
        <>
          {/* Összekötő vonal lefelé */}
          <div style={{ width: 1, height: 12, background: "#3b82f6", opacity: 0.5 }} />
          <div style={{ display: "flex", gap: 8 }}>
            {children.map(child => (
              <PipelineTreeNode key={child.id} mNode={child} ... />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

#### A pipeline fül megjelenítése:

```tsx
{activeTab === "equipment" && (
  <div style={{ padding: "12px 8px", overflowX: "auto", overflowY: "auto" }}>
    {/* A fa gyökere a rootNode (node-root) gyereke, vagyis a legfelső gép */}
    {(() => {
      const rootMachine = sortedMachines[sortedMachines.length - 1]; // a topológiai sorrend utolsója = legfelső
      if (!rootMachine) return <div style={{ color: "#444", fontSize: 9, textAlign: "center" }}>No machines</div>;
      return <PipelineTreeNode mNode={rootMachine} depth={0} sortedMachines={sortedMachines} edges={edges} nodes={nodes} />;
    })()}
  </div>
)}
```

> **Megjegyzés a sortedMachines sorrendjéről:** A jelenlegi topológiai rendezés az alaptól (child) a végterméken (parent) át megy. Tehát `sortedMachines[sortedMachines.length - 1]` a legfelső (végterméket gyártó) gép, ami a fa gyökere.

---

### C. Összekötő vonalak SVG-vel (opcionális, szebb megoldás)

Ha a CSS megközelítés nem elég rugalmas (pl. görbített összekötők), érdemes SVG overlay-t alkalmazni:

```tsx
// Minden összekötőhöz: mérd meg a két elem DOM pozícióját (useRef + getBoundingClientRect)
// majd rajzolj SVG path-ot (cubic bezier):
const path = `M ${x1} ${y1} C ${x1} ${(y1+y2)/2}, ${x2} ${(y1+y2)/2}, ${x2} ${y2}`;
<svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
  <path d={path} stroke="#3b82f6" strokeWidth="1.5" fill="none" opacity="0.5" />
</svg>
```

---

### D. ShoppingList props frissítés

A `ShoppingList` komponensnek szüksége lesz az `edges` és a `nodes`-ra – ezek **már megvannak** a props között (a B/1 fejlesztés során az `edges` prop már átadásra kerül). A `TreeNodeData[]`-t is megkapja `nodes` névvel.

---

### Összefoglaló – mit kell módosítani

| Fájl | Változtatás |
|------|-------------|
| `src/components/CraftingCanvas.tsx` | Jobb oldali fix panel eltávolítása; lebegő panel state + drag logika + `onMouseMove`/`onMouseUp` a canvas div-jén |
| `src/components/ShoppingList.tsx` | Pipeline fül teljes újraírása: rekurzív `PipelineTreeNode` komponens CSS flexbox fával; az összekötő vonalak lehetnek egyszerű div-ek vagy SVG path-ok |

> **Javaslat a másik AI-nak:** A `ShoppingList.tsx`-ben a Pipeline fül jelenleg a 313–499. sorok között van. Ezt a részt kell teljesen lecserélni. A `sortedMachines`, `edges`, és `nodes` (mint `TreeNodeData[]`) adatok már elérhetők a komponens scope-jában.
