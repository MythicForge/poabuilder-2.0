"use client";

/**
 * CombatTab — equipped gear summary, attack/defense readout, and the
 * active-conditions tracker (stacking-condition counters).
 *
 * Extracted from CharacterSheet.renderCombatTab() (REFACTOR_PLAN R5).
 * The conditions-card collapse toggle is tab-local. Equipped-slot items and
 * total attributes are computed in CharacterSheet and passed as props; the
 * persisted condition counts live on the character via `persist`.
 */
import type {
  Character,
  InventoryItem,
  AttributeKey,
} from "@/lib/characterTypes";

/** Signed attribute/mod formatter (+3 / -1). */
const fmtAttr = (v: number) => (v >= 0 ? `+${v}` : String(v));

interface CombatTabProps {
  c: Character;
  persist: (patch: Partial<Character>) => void;
  equippedMain: InventoryItem | null;
  equippedOff: InventoryItem | null;
  equippedTwoHands: InventoryItem | null;
  equippedBody: InventoryItem | null;
  attrs: Record<AttributeKey, number>;
}

export default function CombatTab({
  c,
  persist,
  equippedMain,
  equippedOff,
  equippedTwoHands,
  equippedBody,
  attrs,
}: CombatTabProps) {
  const equippedSlots: { label: string; item: typeof equippedMain }[] = [
    { label: "Main Hand", item: equippedMain },
    { label: "Two Hands", item: equippedTwoHands },
    { label: "Off Hand", item: equippedOff },
    { label: "Body", item: equippedBody },
  ];

  const cardStyle: React.CSSProperties = {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    marginBottom: "14px",
    overflow: "hidden",
  };
  const headStyle: React.CSSProperties = {
    padding: "8px 14px",
    borderBottom: "1px solid var(--border)",
    backgroundColor: "var(--bg-nav)",
    fontSize: "10px",
    fontFamily: "var(--font-mono)",
    letterSpacing: "0.16em",
    textTransform: "uppercase" as const,
    color: "var(--text-muted)",
  };

  return (
    <>
      {/* ── Equipped Gear ── */}
      <div style={cardStyle}>
        <div style={headStyle}>Equipped Gear</div>
        <div style={{ padding: "4px 0" }}>
          {equippedSlots.map(({ label, item }) => {
            if (!item) {
              return (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "8px 14px",
                    borderBottom: "1px solid var(--border)",
                    opacity: 0.35,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase" as const,
                      color: "var(--text-muted)",
                      minWidth: "72px",
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "13px",
                      fontStyle: "italic",
                      color: "var(--text-muted)",
                    }}
                  >
                    — empty —
                  </span>
                </div>
              );
            }
            const isWeapon = item.category === "Weapon";
            const isArmor = item.category === "Armor";
            const isShield = item.category === "Shield";
            const modKey = item.modifierStat ?? "brawn";
            const toHitMod = attrs[modKey] + (item.masterworkBonus ?? 0);
            const dmgStr =
              item.damageDiceCount > 0
                ? `${item.damageDiceCount}d${item.damageDiceSize}`
                : null;
            const typeStr = item.damageTypeTags.join(" / ");
            const shieldPool = item.reductionPoolCurrent ?? null;
            const shieldMax = item.reductionPoolMax ?? null;
            return (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "9px 14px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase" as const,
                    color: "var(--text-muted)",
                    minWidth: "72px",
                    flexShrink: 0,
                  }}
                >
                  {label}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "var(--text)",
                      marginBottom: "2px",
                    }}
                  >
                    {item.name}
                    {item.masterworkBonus > 0 && (
                      <span
                        style={{
                          fontSize: "10px",
                          color: "var(--primary)",
                          marginLeft: "5px",
                        }}
                      >
                        +{item.masterworkBonus}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap" as const,
                      alignItems: "center",
                    }}
                  >
                    {isWeapon && dmgStr && (
                      <>
                        <span
                          style={{
                            fontSize: "11px",
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {fmtAttr(toHitMod)} to hit
                        </span>
                        <span
                          style={{ fontSize: "10px", color: "var(--border)" }}
                        >
                          ·
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            fontFamily: "var(--font-mono)",
                            color: "var(--text)",
                          }}
                        >
                          {dmgStr}
                          {fmtAttr(attrs[modKey])}
                        </span>
                        {typeStr && (
                          <span
                            style={{
                              fontSize: "10px",
                              fontFamily: "var(--font-heading)",
                              color: "var(--text-muted)",
                              textTransform: "capitalize" as const,
                            }}
                          >
                            {typeStr}
                          </span>
                        )}
                      </>
                    )}
                    {isArmor && (
                      <>
                        <span
                          style={{
                            fontSize: "11px",
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-muted)",
                          }}
                        >
                          +{item.armorBonus} armor
                        </span>
                        {item.armorCategory && (
                          <span
                            style={{
                              fontSize: "10px",
                              fontFamily: "var(--font-heading)",
                              color: "var(--text-muted)",
                            }}
                          >
                            {item.armorCategory}
                          </span>
                        )}
                      </>
                    )}
                    {isShield && shieldPool != null && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontFamily: "var(--font-mono)",
                          color:
                            shieldPool === 0
                              ? "var(--fail)"
                              : "var(--text-muted)",
                        }}
                      >
                        Pool {shieldPool}/{shieldMax}
                        {shieldPool === 0 ? " (broken)" : ""}
                      </span>
                    )}
                    {item.traits.length > 0 &&
                      item.traits.map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: "9px",
                            padding: "1px 6px",
                            border: "1px solid var(--border)",
                            borderRadius: "9999px",
                            color: "var(--text-muted)",
                            fontFamily: "var(--font-heading)",
                            textTransform: "capitalize" as const,
                          }}
                        >
                          {t}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </>
  );
}
