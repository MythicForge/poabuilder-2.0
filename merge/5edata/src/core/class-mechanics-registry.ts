import type { ClassMechanics } from './types';

const _registry = new Map<string, ClassMechanics>();

export const ClassMechanicsRegistry = {
  register(m: ClassMechanics): void {
    _registry.set(m.className, m);
  },
  get(name: string): ClassMechanics | undefined {
    return _registry.get(name);
  },
  keys(): string[] {
    return [..._registry.keys()];
  },
  registerFromPlugin(list: ClassMechanics[]): void {
    for (const m of list) _registry.set(m.className, m);
  },
};
