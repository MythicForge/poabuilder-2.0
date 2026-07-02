import type { InventoryItem, RegistryItem } from './types';

const ARMOR_TYPE_TO_PROF: Record<string, string> = { LA: 'light', MA: 'medium', HA: 'heavy' };

/**
 * Returns true if the character is proficient with this item.
 * Weapons: matches weaponCategory ('simple'/'martial') or exact item name against weaponProfs.
 * Falls back to entries text scan for custom items missing weaponCategory.
 * Armor: maps type (LA/MA/HA) → 'light'/'medium'/'heavy', shields → 'shield'/'shields'.
 */
export function isItemProficient(
  item: RegistryItem,
  weaponProfs: string[],
  armorProfs: string[],
): boolean {
  const type = (item.type ?? '').replace(/\|.*/, '');
  const lowerWpn   = weaponProfs.map(p => p.toLowerCase());
  const lowerArmor = armorProfs.map(p => p.toLowerCase());

  if (item.armor || ['HA', 'MA', 'LA', 'S'].includes(type)) {
    if (type === 'S') return lowerArmor.some(p => p === 'shield' || p === 'shields');
    const tier = ARMOR_TYPE_TO_PROF[type];
    return tier ? lowerArmor.includes(tier) : false;
  }

  if (item.weapon || ['M', 'R'].includes(type)) {
    const cat = item.weaponCategory?.toLowerCase();
    if (cat && lowerWpn.includes(cat)) return true;
    if (lowerWpn.includes(item.name.toLowerCase())) return true;
    if (!cat) {
      const text = JSON.stringify(item.entries ?? '').toLowerCase();
      if (text.includes('simple weapon') && lowerWpn.includes('simple')) return true;
      if (text.includes('martial weapon') && lowerWpn.includes('martial')) return true;
    }
    return false;
  }

  return false;
}

/**
 * Resolve an equipment-slot/inventory key to a RegistryItem-shaped object.
 *
 * Checks `inventory` for a custom payload first (so player edits/forks always win even if a
 * same-named registry item exists), then falls through to the standard two-tier registry
 * lookup (exact name+source, then name-only). Shared by data-5e.ts (AC/attack computation)
 * and tabs-5e.tsx (Inventory/Combat/Spellcasting rendering) so custom items work everywhere
 * a registry item would.
 */
export function resolveItem(
  inventory: InventoryItem[] | null | undefined,
  regItems: RegistryItem[] | null | undefined,
  key: string | null | undefined,
): RegistryItem | undefined {
  if (!key) return undefined;
  const invEntry = inventory?.find(i => i.key === key);
  if (invEntry?.custom) {
    return { ...invEntry.custom, name: invEntry.custom.name ?? key.split('|')[0], source: 'custom' };
  }
  const [rawName, rawSrc = ''] = key.toLowerCase().split('|');
  if (!regItems) return undefined;
  return regItems.find(i => i.name.toLowerCase() === rawName && i.source.toLowerCase() === rawSrc)
      ?? regItems.find(i => i.name.toLowerCase() === rawName);
}
