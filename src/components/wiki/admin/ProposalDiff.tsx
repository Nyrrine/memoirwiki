import { useMemo } from 'react';
import { slateToPlainText } from '../../../lib/slateHelpers';
import type { WikiSection } from '../../../types/wiki';
import styles from './ProposalDiff.module.css';
type Row = {
    kind: 'added';
    section: WikiSection;
} | {
    kind: 'removed';
    section: WikiSection;
} | {
    kind: 'changed';
    before: WikiSection;
    after: WikiSection;
} | {
    kind: 'moved';
    section: WikiSection;
    from: number;
    to: number;
} | {
    kind: 'same';
    section: WikiSection;
};
function linkTargets(value: unknown): string[] {
    const found: string[] = [];
    const walk = (node: unknown) => {
        if (!node || typeof node !== 'object')
            return;
        const n = node as Record<string, unknown>;
        if (n.type === 'wikilink' && typeof n.slug === 'string') {
            found.push(`[[${n.slug}${typeof n.display === 'string' && n.display ? `|${n.display}` : ''}]]`);
        }
        if (Array.isArray(n.children))
            n.children.forEach(walk);
    };
    if (Array.isArray(value))
        value.forEach(walk);
    return found;
}
function summarise(section: WikiSection): string[] {
    const out: string[] = [];
    const text = (v: unknown) => {
        if (typeof v === 'string')
            return v;
        if (Array.isArray(v))
            return slateToPlainText(v);
        return '';
    };
    const rich = (label: string, v: unknown) => {
        const body = text(v);
        if (body.trim())
            out.push(label ? `${label}: ${body}` : body);
        for (const link of linkTargets(v))
            out.push(`  link ${link}`);
    };
    const colour = (label: string, v: string | undefined) => {
        if (v)
            out.push(`${label}: ${v}`);
    };
    switch (section.type) {
        case 'infobox':
            out.push(`Name: ${section.characterName || '-'}`);
            if (section.subtitle)
                out.push(`Subtitle: ${section.subtitle}`);
            out.push(`Portrait: ${section.portraitUrl || '(none)'}`);
            for (const f of section.fields || []) {
                if (f.isHeader) {
                    out.push(`- header - ${f.label || '(unlabelled)'}`);
                    const hidden = text(f.value);
                    if (hidden.trim())
                        out.push(`  hidden behind that header: ${hidden}`);
                }
                else {
                    rich(f.label || '(unlabelled)', f.value);
                }
            }
            colour('Border colour', section.borderColor);
            colour('Name colour', section.nameColor);
            colour('Label colour', section.labelColor);
            break;
        case 'richtext':
        case 'collapsible':
            if (section.heading)
                out.push(`Heading: ${section.heading}`);
            rich('', section.content);
            colour('Heading colour', section.headingColor);
            break;
        case 'quote':
            rich('', section.text);
            if (section.attribution)
                out.push(`- ${section.attribution}`);
            colour('Border colour', section.borderColor);
            colour('Text colour', section.textColor);
            colour('Attribution colour', section.attributionColor);
            break;
        case 'stat-table':
            if (section.heading)
                out.push(`Heading: ${section.heading}`);
            for (const r of section.rows || []) {
                rich(r.label || '(unlabelled)', r.value);
                colour(`  ${r.label || 'row'} colour`, r.color);
            }
            colour('Heading colour', section.headingColor);
            colour('Label colour', section.labelColor);
            break;
        case 'image-gallery':
            if (section.heading)
                out.push(`Heading: ${section.heading}`);
            for (const img of section.images || []) {
                out.push(`Image: ${img.url || '(none)'}`);
                rich('  caption', img.caption);
            }
            break;
        case 'identity-showcase':
            out.push(`Heading: ${section.heading || '-'}`);
            colour('Heading colour', section.headingColor);
            break;
        case 'divider':
            out.push(`Divider: ${section.style}`);
            colour('Colour', section.color);
            break;
        default: {
            const unknown = section as {
                type?: string;
            };
            out.push(`Unrecognised section type: ${unknown.type ?? '(none)'}`);
            out.push(JSON.stringify(section).slice(0, 500));
        }
    }
    return out.filter((line) => line.trim().length > 0);
}
const TYPE_LABEL: Record<string, string> = {
    infobox: 'Infobox', richtext: 'Text', 'identity-showcase': 'Identity Showcase',
    'image-gallery': 'Gallery', collapsible: 'Collapsible', divider: 'Divider',
    quote: 'Quote', 'stat-table': 'Stat Table',
};
interface ProposalDiffProps {
    before: WikiSection[];
    after: WikiSection[];
}
export function ProposalDiff({ before, after }: ProposalDiffProps) {
    const rows = useMemo<Row[]>(() => {
        const beforeById = new Map(before.map((s, i) => [s.id, { s, i }]));
        const afterIds = new Set(after.map((s) => s.id));
        const result: Row[] = [];
        after.forEach((section, index) => {
            const prev = beforeById.get(section.id);
            if (!prev) {
                result.push({ kind: 'added', section });
                return;
            }
            const changed = JSON.stringify(prev.s) !== JSON.stringify(section);
            if (changed)
                result.push({ kind: 'changed', before: prev.s, after: section });
            else if (prev.i !== index)
                result.push({ kind: 'moved', section, from: prev.i, to: index });
            else
                result.push({ kind: 'same', section });
        });
        for (const section of before) {
            if (!afterIds.has(section.id))
                result.push({ kind: 'removed', section });
        }
        return result;
    }, [before, after]);
    const counts = useMemo(() => ({
        added: rows.filter((r) => r.kind === 'added').length,
        removed: rows.filter((r) => r.kind === 'removed').length,
        changed: rows.filter((r) => r.kind === 'changed').length,
        moved: rows.filter((r) => r.kind === 'moved').length,
    }), [rows]);
    const substantive = rows.filter((r) => r.kind !== 'same');
    return (<div className={styles.diff}>
      <div className={styles.summary}>
        {counts.added > 0 && <span className={styles.tagAdded}>+{counts.added} added</span>}
        {counts.changed > 0 && <span className={styles.tagChanged}>{counts.changed} changed</span>}
        {counts.moved > 0 && <span className={styles.tagMoved}>{counts.moved} moved</span>}
        {counts.removed > 0 && <span className={styles.tagRemoved}>−{counts.removed} removed</span>}
        {substantive.length === 0 && <span className={styles.tagSame}>No section changes</span>}
        <span className={styles.unchanged}>
          {rows.length - substantive.length} unchanged, not shown
        </span>
      </div>

      {substantive.map((row, i) => {
            if (row.kind === 'added') {
                return (<div key={i} className={`${styles.row} ${styles.added}`}>
              <div className={styles.rowHead}>
                <span className={styles.marker}>+</span>
                <span className={styles.type}>{TYPE_LABEL[row.section.type] || row.section.type}</span>
                <span className={styles.what}>added</span>
              </div>
              <pre className={styles.body}>{summarise(row.section).join('\n') || '(empty)'}</pre>
            </div>);
            }
            if (row.kind === 'removed') {
                return (<div key={i} className={`${styles.row} ${styles.removed}`}>
              <div className={styles.rowHead}>
                <span className={styles.marker}>−</span>
                <span className={styles.type}>{TYPE_LABEL[row.section.type] || row.section.type}</span>
                <span className={styles.what}>removed</span>
              </div>
              <pre className={styles.body}>{summarise(row.section).join('\n') || '(empty)'}</pre>
            </div>);
            }
            if (row.kind === 'moved') {
                return (<div key={i} className={`${styles.row} ${styles.moved}`}>
              <div className={styles.rowHead}>
                <span className={styles.marker}>↕</span>
                <span className={styles.type}>{TYPE_LABEL[row.section.type] || row.section.type}</span>
                <span className={styles.what}>moved from position {row.from + 1} to {row.to + 1}</span>
              </div>
            </div>);
            }
            const beforeLines = summarise(row.before);
            const afterLines = summarise(row.after);
            return (<div key={i} className={`${styles.row} ${styles.changed}`}>
            <div className={styles.rowHead}>
              <span className={styles.marker}>~</span>
              <span className={styles.type}>{TYPE_LABEL[row.after.type] || row.after.type}</span>
              <span className={styles.what}>changed</span>
            </div>
            <div className={styles.sideBySide}>
              <div className={styles.side}>
                <div className={styles.sideLabel}>Live now</div>
                <pre className={styles.body}>{beforeLines.join('\n') || '(empty)'}</pre>
              </div>
              <div className={styles.side}>
                <div className={styles.sideLabel}>Proposed</div>
                <pre className={styles.body}>{afterLines.join('\n') || '(empty)'}</pre>
              </div>
            </div>
          </div>);
        })}
    </div>);
}
interface FieldDiffProps {
    label: string;
    before: string | null | undefined;
    after: string | null | undefined;
}
export function FieldDiff({ label, before, after }: FieldDiffProps) {
    const a = before ?? '';
    const b = after ?? '';
    if (a === b)
        return null;
    return (<div className={`${styles.row} ${styles.changed}`}>
      <div className={styles.rowHead}>
        <span className={styles.marker}>~</span>
        <span className={styles.type}>{label}</span>
        <span className={styles.what}>changed</span>
      </div>
      <div className={styles.sideBySide}>
        <div className={styles.side}>
          <div className={styles.sideLabel}>Live now</div>
          <pre className={styles.body}>{a || '(empty)'}</pre>
        </div>
        <div className={styles.side}>
          <div className={styles.sideLabel}>Proposed</div>
          <pre className={styles.body}>{b || '(empty)'}</pre>
        </div>
      </div>
    </div>);
}
