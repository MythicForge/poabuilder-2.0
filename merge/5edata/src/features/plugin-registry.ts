// Plugin registry — register plugins, call hooks, collect tab/builder extensions.

import type { Plugin, TabDef, BuilderExtra, UISlotId, SlotProps } from './plugin-api';
import type { ComponentType } from 'react';
import type { ComputedChar, StoredChar, JournalEntry } from '../core/types';
import type { CampaignRules } from '../core/campaign-rules';
import { ClassMechanicsRegistry } from '../core/class-mechanics-registry';

const _plugins: Plugin[] = [];

// ── Enabled state ────────────────────────────────────────────────────────────

const ENABLED_KEY = 'bg3_plugin_enabled';

const _enabledState: Record<string, boolean> = (() => {
  try { return JSON.parse(localStorage.getItem(ENABLED_KEY) ?? '{}'); }
  catch { return {}; }
})();

function _saveEnabled() {
  try { localStorage.setItem(ENABLED_KEY, JSON.stringify(_enabledState)); }
  catch { /* storage unavailable */ }
  window.dispatchEvent(new CustomEvent('bg3:plugin-changed'));
}

export const PluginRegistry = {
  /**
   * Register a plugin. Call before app renders (e.g. in your entry point).
   * Duplicate IDs are silently ignored.
   */
  register(plugin: Plugin): void {
    if (_plugins.find(p => p.id === plugin.id)) {
      console.warn(`[PluginRegistry] "${plugin.id}" already registered — skipped`);
      return;
    }
    _plugins.push(plugin);
    if (plugin.classMechanics?.length) {
      ClassMechanicsRegistry.registerFromPlugin(plugin.classMechanics);
    }
    console.info(`[PluginRegistry] registered "${plugin.name}" v${plugin.version ?? '?'}`);
  },

  unregister(id: string): void {
    const idx = _plugins.findIndex(p => p.id === id);
    if (idx !== -1) _plugins.splice(idx, 1);
  },

  getAll(): readonly Plugin[] {
    return _plugins;
  },

  // ── Enable / disable ────────────────────────────────────────────────────────

  isEnabled(id: string): boolean {
    return _enabledState[id] ?? false;
  },

  enable(id: string): void {
    _enabledState[id] = true;
    _saveEnabled();
  },

  disable(id: string): void {
    _enabledState[id] = false;
    _saveEnabled();
  },

  toggle(id: string): void {
    _enabledState[id] = !(_enabledState[id] ?? true);
    _saveEnabled();
  },

  // ── Compute pipeline ────────────────────────────────────────────────────────

  /**
   * Run all computeHooks in registration order.
   * Each hook receives the result of the previous — patches accumulate.
   */
  applyComputeHooks(
    c:     ComputedChar,
    s:     StoredChar,
    rules: CampaignRules,
  ): ComputedChar {
    let result = c;
    for (const plugin of _plugins) {
      if (!plugin.computeHook || !PluginRegistry.isEnabled(plugin.id)) continue;
      try {
        const patch = plugin.computeHook(result, s, rules);
        result = { ...result, ...patch };
      } catch (err) {
        console.error(`[PluginRegistry] computeHook error in "${plugin.id}":`, err);
      }
    }
    return result;
  },

  // ── UI extensions ───────────────────────────────────────────────────────────

  /** All extra sheet tabs from enabled plugins, in registration order. Injects pluginId. */
  getExtraTabs(): (TabDef & { pluginId: string })[] {
    return _plugins
      .filter(p => PluginRegistry.isEnabled(p.id))
      .flatMap(p => (p.extraTabs ?? []).map(tab => ({ ...tab, pluginId: p.id })));
  },

  /**
   * Returns the first enabled plugin component for a named UI slot, or null.
   * Logs a warning if multiple enabled plugins claim the same slot.
   */
  getSlot(id: UISlotId): { pluginId: string; component: ComponentType<SlotProps> } | null {
    let found: { pluginId: string; component: ComponentType<SlotProps> } | null = null;
    for (const plugin of _plugins) {
      if (!PluginRegistry.isEnabled(plugin.id)) continue;
      const comp = plugin.uiSlots?.[id];
      if (!comp) continue;
      if (found) {
        console.warn(`[PluginRegistry] slot "${id}" already claimed by "${found.pluginId}", ignoring "${plugin.id}"`);
      } else {
        found = { pluginId: plugin.id, component: comp };
      }
    }
    return found;
  },

  /** All builder extra steps from enabled plugins, in registration order. */
  getBuilderExtras(): BuilderExtra[] {
    return _plugins
      .filter(p => PluginRegistry.isEnabled(p.id))
      .flatMap(p => p.builderExtras ?? []);
  },

  // ── Journal hooks ────────────────────────────────────────────────────────────

  /** Apply all enabled plugins' onEntryCreate hooks in order. */
  applyJournalEntryCreate(entry: JournalEntry, stored: StoredChar): JournalEntry {
    let result = entry;
    for (const plugin of _plugins) {
      if (!PluginRegistry.isEnabled(plugin.id)) continue;
      const hook = plugin.journalHooks?.onEntryCreate;
      if (!hook) continue;
      try {
        const patch = hook(result, stored);
        result = { ...result, ...patch };
      } catch (err) {
        console.error(`[PluginRegistry] journalHooks.onEntryCreate error in "${plugin.id}":`, err);
      }
    }
    return result;
  },

  /**
   * Collect export extras from all enabled plugins.
   * Returns an object shaped { [pluginId]: { ...extras } } to embed in the export JSON.
   */
  buildJournalExportExtras(
    entry: JournalEntry,
    stored: StoredChar,
  ): Record<string, Record<string, unknown>> {
    const extras: Record<string, Record<string, unknown>> = {};
    for (const plugin of _plugins) {
      if (!PluginRegistry.isEnabled(plugin.id)) continue;
      const hook = plugin.journalHooks?.onEntryExport;
      if (!hook) continue;
      try {
        const data = hook(entry, stored);
        if (data && Object.keys(data).length > 0) extras[plugin.id] = data;
      } catch (err) {
        console.error(`[PluginRegistry] journalHooks.onEntryExport error in "${plugin.id}":`, err);
      }
    }
    return extras;
  },

  /**
   * Apply all enabled plugins' onEntryImport hooks to raw parsed JSON.
   * Returns merged patches, or null if any plugin aborts the import.
   */
  applyJournalImport(raw: Record<string, unknown>): Partial<JournalEntry> | null {
    let merged: Partial<JournalEntry> = {};
    for (const plugin of _plugins) {
      if (!PluginRegistry.isEnabled(plugin.id)) continue;
      const hook = plugin.journalHooks?.onEntryImport;
      if (!hook) continue;
      try {
        const patch = hook(raw);
        if (patch === null) return null; // plugin vetoed the import
        merged = { ...merged, ...patch };
      } catch (err) {
        console.error(`[PluginRegistry] journalHooks.onEntryImport error in "${plugin.id}":`, err);
      }
    }
    return merged;
  },

  // ── Stored data ─────────────────────────────────────────────────────────────

  /**
   * Returns a merged defaults object for stored.pluginData.
   * Shape: { [pluginId]: { ...plugin.defaultData } }
   * Used when creating new characters to pre-populate plugin fields.
   */
  getDefaultPluginData(): Record<string, Record<string, unknown>> {
    const data: Record<string, Record<string, unknown>> = {};
    for (const plugin of _plugins) {
      if (plugin.defaultData) {
        data[plugin.id] = { ...plugin.defaultData };
      }
    }
    return data;
  },

  /**
   * Merge any missing plugin defaults into an existing pluginData blob.
   * Call on character load to forward-fill data for newly registered plugins.
   */
  hydratePluginData(
    existing: Record<string, Record<string, unknown>> = {},
  ): Record<string, Record<string, unknown>> {
    const defaults = PluginRegistry.getDefaultPluginData();
    const result: Record<string, Record<string, unknown>> = { ...existing };
    for (const [id, def] of Object.entries(defaults)) {
      result[id] = { ...def, ...(existing[id] ?? {}) };
    }
    return result;
  },
};
