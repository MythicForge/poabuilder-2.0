// Plugin API — interface devs/GMs implement to extend the character sheet.

import type { Dispatch, SetStateAction, ComponentType } from 'react';
import type { StoredChar, ComputedChar, ClassMechanics, JournalEntry } from '../core/types';
import type { CampaignRules } from '../core/campaign-rules';

export type { ClassMechanics };

// ── Tab injection ─────────────────────────────────────────────────────────────

export interface TabProps {
  c:         ComputedChar;
  stored:    StoredChar;
  setStored: Dispatch<SetStateAction<StoredChar>>;
  rules:     CampaignRules;
  /** Plugin's own namespaced data blob from stored.pluginData[plugin.id] */
  pluginData: Record<string, unknown>;
  setPluginData: (patch: Record<string, unknown>) => void;
}

export interface TabDef {
  id:        string;
  label:     string;
  icon?:     string;
  component: ComponentType<TabProps>;
}

// ── UI Slot replacement ───────────────────────────────────────────────────────

/**
 * Named sections of the sheet that plugins can replace entirely.
 * First enabled plugin claiming a slot wins; others are ignored.
 */
export type UISlotId =
  | 'deathSaves'      // pip tracker beside hit dice
  | 'hitPoints'       // HP card (current / max / temp)
  | 'hitDice'         // hit dice display
  | 'inspiration'     // inspiration toggle
  | 'rest'            // entire rest card (short + long rest controls)
  | 'notesJournal'    // journal section inside the Notes tab
  | 'notesBiography'; // biography section inside the Notes tab

/** Slot components receive the same props as tab components. */
export type SlotProps = TabProps;

// ── Builder injection ─────────────────────────────────────────────────────────

export type BuilderFieldType = 'text' | 'number' | 'boolean' | 'select';

export interface BuilderFieldDef {
  key:      string;             // stored under pluginData[pluginId][key]
  label:    string;
  type:     BuilderFieldType;
  options?: string[];           // required when type === 'select'
  default?: unknown;
  hint?:    string;             // helper text shown under field
}

export interface BuilderExtra {
  stepId:       string;
  stepLabel:    string;
  description?: string;
  fields:       BuilderFieldDef[];
}

// ── Plugin interface ──────────────────────────────────────────────────────────

export interface Plugin {
  /** Unique stable identifier, e.g. "my-org.survival-mechanics" */
  id:           string;
  name:         string;
  version?:     string;
  description?: string;

  /**
   * Called after base computeCharacter(). Return a partial ComputedChar to
   * override any computed values. Hooks run in registration order.
   */
  computeHook?: (
    c:     ComputedChar,
    s:     StoredChar,
    rules: CampaignRules,
  ) => Partial<ComputedChar>;

  /** Extra steps/panels injected into character builder. */
  builderExtras?: BuilderExtra[];

  /** Extra tabs added to the character sheet tab bar. */
  extraTabs?: TabDef[];

  /**
   * Replace named sheet sections with custom components.
   * First enabled plugin per slot wins; conflicts log a console warning.
   */
  uiSlots?: Partial<Record<UISlotId, ComponentType<SlotProps>>>;

  /**
   * Lifecycle hooks for the journal system.
   * All enabled plugins' hooks run in registration order; patches accumulate.
   */
  journalHooks?: {
    /**
     * Called when a new journal entry is created.
     * Return a partial JournalEntry to stamp extra fields (e.g. session tag, encrypted flag).
     */
    onEntryCreate?: (entry: JournalEntry, stored: StoredChar) => Partial<JournalEntry>;
    /**
     * Called when an entry is exported.
     * Return extra key/value pairs to embed under `pluginExtras[pluginId]` in the JSON file.
     */
    onEntryExport?: (entry: JournalEntry, stored: StoredChar) => Record<string, unknown>;
    /**
     * Called when a JSON file is imported.
     * Return a partial JournalEntry to merge into the new entry, or null to abort import.
     */
    onEntryImport?: (raw: Record<string, unknown>) => Partial<JournalEntry> | null;
  };

  /** Initial data written to stored.pluginData[id] on new characters. */
  defaultData?: Record<string, unknown>;

  /**
   * Homebrew class mechanics to register in ClassMechanicsRegistry at plugin load time.
   * Allows plugins to add new classes that computeCharacter() handles correctly.
   * Note: for the class to appear in the builder's class picker, a corresponding
   * data/class/class-{name}.json must also exist.
   */
  classMechanics?: ClassMechanics[];
}
