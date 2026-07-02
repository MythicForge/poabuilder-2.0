// Phase-1 roster stub: list, open, create-from-template. Full roster UI in Phase 3.

import { useState } from "react";
import { CharStorage } from "../core/storage.ts";

export function Roster() {
  const [list, setList] = useState(() => CharStorage.loadAll());

  const open = (id: string) => {
    CharStorage.setActive(id);
    window.location.href = "/sheet.html";
  };
  const create = () => {
    const name = prompt("Character name?") ?? "Unnamed";
    const c = CharStorage.newFromTemplate(name);
    CharStorage.save(c);
    setList(CharStorage.loadAll());
  };

  return (
    <div style={{ fontFamily: "monospace", padding: 24, color: "#ddd", background: "#141210", minHeight: "100vh" }}>
      <h1>Path of Ambition — Characters</h1>
      <button onClick={create}>+ New character</button>
      <ul>
        {list.map((c) => (
          <li key={c.id}>
            <button onClick={() => open(c.id)}>{c.identity.name || c.id}</button>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p>No saved characters — the sheet page falls back to the dev fixture.</p>}
    </div>
  );
}
