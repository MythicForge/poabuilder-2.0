// App-level nav that cross-links the character views (Roster / Sheet / Codex /
// Builder) for the active character. Lives in src (not @ui) because it knows the
// app's routes; styled purely with shared tokens.

interface ViewSwitcherProps {
  current: "roster" | "sheet" | "codex" | "builder";
  charId?: string | null;
}

export function ViewSwitcher({ current, charId }: ViewSwitcherProps) {
  const q = charId ? `?id=${encodeURIComponent(charId)}` : "";
  const items: { id: ViewSwitcherProps["current"]; label: string; href: string }[] = [
    { id: "roster", label: "Roster", href: "index.html" },
    { id: "sheet", label: "Sheet", href: "sheet.html" },
    { id: "codex", label: "Codex", href: "sheet-skin.html" },
    { id: "builder", label: "Builder", href: `builder.html${q}` },
  ];

  return (
    <nav className="view-switch" aria-label="Character views">
      {items.map((it) =>
        it.id === current ? (
          <span key={it.id} className="view-switch-item view-switch-item--on" aria-current="page">
            {it.label}
          </span>
        ) : (
          <a key={it.id} className="view-switch-item" href={it.href}>
            {it.label}
          </a>
        ),
      )}
    </nav>
  );
}
