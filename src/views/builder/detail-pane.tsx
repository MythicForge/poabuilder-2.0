// Shared master–detail components for the profession/origin/vocation steps —
// selecting or hovering a grid item renders its full picture here instead of
// forcing a trip to the character sheet. See .claude/builder-clarity-plan.md.

import type { ReactNode } from "react";
import { Markdown } from "@ui/primitives.tsx";
import type { Feat } from "../../core/types.ts";

export function DetailPane({ eyebrow, title, pills, children }: {
  eyebrow: string;
  title: string;
  pills?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="bld-detail">
      <div className="bld-detail-eyebrow">{eyebrow}</div>
      <div className="bld-detail-title">{title}</div>
      {pills && <div className="bld-detail-pills">{pills}</div>}
      <div className="bld-detail-body">{children}</div>
    </div>
  );
}

export function StatPill({ label, accent = false }: { label: string; accent?: boolean }) {
  return <span className={`bld-stat-pill${accent ? " bld-stat-pill--accent" : ""}`}>{label}</span>;
}

export function FeatureCard({ feat }: { feat: Feat }) {
  return (
    <div className="bld-feature-card">
      <div className="bld-feature-card-head">
        <span className="bld-feature-card-name">{feat.name}</span>
        {feat.trait && <span className="bld-feature-card-trait">{feat.trait}</span>}
      </div>
      <Markdown text={feat.description} className="bld-feature-card-desc" />
    </div>
  );
}
