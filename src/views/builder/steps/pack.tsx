import { REGISTRY } from "../../../core/data-registry.ts";
import { inventoryCustom, inventoryFromCatalog, matchItem, resolvePack, type PackLine } from "../../../core/pack-mapping.ts";
import type { InventoryItem } from "../../../core/types.ts";
import type { StepProps } from "../step.ts";

// Turns the profession + origin pack manifests into inventory. Category tokens
// become dropdowns, named entries auto-resolve (or free-text), choice groups
// pick N. Everything writes draft.inventory.items keyed by a stable line id.

export function PackStep({ draft, update }: StepProps) {
  const prof = REGISTRY.professions.get(draft.build.profession_id);
  const origin = REGISTRY.origins.get(draft.build.origin_id);
  const { lines, currency } = resolvePack(prof, origin, REGISTRY);
  const items = draft.inventory.items;
  const byId = new Map(items.map((i) => [i.id, i]));

  const upsert = (item: InventoryItem) =>
    update((d) => {
      const i = d.inventory.items.findIndex((x) => x.id === item.id);
      if (i >= 0) d.inventory.items[i] = item;
      else d.inventory.items.push(item);
    });
  const removeItem = (id: string) => update((d) => { d.inventory.items = d.inventory.items.filter((x) => x.id !== id); });
  const setQty = (id: string, q: number) => update((d) => {
    const it = d.inventory.items.find((x) => x.id === id);
    if (it) it.quantity = Math.max(1, q);
  });

  const makeItem = (id: string, catalogId: string | null, name: string): InventoryItem => {
    const base = catalogId ? inventoryFromCatalog(catalogId, name, REGISTRY) : inventoryCustom(name);
    base.id = id;
    return base;
  };

  const bySource = new Map<string, PackLine[]>();
  for (const l of lines) (bySource.get(l.source) ?? bySource.set(l.source, []).get(l.source)!).push(l);

  const anyCurrency = currency.gold || currency.silver || currency.copper;

  return (
    <div>
      {lines.length === 0 && <div className="bld-empty">Pick a profession and origin to see their starting gear.</div>}

      {[...bySource].map(([source, group]) => (
        <div key={source} style={{ marginBottom: 20 }}>
          <div className="bld-field-label">{source}</div>
          {group.map((line) => {
            if (line.kind === "category") {
              const cur = byId.get(`pack:${line.id}`);
              return (
                <div className="bld-pack-row" key={line.id}>
                  <span className="bld-pack-slot">{line.label}</span>
                  <select
                    className="bld-select"
                    value={cur?.catalog_item_id ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) removeItem(`pack:${line.id}`);
                      else upsert(makeItem(`pack:${line.id}`, v, line.options.find((o) => o.id === v)?.name ?? v));
                    }}
                  >
                    <option value="">— choose —</option>
                    {line.options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              );
            }
            if (line.kind === "choice") {
              const chosen = line.from.filter((_, i) => byId.has(`pack:${line.id}:${i}`));
              return (
                <div className="bld-pack-row bld-pack-row--wrap" key={line.id}>
                  <span className="bld-pack-slot">{line.label}</span>
                  <div className="bld-chip-row">
                    {line.from.map((name, i) => {
                      const key = `pack:${line.id}:${i}`;
                      const on = byId.has(key);
                      const atLimit = !on && chosen.length >= line.count;
                      return (
                        <button
                          key={key}
                          className={`bld-chip${on ? " bld-chip--on" : ""}`}
                          disabled={atLimit}
                          onClick={() => {
                            if (on) removeItem(key);
                            else {
                              const m = matchItem(name, REGISTRY);
                              upsert(makeItem(key, m?.id ?? null, m?.name ?? name));
                            }
                          }}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }
            // item line
            const key = `pack:${line.id}`;
            const on = byId.has(key);
            return (
              <div className="bld-pack-row" key={line.id}>
                <span className="bld-pack-slot" style={{ opacity: line.catalogId ? 1 : 0.7 }}>
                  {line.label}{line.catalogId ? "" : " (custom)"}
                </span>
                <button
                  className={`bld-btn${on ? " bld-btn--gold" : ""}`}
                  onClick={() => (on ? removeItem(key) : upsert(makeItem(key, line.catalogId, line.label)))}
                >
                  {on ? "Added ✓" : "Add"}
                </button>
              </div>
            );
          })}
        </div>
      ))}

      {anyCurrency ? (
        <div className="bld-pack-row">
          <span className="bld-pack-slot">
            Starting currency: {currency.gold}g{currency.silver ? ` ${currency.silver}s` : ""}{currency.copper ? ` ${currency.copper}c` : ""}
          </span>
          <button className="bld-btn" onClick={() => update((d) => { d.inventory.currency = { ...currency }; })}>Apply</button>
        </div>
      ) : null}

      <div className="bld-field-label" style={{ marginTop: 26 }}>Inventory ({items.length})</div>
      {items.length === 0 ? (
        <div className="bld-empty">Nothing added yet.</div>
      ) : (
        items.map((it) => (
          <div className="bld-pack-row" key={it.id}>
            <span className="bld-pack-slot" style={{ flex: 1 }}>{it.name}{it.catalog_item_id ? "" : " · custom"}</span>
            <span className="bld-stepper">
              <button onClick={() => setQty(it.id, it.quantity - 1)}>−</button>
              <span className="bld-stepper-val" style={{ fontSize: 16, minWidth: 26 }}>{it.quantity}</span>
              <button onClick={() => setQty(it.id, it.quantity + 1)}>+</button>
            </span>
            <button className="bld-btn" onClick={() => removeItem(it.id)}>Remove</button>
          </div>
        ))
      )}
    </div>
  );
}
