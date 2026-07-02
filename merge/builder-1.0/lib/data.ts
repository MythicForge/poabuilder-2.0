import fs from "fs";
import path from "path";
import type {
  Profession,
  Spell,
  Origin,
  Feat,
  FeatOwner,
  ActionGroup,
  Action,
  SearchResult,
} from "./types";

const contentDir = path.join(process.cwd(), "content");

function readJSON<T>(filename: string): T {
  const filePath = path.join(contentDir, filename);
  const raw = fs.readFileSync(filePath, "utf-8").replace(/^﻿/, "");
  return JSON.parse(raw) as T;
}

// ─── Professions ──────────────────────────────────────────────────────────────

export function getProfessions(): Profession[] {
  const data = readJSON<{ professions: Profession[] }>("professions.json");
  return data.professions;
}

export function getProfession(slug: string): Profession | undefined {
  return getProfessions().find((p) => p.slug === slug);
}

// ─── Spells ───────────────────────────────────────────────────────────────────

export function getSpells(): Spell[] {
  const data = readJSON<{ spells: Spell[] }>("spells.json");
  return data.spells;
}

export function getSpell(slug: string): Spell | undefined {
  return getSpells().find((s) => s.slug === slug);
}

export function getSpellSchools(): string[] {
  const spells = getSpells();
  return [...new Set(spells.map((s) => s.school).filter(Boolean))].sort();
}

export function getSpellSources(): string[] {
  const spells = getSpells();
  const all = spells.flatMap((s) => s.sources);
  return [...new Set(all)].sort();
}

// ─── Origins ──────────────────────────────────────────────────────────────────

export function getOrigins(): Origin[] {
  const data = readJSON<{ origins: Origin[] }>("origins.json");
  return data.origins;
}

export function getOrigin(slug: string): Origin | undefined {
  return getOrigins().find((o) => o.slug === slug);
}

// ─── Origin Feats ─────────────────────────────────────────────────────────────

export function getOriginFeats(): { owners: FeatOwner[]; feats: Feat[] } {
  const data = readJSON<{ owners: FeatOwner[]; feats: Feat[] }>(
    "origin_feats.json",
  );
  return { owners: data.owners ?? [], feats: data.feats ?? [] };
}

// ─── Profession Feats ─────────────────────────────────────────────────────────

export function getProfessionFeats(): { owners: FeatOwner[]; feats: Feat[] } {
  const data = readJSON<{ owners: FeatOwner[]; feats: Feat[] }>(
    "profession_feats.json",
  );
  return { owners: data.owners ?? [], feats: data.feats ?? [] };
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export function getActions(): { groups: ActionGroup[]; actions: Action[] } {
  const data = readJSON<{ action_groups: ActionGroup[]; actions: Action[] }>(
    "actions.json",
  );
  return { groups: data.action_groups, actions: data.actions };
}

// ─── Equipment ────────────────────────────────────────────────────────────────

export function getEquipment(): Record<string, unknown> {
  return readJSON<Record<string, unknown>>("items.json");
}

// ─── Search Index ─────────────────────────────────────────────────────────────

export function buildSearchIndex(): SearchResult[] {
  const results: SearchResult[] = [];

  // Professions
  getProfessions().forEach((p) => {
    results.push({
      type: "profession",
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.role,
      tags: p.path_options,
    });
    // Profession features
    p.features.forEach((f) => {
      results.push({
        type: "profession",
        id: f.id,
        name: `${p.name}: ${f.name}`,
        slug: p.slug,
        description:
          f.description_markdown?.replace(/[*_#`>\[\]]/g, "").slice(0, 200) ??
          "",
        tags: f.traits,
      });
    });
  });

  // Spells
  getSpells().forEach((s) => {
    results.push({
      type: "spell",
      id: s.id,
      name: s.name,
      slug: s.slug,
      description:
        (s.description_markdown ?? "")
          ?.replace(/[*_#`>\[\]]/g, "")
          .slice(0, 200) ?? "",
      tags: [s.school, ...(s.sources ?? []), s.tier_label].filter(Boolean),
    });
  });

  // Origins
  getOrigins().forEach((o) => {
    results.push({
      type: "origin",
      id: o.id,
      name: o.name,
      slug: o.slug,
      description: o.flavor,
    });
    o.vocations.forEach((v) => {
      results.push({
        type: "origin",
        id: v.id,
        name: `${o.name}: ${v.name}`,
        slug: o.slug,
        description: v.flavor,
        tags: [v.attribute_bonus.raw],
      });
    });
  });

  // Origin Feats
  const { feats: originFeats } = getOriginFeats();
  originFeats.forEach((f) => {
    results.push({
      type: "feat",
      id: f.id,
      name: f.name,
      slug: f.owner_id,
      description:
        f.description_markdown?.replace(/[*_#`>\[\]]/g, "").slice(0, 200) ?? "",
      tags: f.traits,
    });
  });

  // Profession Feats
  const { feats: profFeats } = getProfessionFeats();
  profFeats.forEach((f) => {
    results.push({
      type: "feat",
      id: f.id,
      name: f.name,
      slug: f.owner_id,
      description:
        f.description_markdown?.replace(/[*_#`>\[\]]/g, "").slice(0, 200) ?? "",
      tags: f.traits,
    });
  });

  // Actions
  const { actions } = getActions();
  actions.forEach((a) => {
    results.push({
      type: "action",
      id: a.id,
      name: a.name,
      slug: a.slug,
      description:
        a.description_markdown?.replace(/[*_#`>\[\]]/g, "").slice(0, 200) ?? "",
      tags: a.traits,
    });
  });

  return results;
}
