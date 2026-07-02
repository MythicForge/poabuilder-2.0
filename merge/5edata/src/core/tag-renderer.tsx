import React from 'react';
import { REGISTRY, loadConditions } from './data-registry';

export interface RenderCtx {
  spellAttackBonus?: number;
  spellSaveDC?: number;
}

const SCHOOL_FULL: Record<string, string> = {
  A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment',
  V: 'Evocation', I: 'Illusion', N: 'Necromancy', T: 'Transmutation',
};

const ATK_LABELS: Record<string, string> = {
  m: 'Melee Attack:', r: 'Ranged Attack:', g: 'Grapple Attack:',
  mw: 'Melee Weapon Attack:', rw: 'Ranged Weapon Attack:',
  ms: 'Melee Spell Attack:', rs: 'Ranged Spell Attack:',
};

const ATKR_LABELS: Record<string, string> = {
  m: 'Melee Attack Roll:', r: 'Ranged Attack Roll:',
  mw: 'Melee Weapon Attack Roll:', rw: 'Ranged Weapon Attack Roll:',
};

function quickDesc(entries: unknown[]): string {
  for (const e of entries) {
    if (typeof e === 'string' && e.trim()) {
      const text = e.replace(/\{@\w+ ([^|}\n]+)(?:\|[^}]*)?\}/g, '$1').replace(/\{@\w+[^}]*\}/g, '');
      const sentence = text.split('. ')[0];
      return sentence + (text.includes('. ') ? '.' : '');
    }
    if (e && typeof e === 'object') {
      const obj = e as Record<string, unknown>;
      if (Array.isArray(obj.items)) {
        const first = (obj.items as unknown[]).find((x) => typeof x === 'string') as string | undefined;
        if (first) {
          const text = first.replace(/\{@\w+ ([^|}\n]+)(?:\|[^}]*)?\}/g, '$1').replace(/\{@\w+[^}]*\}/g, '');
          const sentence = text.split('. ')[0];
          return sentence + (text.includes('. ') ? '.' : '');
        }
      }
      if (Array.isArray(obj.entries)) {
        const d = quickDesc(obj.entries as unknown[]);
        if (d) return d;
      }
    }
  }
  return '';
}

const tooltipCache = new Map<string, string>();

interface TagRefProps {
  type: string;
  name: string;
  source?: string;
}

