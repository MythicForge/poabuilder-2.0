// Sheet shell: char-bar on top, 3-column layout (left rail / center / right
// rail), stat cards + vitals + tabs in the center. Two-layer state: `stored`
// is the only mutable state; `c` is recomputed each change and auto-saved.

import { useEffect, useMemo, useState } from "react";
import "../shared/styles.css";
import { REGISTRY } from "../core/data-registry.ts";
import { computeCharacter } from "../core/compute.ts";
import { CharStorage } from "../core/storage.ts";
import type { StoredCharacter } from "../core/types.ts";
import { Icon, StatCard } from "../shared/primitives.tsx";
import { CharBar } from "./char-bar.tsx";
import { LeftRail } from "./left-rail.tsx";
import { RightRail } from "./right-rail.tsx";
import { VitalityCard, WoundsAmbitionRest } from "./vitals.tsx";
import { CombatTab } from "../tabs/combat-tab.tsx";
import { FeatsTab } from "../tabs/feats-tab.tsx";
import { SpellsTab } from "../tabs/spells-tab.tsx";
import { InventoryTab } from "../tabs/inventory-tab.tsx";
import { NotesTab } from "../tabs/notes-tab.tsx";
import brenFixture from "@data/characters/fixture-bren-tier2-fighter.json";

const TABS = [
  { id: "combat", label: "Combat", icon: "swords" },
  { id: "feats", label: "Feats", icon: "star" },
  { id: "spells", label: "Spells", icon: "spellcasting" },
  { id: "inventory", label: "Inventory", icon: "inventory" },
  { id: "notes", label: "Notes", icon: "note" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function loadInitial(): StoredCharacter {
  const fixture = brenFixture as unknown as StoredCharacter;
  const activeId = CharStorage.activeId();
  const char = (activeId ? CharStorage.get(activeId) : null)
    ?? CharStorage.get(fixture.id) // fixture edits persist under its own id
    ?? fixture;
  CharStorage.setActive(char.id);
  return char;
}

export function App() {
  const [stored, setStoredRaw] = useState<StoredCharacter>(loadInitial);
  const [tab, setTab] = useState<TabId>("combat");

  useEffect(() => {
    CharStorage.save(stored);
  }, [stored]);

  const setStored = (fn: (s: StoredCharacter) => StoredCharacter) => setStoredRaw(fn);
  const c = useMemo(() => computeCharacter(stored, REGISTRY), [stored]);

  const props = { c, stored, setStored };

  return (
    <div className="sheet">
      <CharBar {...props} />

      <div className="layout">
        <div className="col">
          <LeftRail {...props} />
        </div>

        <div className="col">
          <div className="stat-row">
            <StatCard
              icon={<Icon kind="shield" size={11} />}
              label="Armor"
              value={c.defenses.Armor}
              sub={c.defenseBreakdown.Armor[0]?.split(":")[0] ?? ""}
            />
            <StatCard
              icon={<Icon kind="dice" size={11} />}
              label="Ambition Die"
              value={c.ambition.die}
              sub={`pool ${c.ambition.current}/${c.ambition.max}`}
            />
            {c.spellcasting ? (
              <StatCard
                icon={<Icon kind="spellcasting" size={11} />}
                label="Spell DC"
                value={c.spellcasting.spellDC}
                sub={`${c.spellcasting.modifier} ${c.spellcasting.modifierValue}`}
              />
            ) : (
              <StatCard
                icon={<Icon kind="skull" size={11} />}
                label="Wound Threshold"
                value={c.wounds.max}
                sub={`${c.wounds.current} taken`}
              />
            )}
            <StatCard
              icon={<Icon kind="weight" size={11} />}
              label="Carry"
              value={`${c.carry.used}/${c.carry.capacity}`}
              sub={c.carry.used > c.carry.capacity ? "OVER CAPACITY" : "slot weight"}
              valueClass={c.carry.used > c.carry.capacity ? "danger" : ""}
            />
          </div>

          <div className="center-vitals">
            <div>
              <VitalityCard {...props} />
            </div>
            <div className="center-vitals-col">
              <WoundsAmbitionRest {...props} />
            </div>
          </div>

          <div>
            <div className="tabs">
              {TABS.map((t) => (
                <button key={t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
                  <span className="ic"><Icon kind={t.icon} size={11} /></span>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              {tab === "combat" && <CombatTab {...props} />}
              {tab === "feats" && <FeatsTab {...props} />}
              {tab === "spells" && <SpellsTab {...props} />}
              {tab === "inventory" && <InventoryTab {...props} />}
              {tab === "notes" && <NotesTab {...props} />}
            </div>
          </div>

          {c.warnings.length > 0 && (
            <div className="card" style={{ borderColor: "var(--danger)", marginTop: 12 }}>
              <div className="card-title" style={{ color: "var(--danger)" }}>Data warnings</div>
              <pre style={{ fontSize: 10, whiteSpace: "pre-wrap" }}>{c.warnings.join("\n")}</pre>
            </div>
          )}
        </div>

        <div className="col">
          <RightRail {...props} />
        </div>
      </div>
    </div>
  );
}
