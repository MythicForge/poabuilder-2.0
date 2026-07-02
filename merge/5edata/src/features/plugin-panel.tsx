// PluginSection — drop into TweaksPanel to list registered plugins with on/off toggles.

import { useState, useEffect } from 'react';
import { PluginRegistry } from './plugin-registry';
import { TweakSection, TweakToggle } from './tweaks-panel';

const EMPTY_STYLE = `
  .plg-empty {
    padding: 10px 0 6px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .plg-empty-title {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--text-faint);
    letter-spacing: 0.1em;
  }
  .plg-empty-hint {
    font-family: var(--mono);
    font-size: 9px;
    color: var(--text-faint);
    letter-spacing: 0.06em;
    line-height: 1.6;
    padding: 8px 10px;
    background: var(--card-2);
    border: 1px solid var(--border-faint);
    border-left: 2px solid var(--gold-dim);
    border-radius: 4px;
    opacity: 0.7;
  }
  .plg-desc {
    font-family: var(--sans);
    font-size: 10px;
    color: var(--text-faint);
    line-height: 1.4;
    padding: 2px 0 6px;
    padding-left: 0;
    margin-top: -2px;
  }
`;

export function PluginSection() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener('bg3:plugin-changed', handler);
    return () => window.removeEventListener('bg3:plugin-changed', handler);
  }, []);
  void tick;

  const plugins = PluginRegistry.getAll();

  return (
    <>
      <style>{EMPTY_STYLE}</style>
      <TweakSection label="Plugins">
        {plugins.length === 0 ? (
          <div className="plg-empty">
            <div className="plg-empty-title">No plugins registered</div>
            <div className="plg-empty-hint">
              Add to <strong>plugins/index.ts</strong>:<br />
              import &#123; PluginRegistry &#125; from '../src/plugin-registry';<br />
              import &#123; MyPlugin &#125; from './my-plugin';<br />
              PluginRegistry.register(MyPlugin);
            </div>
          </div>
        ) : (
          plugins.map((p) => (
            <div key={p.id}>
              <TweakToggle
                label={p.name + (p.version ? ` v${p.version}` : '')}
                value={PluginRegistry.isEnabled(p.id)}
                onChange={() => PluginRegistry.toggle(p.id)}
              />
              {p.description && (
                <div className="plg-desc">{p.description}</div>
              )}
            </div>
          ))
        )}
      </TweakSection>
    </>
  );
}