function TagRef({ type, name }: TagRefProps) {
  const [show, setShow] = React.useState(false);
  const [tipText, setTipText] = React.useState<string | null>(null);

  const cacheKey = `${type}:${name.toLowerCase()}`;

  async function resolveTooltip() {
    if (tooltipCache.has(cacheKey)) {
      setTipText(tooltipCache.get(cacheKey)!);
      return;
    }

    let text = '';

    if (type === 'condition' || type === 'status') {
      const conditions = await loadConditions();
      const cond = (conditions as Array<{ name: string; entries?: unknown[] }>)
        .find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (cond?.entries) text = quickDesc(cond.entries);
    } else if (type === 'spell') {
      const spells = REGISTRY?.spells;
      if (spells) {
        const spell = spells.find((s) => s.name.toLowerCase() === name.toLowerCase());
        if (spell) {
          const levelStr = spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`;
          const school = SCHOOL_FULL[spell.school] ?? spell.school;
          text = `${levelStr} ${school}`;
        }
      }
    } else if (type === 'item') {
      const items = REGISTRY?.items;
      if (items) {
        const item = items.find((i) => i.name.toLowerCase() === name.toLowerCase());
        if (item) {
          text = [item.rarity && !['none', '', 'unknown'].includes(item.rarity) ? item.rarity : null, item.type]
            .filter(Boolean).join(' · ');
        }
      }
    } else if (type === 'skill') {
      const ability = REGISTRY?.skills?.[name];
      if (ability) text = `Skill (${ability.toUpperCase()})`;
    }

    tooltipCache.set(cacheKey, text);
    setTipText(text);
  }

  return (
    <span
      className={`tag-ref tag-ref-${type}`}
      onMouseEnter={() => { setShow(true); void resolveTooltip(); }}
      onMouseLeave={() => setShow(false)}
    >
      {name}
      {show && tipText ? <span className="tag-tooltip">{tipText}</span> : null}
    </span>
  );
}

function renderInlineTag(tag: string, rawContent: string, ctx: RenderCtx | undefined, key: number): React.ReactNode {
  const args = rawContent.trim().split('|').map((s) => s.trim());
  const text = args[0];
  const source = args[1];

  switch (tag) {
    case 'b':
    case 'bold':
      return <strong key={key}>{text}</strong>;
    case 'i':
    case 'italic':
      return <em key={key}>{text}</em>;
    case 's':
    case 'strike':
      return <s key={key}>{text}</s>;
    case 'u':
      return <u key={key}>{text}</u>;
    case 'color':
      return <span key={key} style={{ color: source }}>{text}</span>;
    case 'highlight':
      return <span key={key} className="tag-highlight">{text}</span>;
    case 'note':
      return <span key={key} className="tag-note">{text}</span>;
    case 'damage':
    case 'scaledamage':
      return <span key={key} className="tag-damage">{text}</span>;
    case 'dice':
    case 'scaledice':
    case 'd20':
      return <span key={key} className="tag-dice">{text}</span>;
    case 'dc':
      return <span key={key} className="tag-dc">DC {text}</span>;
    case 'hit': {
      const formatted = text.startsWith('+') || text.startsWith('-') ? text : `+${text}`;
      return <span key={key} className="tag-hit">{formatted}</span>;
    }
    case 'h':
      return <strong key={key}>Hit: </strong>;
    case 'atk':
      return <span key={key} className="tag-atk">{ATK_LABELS[text] ?? `${text.toUpperCase()} Attack:`}</span>;
    case 'atkr':
      return <span key={key} className="tag-atk">{ATKR_LABELS[text] ?? `${text.toUpperCase()} Attack Roll:`}</span>;
    case 'recharge':
      return <span key={key} className="tag-recharge">(Recharge {text}–6)</span>;
    case 'hitYourSpellAttack':
      if (ctx?.spellAttackBonus !== undefined) {
        const b = ctx.spellAttackBonus;
        return <span key={key} className="tag-hit">{b >= 0 ? `+${b}` : `${b}`}</span>;
      }
      return <span key={key} className="tag-hit">your spell attack bonus</span>;
    case 'dcYourSpellSave':
      if (ctx?.spellSaveDC !== undefined) {
        return <span key={key} className="tag-dc">DC {ctx.spellSaveDC}</span>;
      }
      return <span key={key} className="tag-dc">your spell save DC</span>;
    case 'condition':
    case 'status':
      return <TagRef key={key} type="condition" name={text} source={source} />;
    case 'spell':
      return <TagRef key={key} type="spell" name={text} source={source} />;
    case 'item':
      return <TagRef key={key} type="item" name={text} source={source} />;
    case 'feat':
      return <TagRef key={key} type="feat" name={text} source={source} />;
    case 'skill':
      return <TagRef key={key} type="skill" name={text} source={source} />;
    case 'action':
      return <TagRef key={key} type="action" name={text} source={source} />;
    case 'creature':
      return <TagRef key={key} type="creature" name={text} source={source} />;
    case 'class':
      return <TagRef key={key} type="class" name={text} source={source} />;
    case 'race':
      return <TagRef key={key} type="race" name={text} source={source} />;
    case 'background':
      return <TagRef key={key} type="background" name={text} source={source} />;
    case 'sense':
    case 'language':
    case 'variantrule':
    case 'itemMastery':
    case 'itemProperty':
    case 'ability':
      return <span key={key} className="tag-ref">{text}</span>;
    default:
      return text || null;
  }
}

export function renderTagStr(text: string, ctx?: RenderCtx): JSX.Element {
  const parts: React.ReactNode[] = [];
  const re = /\{@(\w+)((?:[^{}]|\{[^}]*\})*)\}/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    parts.push(renderInlineTag(match[1], match[2], ctx, idx++));
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }

  return <>{parts}</>;
}

export function renderEntries(entries: unknown[], ctx?: RenderCtx): JSX.Element {
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];

    if (typeof e === 'string' && e.trim()) {
      nodes.push(<p key={i} className="entries-p">{renderTagStr(e.trim(), ctx)}</p>);
      continue;
    }

    if (!e || typeof e !== 'object') continue;
    const obj = e as Record<string, unknown>;
    const type = obj.type as string | undefined;

    if (type === 'list') {
      const items = (obj.items as unknown[]) ?? [];
      nodes.push(
        <ul key={i} className="entries-list">
          {items.map((item, j) => {
            if (typeof item === 'string') {
              return <li key={j}>{renderTagStr(item, ctx)}</li>;
            }
            if (item && typeof item === 'object') {
              const io = item as Record<string, unknown>;
              if (io.type === 'item' && io.name) {
                return (
                  <li key={j}>
                    <strong>{renderTagStr(io.name as string, ctx)}: </strong>
                    {Array.isArray(io.entries) ? renderEntries(io.entries, ctx) : null}
                  </li>
                );
              }
              if (Array.isArray(io.entries)) {
                return <li key={j}>{renderEntries(io.entries, ctx)}</li>;
              }
            }
            return null;
          })}
        </ul>
      );
    } else if (type === 'entries' || type === 'section') {
      const name = obj.name as string | undefined;
      const sub = (obj.entries as unknown[]) ?? [];
      nodes.push(
        <div key={i} className="entries-block">
          {name && <p className="entries-name"><strong>{renderTagStr(name, ctx)}</strong></p>}
          {renderEntries(sub, ctx)}
        </div>
      );
    } else if (type === 'item') {
      const name = obj.name as string | undefined;
      const sub = (obj.entries as unknown[]) ?? [];
      nodes.push(
        <div key={i} className="entries-item-block">
          {name && <strong>{renderTagStr(name, ctx)}: </strong>}
          {renderEntries(sub, ctx)}
        </div>
      );
    } else if (type === 'table') {
      const caption = obj.caption as string | undefined;
      const colLabels = (obj.colLabels as string[] | undefined) ?? [];
      const rows = (obj.rows as unknown[][] | undefined) ?? [];
      nodes.push(
        <div key={i} className="entries-table-wrap">
          {caption && <p className="entries-table-caption">{renderTagStr(caption, ctx)}</p>}
          <table className="entries-table">
            {colLabels.length > 0 && (
              <thead>
                <tr>{colLabels.map((h, hi) => <th key={hi}>{renderTagStr(String(h), ctx)}</th>)}</tr>
              </thead>
            )}
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {(Array.isArray(row) ? row : [row]).map((cell, ci) => (
                    <td key={ci}>{typeof cell === 'string' ? renderTagStr(cell, ctx) : String(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } else if (type === 'inset' || type === 'insetReadaloud') {
      const name = obj.name as string | undefined;
      const sub = (obj.entries as unknown[]) ?? [];
      nodes.push(
        <div key={i} className="entries-inset">
          {name && <strong>{name}</strong>}
          {renderEntries(sub, ctx)}
        </div>
      );
    } else if ('entries' in obj) {
      const name = obj.name as string | undefined;
      const sub = (obj.entries as unknown[]) ?? [];
      if (name && type !== 'entries') {
        nodes.push(<p key={`${i}-name`}><strong>{renderTagStr(name, ctx)}</strong></p>);
      }
      nodes.push(<React.Fragment key={`${i}-sub`}>{renderEntries(sub, ctx)}</React.Fragment>);
    } else if ('items' in obj) {
      const items = (obj.items as unknown[]) ?? [];
      nodes.push(<React.Fragment key={i}>{renderEntries(items, ctx)}</React.Fragment>);
    }
  }

  return <>{nodes}</>;
}

export function stripTags(text: string, ctx?: RenderCtx): string {
  let result = text;
  if (ctx?.spellAttackBonus !== undefined) {
    result = result.replace(/\{@hitYourSpellAttack[^}]*\}/g, `+${ctx.spellAttackBonus}`);
  }
  if (ctx?.spellSaveDC !== undefined) {
    result = result.replace(/\{@dcYourSpellSave[^}]*\}/g, `DC ${ctx.spellSaveDC}`);
  }
  const ABIL_FULL: Record<string, string> = {
    str: 'Strength', dex: 'Dexterity', con: 'Constitution',
    int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
  };
  return result
    .replace(/\{@h\}/g, 'Hit: ')
    .replace(/\{@hit\s+(\d+)[^}]*\}/g, '+$1')
    .replace(/\{@atk\s+(\w+)[^}]*\}/g, (_, t: string) => ATK_LABELS[t] ?? `${t.toUpperCase()} Attack:`)
    .replace(/\{@atkr\s+(\w+)[^}]*\}/g, (_, t: string) => ATKR_LABELS[t] ?? `${t.toUpperCase()} Attack Roll:`)
    .replace(/\{@recharge\s+(\d+)[^}]*\}/g, '(Recharge $1–6)')
    .replace(/\{@recharge\}/g, '(Recharge 6)')
    .replace(/\{@dc\s+([^}]+)\}/g, 'DC $1')
    .replace(/\{@actSave\s+(\w+)[^}]*\}/g, (_, a: string) => `${ABIL_FULL[a] ?? a.toUpperCase()} Saving Throw:`)
    .replace(/\{@actSaveSuccessOrFail[^}]*\}/g, 'Failure or Success:')
    .replace(/\{@actSaveFail[^}]*\}/g, 'Failure:')
    .replace(/\{@actSaveSuccess[^}]*\}/g, 'Success:')
    .replace(/\{@actTrigger[^}]*\}/g, 'Trigger:')
    .replace(/\{@actResponse[^}]*\}/g, 'Response:')
    .replace(/\{@\w+\s+([^|}\n]+)(?:\|[^}]*)?\}/g, '$1')
    .replace(/\{@\w+[^}]*\}/g, '');
}

export function extractBlurb(entries: unknown[]): string {
  for (const e of entries) {
    if (typeof e === 'string' && e.trim()) return stripTags(e.trim());
    if (e && typeof e === 'object') {
      const obj = e as Record<string, unknown>;
      if (!obj.name && Array.isArray(obj.entries)) {
        const sub = extractBlurb(obj.entries as unknown[]);
        if (sub) return sub;
      }
      if (Array.isArray(obj.items)) {
        const sub = extractBlurb(obj.items as unknown[]);
        if (sub) return sub;
      }
    }
  }
  return '';
}
