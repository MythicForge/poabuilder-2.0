import React from 'react';
import { Circle, CircleDot } from 'lucide-react';
import type { ComputedChar, StoredChar } from '../core/types';

interface Props { c: ComputedChar }

export function LeftRail5e({ c }: Props) {
  const abilities = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  return (
    <>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Ability Scores</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', color: 'var(--text-faint)' }}>
            PROF <span style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--gold)', letterSpacing: 0 }}>+{c.proficiencyBonus}</span>
          </div>
        </div>
        <div className="ability-unified-grid">
          {abilities.map(k => {
            const a = c.abilities[k];
            return (
              <div className={`ability-cell${a.prof ? ' save-prof' : ''}`} key={k}>
                <div className="ac-abbr">{k}</div>
                <div className="ac-mod">{a.mod >= 0 ? `+${a.mod}` : a.mod}</div>
                <div className="ac-score-row">
                  <span className="ac-score-num">{a.score}</span>
                  <span className="ac-score-lbl">score</span>
                </div>
                <div className="ac-save">
                  <div className="ac-save-tag">
                    <span className="ac-box"></span>
                    <span className="ac-save-name">Save</span>
                  </div>
                  <span className="ac-save-val">{a.save >= 0 ? `+${a.save}` : a.save}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Proficiencies</div>
        </div>
        <div className="lang-block">
          <div className="l">Armor</div>
          <div className="v">{c.proficiencies.armor || '—'}</div>
        </div>
        <div className="lang-block">
          <div className="l">Weapons</div>
          <div className="v">{c.proficiencies.weapons || '—'}</div>
        </div>
        {c.proficiencies.tools && (
          <div className="lang-block">
            <div className="l">Tools</div>
            <div className="v">{c.proficiencies.tools}</div>
          </div>
        )}
        {c.proficiencies.languages && (
          <div className="lang-block">
            <div className="l">Languages</div>
            <div className="v">{c.proficiencies.languages}</div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Senses</div>
        </div>
        <div className="kv-list">
          <div className="kv"><span className="k">Passive Perception</span><span className="v">{c.passive.perception}</span></div>
          <div className="kv"><span className="k">Passive Investigation</span><span className="v">{c.passive.investigation}</span></div>
          <div className="kv"><span className="k">Passive Insight</span><span className="v">{c.passive.insight}</span></div>
        </div>
        <div className="lang-block">
          <div className="l">Special</div>
          <div className="v">{c.senses}</div>
        </div>
        {c.damageResistances.length > 0 && (
          <div className="lang-block">
            <div className="l">Resistances</div>
            <div className="v">{c.damageResistances.join(', ')}</div>
          </div>
        )}
      </div>

    </>
  );
}

interface RightRailProps {
  c: ComputedChar;
  stored: StoredChar;
  setStored: React.Dispatch<React.SetStateAction<StoredChar>>;
}

export function RightRail5e({ c, stored: _stored, setStored: _setStored }: RightRailProps) {
  return (
    <>
      <div className="card" style={{ paddingBottom: 10 }}>
        <div className="card-header">
          <div className="card-title">Skills</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', color: 'var(--text-faint)' }}>
            PROF <span style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--gold)', letterSpacing: 0 }}>+{c.proficiencyBonus}</span>
          </div>
        </div>
        <div className="sk-list">
          {c.skills.map(s => {
            const tier = s.prof === 'expert' ? 'exp' : s.prof === 'prof' ? 'prof' : '';
            return (
              <div className={`sk-row${tier ? ' ' + tier : ''}`} key={s.name}>
                <span className="sk-mark">{tier === 'exp' ? <CircleDot size={13} strokeWidth={1.6} /> : <Circle size={13} strokeWidth={1.6} />}</span>
                <span className="sk-name">{s.name}</span>
                <span className="sk-abil">{s.abil}</span>
                <span className="sk-total">{s.mod >= 0 ? `+${s.mod}` : s.mod}</span>
              </div>
            );
          })}
        </div>
        <div className="sk-foot">
          <span className="sk-key"><Circle size={11} strokeWidth={1.6} />Proficient</span>
          <span className="sk-key sk-key-exp"><CircleDot size={11} strokeWidth={1.6} />Expertise</span>
        </div>
        {c.jackOfAllTrades && (
          <div style={{ padding: '6px 6px 2px', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-faint)', borderTop: '1px solid var(--border-soft)', marginTop: 6 }}>
            JACK OF ALL TRADES · +{Math.floor(c.proficiencyBonus / 2)} to untrained
          </div>
        )}
      </div>
    </>
  );
}

