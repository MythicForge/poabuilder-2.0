// localStorage roster (5edata pattern): full character array under poa_roster,
// active character id under poa_active.

import type { StoredCharacter } from "./types.ts";
import _template from "@data/shared/_character-template.json";

const ROSTER_KEY = "poa_roster";
const ACTIVE_KEY = "poa_active";

export const CharStorage = {
  loadAll(): StoredCharacter[] {
    try {
      const raw = localStorage.getItem(ROSTER_KEY);
      return raw ? (JSON.parse(raw) as StoredCharacter[]) : [];
    } catch {
      return [];
    }
  },

  saveAll(list: StoredCharacter[]): void {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(list));
  },

  get(id: string): StoredCharacter | null {
    return this.loadAll().find((c) => c.id === id) ?? null;
  },

  save(char: StoredCharacter): void {
    const list = this.loadAll();
    const i = list.findIndex((c) => c.id === char.id);
    char.updated_at = new Date().toISOString();
    if (i >= 0) list[i] = char;
    else list.push(char);
    this.saveAll(list);
  },

  remove(id: string): void {
    this.saveAll(this.loadAll().filter((c) => c.id !== id));
    if (this.activeId() === id) localStorage.removeItem(ACTIVE_KEY);
  },

  activeId(): string | null {
    return localStorage.getItem(ACTIVE_KEY);
  },

  setActive(id: string): void {
    localStorage.setItem(ACTIVE_KEY, id);
  },

  newFromTemplate(name: string): StoredCharacter {
    const c = structuredClone(_template) as unknown as StoredCharacter;
    c.id = `char-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    c.created_at = new Date().toISOString();
    c.updated_at = c.created_at;
    c.identity.name = name;
    return c;
  },

  duplicate(id: string): StoredCharacter | null {
    const src = this.get(id);
    if (!src) return null;
    const copy = structuredClone(src);
    copy.id = `char-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    copy.identity.name = `${src.identity.name} (copy)`;
    copy.created_at = new Date().toISOString();
    copy.updated_at = copy.created_at;
    this.save(copy);
    return copy;
  },
};
