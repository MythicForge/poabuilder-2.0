// Right rail: V.I.T.A.L.S. skills with rank marks + dice pools, favorites.

import { Circle, CircleDot, Star } from "lucide-react";
import type { ComputedCharacter, StoredCharacter } from "../core/types.ts";
import { REGISTRY } from "../core/data-registry.ts";

interface RightRailProps {
  c: ComputedCharacter;
  stored: StoredCharacter;
}

export function RightRail({ c, stored }: RightRailProps) {
  return (
    <>
      <div className="card" style={{ paddingBottom: 10 }}>
        <div className="card-header">
          <div className="card-title">V.I.T.A.L.S.</div>
        </div>
        <div className="sk-list">
          {c.skills.map((s) => {
            const tier = s.rank === "Master" || s.rank === "Expert" ? "exp" : s.rank === "Trained" ? "prof" : "";
            return (
              <div className={`sk-row${tier ? " " + tier : ""}`} key={s.skill} title={`${s.rank} — attribute ${s.attrValue}`}>
                <span className="sk-mark">
                  {tier === "exp" ? <CircleDot size={13} strokeWidth={1.6} /> : <Circle size={13} strokeWidth={1.6} />}
                </span>
                <span className="sk-name">{s.skill}</span>
                <span className="sk-abil">{s.rank === "Untrained" ? "" : s.rank.slice(0, 3).toUpperCase()}</span>
                <span className="sk-total">{s.display}</span>
              </div>
            );
          })}
        </div>
        <div className="sk-foot">
          <span className="sk-key"><Circle size={11} strokeWidth={1.6} />Trained</span>
          <span className="sk-key sk-key-exp"><CircleDot size={11} strokeWidth={1.6} />Expert+</span>
        </div>
      </div>

      {stored.play.favorites.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Favorites</div>
          </div>
          <div className="kv-list">
            {stored.play.favorites.map((f) => {
              const name =
                f.type === "spell" ? REGISTRY.spells.get(f.id)?.name
                : f.type === "item" ? REGISTRY.items.get(f.id)?.name
                : f.id;
              return (
                <div className="kv" key={`${f.type}:${f.id}`}>
                  <span className="k" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Star size={11} strokeWidth={1.6} /> {name ?? f.id}
                  </span>
                  <span className="v" style={{ textTransform: "uppercase", fontSize: 9 }}>{f.type}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
