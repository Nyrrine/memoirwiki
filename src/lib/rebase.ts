import type { WikiSection } from '../types/wiki';
export function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value) ?? 'null';
    if (Array.isArray(value))
        return `[${value.map(stableStringify).join(',')}]`;
    const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}
function dedupeById(list: WikiSection[]): WikiSection[] {
    const seen = new Set<string>();
    const out: WikiSection[] = [];
    for (const section of list) {
        if (seen.has(section.id))
            continue;
        seen.add(section.id);
        out.push(section);
    }
    return out;
}
function same(a: WikiSection | undefined, b: WikiSection | undefined): boolean {
    if (!a || !b)
        return !a && !b;
    return stableStringify(a) === stableStringify(b);
}
export type RebaseOutcome = 'unchanged' | 'mine' | 'theirs' | 'both-same' | 'conflict' | 'added-by-me' | 'added-by-them' | 'removed-by-me' | 'removed-by-them' | 'removed-by-both' | 'removed-by-me-edited-by-them' | 'removed-by-them-edited-by-me';
export interface RebaseRow {
    id: string;
    outcome: RebaseOutcome;
    conflict: boolean;
    base?: WikiSection;
    mine?: WikiSection;
    theirs?: WikiSection;
    resolved: WikiSection | null;
}
export interface RebasePlan {
    rows: RebaseRow[];
    sections: WikiSection[];
    conflicts: RebaseRow[];
    cleanlyApplied: number;
    blind: boolean;
}
function planRow(id: string, base: WikiSection | undefined, mine: WikiSection | undefined, theirs: WikiSection | undefined): RebaseRow {
    const row = (outcome: RebaseOutcome, resolved: WikiSection | null, conflict = false): RebaseRow => ({ id, outcome, conflict, base, mine, theirs, resolved });
    if (base && mine && theirs) {
        const iChanged = !same(base, mine);
        const theyChanged = !same(base, theirs);
        if (!iChanged && !theyChanged)
            return row('unchanged', theirs);
        if (iChanged && !theyChanged)
            return row('mine', mine);
        if (!iChanged && theyChanged)
            return row('theirs', theirs);
        if (same(mine, theirs))
            return row('both-same', theirs);
        return row('conflict', mine, true);
    }
    if (!base && mine && !theirs)
        return row('added-by-me', mine);
    if (!base && !mine && theirs)
        return row('added-by-them', theirs);
    if (!base && mine && theirs) {
        return same(mine, theirs) ? row('both-same', theirs) : row('conflict', mine, true);
    }
    if (base && !mine && theirs) {
        return same(base, theirs)
            ? row('removed-by-me', null)
            : row('removed-by-me-edited-by-them', theirs, true);
    }
    if (base && mine && !theirs) {
        return same(base, mine)
            ? row('removed-by-them', null)
            : row('removed-by-them-edited-by-me', mine, true);
    }
    return row('removed-by-both', null);
}
export type RebaseDecision = 'mine' | 'theirs' | 'drop';
export function planRebase(base: WikiSection[] | null, mineRaw: WikiSection[], theirsRaw: WikiSection[], decisions?: ReadonlyMap<string, RebaseDecision>): RebasePlan {
    const mine = dedupeById(mineRaw);
    const theirs = dedupeById(theirsRaw);
    const baseMap = new Map(dedupeById(base ?? []).map((s) => [s.id, s]));
    const mineMap = new Map(mine.map((s) => [s.id, s]));
    const theirsMap = new Map(theirs.map((s) => [s.id, s]));
    const blind = base === null;
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const list of [theirs, mine, base ?? []]) {
        for (const s of list) {
            if (!seen.has(s.id)) {
                seen.add(s.id);
                ids.push(s.id);
            }
        }
    }
    const rows = ids.map((id) => {
        const b = baseMap.get(id);
        const m = mineMap.get(id);
        const t = theirsMap.get(id);
        let row: RebaseRow;
        if (!blind) {
            row = planRow(id, b, m, t);
        }
        else if (m && t) {
            row = same(m, t)
                ? { id, outcome: 'both-same', conflict: false, mine: m, theirs: t, resolved: t }
                : { id, outcome: 'conflict', conflict: true, mine: m, theirs: t, resolved: m };
        }
        else if (m) {
            row = { id, outcome: 'added-by-me', conflict: false, mine: m, resolved: m };
        }
        else {
            row = { id, outcome: 'added-by-them', conflict: false, theirs: t, resolved: t ?? null };
        }
        const choice = row.conflict ? decisions?.get(id) : undefined;
        if (choice) {
            const resolved = choice === 'mine' ? row.mine ?? null
                : choice === 'theirs' ? row.theirs ?? null
                    : null;
            row = { ...row, resolved };
        }
        return row;
    });
    const rowById = new Map(rows.map((r) => [r.id, r]));
    const sections: WikiSection[] = [];
    for (const t of theirs) {
        const resolved = rowById.get(t.id)?.resolved;
        if (resolved)
            sections.push(resolved);
    }
    for (let i = 0; i < mine.length; i++) {
        const s = mine[i];
        if (theirsMap.has(s.id))
            continue;
        const resolved = rowById.get(s.id)?.resolved;
        if (!resolved)
            continue;
        let at = -1;
        for (let j = i - 1; j >= 0; j--) {
            const idx = sections.findIndex((r) => r.id === mine[j].id);
            if (idx >= 0) {
                at = idx + 1;
                break;
            }
        }
        if (at < 0) {
            for (let j = i + 1; j < mine.length; j++) {
                const idx = sections.findIndex((r) => r.id === mine[j].id);
                if (idx >= 0) {
                    at = idx;
                    break;
                }
            }
        }
        if (at < 0)
            at = sections.length;
        sections.splice(at, 0, resolved);
    }
    const conflicts = rows.filter((r) => r.conflict);
    const cleanlyApplied = rows.filter((r) => !r.conflict && (r.outcome === 'mine' || r.outcome === 'added-by-me' || r.outcome === 'removed-by-me')).length;
    return { rows, sections, conflicts, cleanlyApplied, blind };
}
export function unresolvedConflicts(plan: RebasePlan, decisions: ReadonlyMap<string, RebaseDecision>): RebaseRow[] {
    return plan.conflicts.filter((r) => !decisions.has(r.id));
}
