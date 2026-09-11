import { planRebase, unresolvedConflicts, type RebaseDecision } from '../src/lib/rebase.ts';
import type { WikiSection } from '../src/types/wiki.ts';
const S = (id: string, heading: string): WikiSection => ({ id, type: 'richtext', heading, content: [] });
const results: {
    name: string;
    ok: boolean;
    detail?: string;
}[] = [];
function check(name: string, ok: boolean, detail = '') {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? ` - ${detail}` : ''}`);
}
const ids = (list: readonly WikiSection[]) => list.map((s) => s.id).join(',');
const headings = (list: readonly WikiSection[]) => list.map((s) => (s.type === 'richtext' ? s.heading : '')).join(',');
{
    const base = [S('a', 'A'), S('b', 'B'), S('c', 'C')];
    const mine = [S('a', 'A mine'), S('b', 'B'), S('c', 'C mine')];
    const theirs = [S('a', 'A'), S('b', 'B theirs'), S('c', 'C')];
    const plan = planRebase(base, mine, theirs);
    check('disjoint edits merge with no conflicts', plan.conflicts.length === 0, `${plan.conflicts.length} conflicts`);
    check('disjoint edits keep both sides', headings(plan.sections) === 'A mine,B theirs,C mine', headings(plan.sections));
    check('the author is told how much carried across', plan.cleanlyApplied === 2, String(plan.cleanlyApplied));
}
{
    const base = [S('a', 'A')];
    const plan = planRebase(base, [S('a', 'A mine')], [S('a', 'A theirs')]);
    check('the same section edited differently is a conflict', plan.conflicts.length === 1);
    check('a conflict defaults to the author\'s version', headings(plan.sections) === 'A mine', headings(plan.sections));
    check('the conflict row carries all three versions', plan.rows[0].base !== undefined && plan.rows[0].mine !== undefined && plan.rows[0].theirs !== undefined);
}
{
    const base = [S('a', 'A')];
    const plan = planRebase(base, [S('a', 'same edit')], [S('a', 'same edit')]);
    check('the same edit made by both sides is not a conflict', plan.conflicts.length === 0);
    check('the same edit appears once', headings(plan.sections) === 'same edit');
}
{
    const base = [S('a', 'A'), S('c', 'C')];
    const mine = [S('a', 'A'), S('b', 'B new'), S('c', 'C')];
    const theirs = [S('a', 'A'), S('c', 'C')];
    const plan = planRebase(base, mine, theirs);
    check('a section the author added survives the rebase', ids(plan.sections) === 'a,b,c', ids(plan.sections));
    check('an added section is not a conflict', plan.conflicts.length === 0);
}
{
    const base = [S('a', 'A')];
    const plan = planRebase(base, [S('a', 'A')], [S('a', 'A'), S('z', 'Z theirs')]);
    check('a section the page added survives the rebase', ids(plan.sections) === 'a,z', ids(plan.sections));
}
{
    const base = [S('a', 'A'), S('b', 'B')];
    const plan = planRebase(base, [S('a', 'A')], [S('a', 'A'), S('b', 'B')]);
    check('a section the author deleted stays deleted', ids(plan.sections) === 'a', ids(plan.sections));
    check('deleting a section nobody touched is not a conflict', plan.conflicts.length === 0);
}
{
    const base = [S('a', 'A'), S('b', 'B')];
    const plan = planRebase(base, [S('a', 'A'), S('b', 'B')], [S('a', 'A')]);
    check('a section the page deleted stays deleted', ids(plan.sections) === 'a', ids(plan.sections));
}
{
    const base = [S('a', 'A'), S('b', 'B')];
    const iDeleted = planRebase(base, [S('a', 'A')], [S('a', 'A'), S('b', 'B theirs')]);
    check('deleting a section the page edited is a conflict', iDeleted.conflicts.length === 1);
    check('...and defaults to keeping their edit rather than dropping it', ids(iDeleted.sections) === 'a,b', ids(iDeleted.sections));
    const theyDeleted = planRebase(base, [S('a', 'A'), S('b', 'B mine')], [S('a', 'A')]);
    check('a section the page deleted but the author edited is a conflict', theyDeleted.conflicts.length === 1);
    check('...and defaults to keeping the author\'s edit rather than dropping it', ids(theyDeleted.sections) === 'a,b', ids(theyDeleted.sections));
}
{
    const base = [S('a', 'A'), S('b', 'B')];
    const mine = [S('a', 'A'), S('new', 'inserted'), S('b', 'B')];
    const theirs = [S('b', 'B'), S('a', 'A')];
    const plan = planRebase(base, mine, theirs);
    check('the live page order is the spine', ids(plan.sections) === 'b,a,new', ids(plan.sections));
}
{
    const base: WikiSection[] = [];
    const mine = [S('x', 'X'), S('y', 'Y')];
    const plan = planRebase(base, mine, []);
    check('added sections with no anchor keep their own order', ids(plan.sections) === 'x,y', ids(plan.sections));
}
{
    const a = { id: 'a', type: 'richtext', heading: 'H', content: [] } as WikiSection;
    const b = { content: [], heading: 'H', type: 'richtext', id: 'a' } as WikiSection;
    const plan = planRebase([a], [b], [a]);
    check('the same section written with different key order is not a conflict', plan.conflicts.length === 0 && plan.rows[0].outcome === 'unchanged', plan.rows[0].outcome);
}
{
    const plan = planRebase(null, [S('a', 'A mine'), S('b', 'B')], [S('a', 'A theirs'), S('b', 'B')]);
    check('without a base the plan reports itself blind', plan.blind);
    check('without a base every difference is a question', plan.conflicts.length === 1, `${plan.conflicts.length}`);
    check('without a base an identical section is still not a question', plan.rows.find((r) => r.id === 'b')?.conflict === false);
    check('without a base nothing is credited as cleanly applied', plan.cleanlyApplied === 0);
}
{
    const base = [S('a', 'A')];
    const mine = [S('a', 'A mine')];
    const theirs = [S('a', 'A theirs')];
    const decisions = new Map<string, RebaseDecision>();
    const before = planRebase(base, mine, theirs, decisions);
    check('an unanswered conflict is reported as unanswered', unresolvedConflicts(before, decisions).length === 1);
    decisions.set('a', 'theirs');
    const taken = planRebase(base, mine, theirs, decisions);
    check('choosing theirs takes their version', headings(taken.sections) === 'A theirs', headings(taken.sections));
    check('an answered conflict is no longer unanswered', unresolvedConflicts(taken, decisions).length === 0);
    decisions.set('a', 'drop');
    const dropped = planRebase(base, mine, theirs, decisions);
    check('choosing to drop removes the section', dropped.sections.length === 0, ids(dropped.sections));
    decisions.set('a', 'mine');
    const kept = planRebase(base, mine, theirs, decisions);
    check('choosing mine takes the author\'s version', headings(kept.sections) === 'A mine');
}
{
    const base = [S('a', 'A'), S('b', 'B')];
    const decisions = new Map<string, RebaseDecision>([['b', 'drop']]);
    const plan = planRebase(base, [S('a', 'A'), S('b', 'B')], [S('a', 'A'), S('b', 'B')], decisions);
    check('a decision on a row that is not in conflict is ignored', ids(plan.sections) === 'a,b', ids(plan.sections));
    check('...and the plan still describes itself accurately', plan.conflicts.length === 0 && plan.cleanlyApplied === 0);
}
{
    const base = [S('a', 'A')];
    const mine = [S('a', 'A mine')];
    const theirs = [S('a', 'A theirs'), S('a', 'A theirs again')];
    const plan = planRebase(base, mine, theirs);
    check('a duplicate id on the live page does not duplicate the merge', ids(plan.sections) === 'a', ids(plan.sections));
}
{
    const base = [S('a', 'A')];
    const mine = [S('a', 'A'), S('x', 'X first'), S('x', 'X second')];
    const plan = planRebase(base, mine, [S('a', 'A')]);
    check('a duplicate id in the proposal keeps one section, not two', ids(plan.sections) === 'a,x', ids(plan.sections));
    check('...and keeps the first of them rather than losing it', headings(plan.sections) === 'A,X first', headings(plan.sections));
}
{
    const base = [S('a', 'A')];
    const mine = [S('a', 'A'), S('x', 'X')];
    const theirs = [S('n1', 'N1'), S('n2', 'N2')];
    const plan = planRebase(base, mine, theirs);
    check('an addition whose predecessors were all deleted goes last', ids(plan.sections) === 'n1,n2,x', ids(plan.sections));
}
{
    const base = [S('a', 'A'), S('b', 'B')];
    const mine = [S('a', 'A'), S('x', 'X'), S('b', 'B')];
    const theirs = [S('b', 'B')];
    const plan = planRebase(base, mine, theirs);
    check('an addition anchors to a surviving successor when nothing precedes it', ids(plan.sections) === 'x,b', ids(plan.sections));
}
{
    const plan = planRebase([S('a', 'A')], [], []);
    check('a section both sides deleted is simply gone', plan.sections.length === 0);
    check('...and is not reported as a conflict', plan.conflicts.length === 0 && plan.rows[0].outcome === 'removed-by-both', plan.rows[0].outcome);
}
{
    const plan = planRebase([], [S('a', 'mine')], [S('a', 'theirs')]);
    check('a section added by both sides under one id is a conflict', plan.conflicts.length === 1 && plan.rows[0].outcome === 'conflict', plan.rows[0].outcome);
    const agreed = planRebase([], [S('a', 'same')], [S('a', 'same')]);
    check('...unless they happen to be identical', agreed.conflicts.length === 0 && agreed.rows[0].outcome === 'both-same');
}
{
    const base: WikiSection[] = [];
    const mine = Array.from({ length: 60 }, (_, i) => S(`m${i}`, `M${i}`));
    const theirs = Array.from({ length: 60 }, (_, i) => S(`t${i}`, `T${i}`));
    const plan = planRebase(base, mine, theirs);
    check('the merge keeps every section rather than clamping to the cap', plan.sections.length === 120, String(plan.sections.length));
}
{
    let worst = '';
    let failures = 0;
    const rnd = (seed: number) => { let x = seed; return () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648; };
    for (let trial = 0; trial < 300; trial++) {
        const r = rnd(trial + 1);
        const pool = ['a', 'b', 'c', 'd', 'e'];
        const pick = (): WikiSection[] => pool.filter(() => r() > 0.35).map((id) => S(id, r() > 0.5 ? `${id}1` : `${id}2`));
        const base = r() > 0.15 ? pick() : null;
        const mine = pick();
        const theirs = pick();
        const plan = planRebase(base, mine, theirs);
        const seen = new Map<string, number>();
        for (const s of plan.sections)
            seen.set(s.id, (seen.get(s.id) ?? 0) + 1);
        const duped = [...seen.values()].some((n) => n > 1);
        const expected = new Set(plan.rows.filter((row) => row.resolved).map((row) => row.id));
        const got = new Set(plan.sections.map((s) => s.id));
        const sameSet = expected.size === got.size && [...expected].every((id) => got.has(id));
        const rowById = new Map(plan.rows.map((row) => [row.id, row]));
        const rightVersion = plan.sections.every((s) => rowById.get(s.id)?.resolved === s);
        const theirsIds = [...new Set(theirs.map((s) => s.id))];
        const theirOrder = theirsIds.filter((id) => got.has(id));
        const inResult = plan.sections.map((s) => s.id).filter((id) => theirOrder.includes(id));
        const spineHeld = theirOrder.join(',') === inResult.join(',');
        if (duped || !sameSet || !rightVersion || !spineHeld) {
            failures++;
            if (!worst) {
                worst = `trial ${trial}: base=${base ? ids(base) : 'null'} mine=${ids(mine)} theirs=${ids(theirs)}`
                    + ` -> ${ids(plan.sections)}`
                    + ` [dup=${duped} set=${!sameSet} version=${!rightVersion} spine=${!spineHeld}]`;
            }
        }
    }
    check('over 300 random cases: no loss, no duplication, the resolved version, the live order', failures === 0, `${failures} failures; first: ${worst}`);
}
{
    let failures = 0;
    let worst = '';
    const rnd = (seed: number) => { let x = seed; return () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648; };
    const choices: RebaseDecision[] = ['mine', 'theirs', 'drop'];
    for (let trial = 0; trial < 200; trial++) {
        const r = rnd(trial + 977);
        const pool = ['a', 'b', 'c', 'd'];
        const pick = (): WikiSection[] => pool.filter(() => r() > 0.35).map((id) => S(id, r() > 0.5 ? `${id}1` : `${id}2`));
        const base = r() > 0.2 ? pick() : null;
        const mine = pick();
        const theirs = pick();
        const first = planRebase(base, mine, theirs);
        const decisions = new Map<string, RebaseDecision>();
        for (const row of first.conflicts) {
            if (r() > 0.3)
                decisions.set(row.id, choices[Math.floor(r() * 3) % 3]);
        }
        const plan = planRebase(base, mine, theirs, decisions);
        const expected = plan.rows.filter((row) => row.resolved).map((row) => row.id).sort();
        const got = plan.sections.map((s) => s.id).sort();
        const rowById = new Map(plan.rows.map((row) => [row.id, row]));
        const rightVersion = plan.sections.every((s) => rowById.get(s.id)?.resolved === s);
        const present = new Set(plan.sections.map((s) => s.id));
        const theirsIds = [...new Set(theirs.map((s) => s.id))].filter((id) => present.has(id));
        const inResult = plan.sections.map((s) => s.id).filter((id) => theirsIds.includes(id));
        const spineHeld = theirsIds.join(',') === inResult.join(',');
        if (expected.join(',') !== got.join(',') || !rightVersion || !spineHeld) {
            failures++;
            if (!worst) {
                worst = `trial ${trial}: expected ${expected.join(',')} got ${got.join(',')}`
                    + ` [version=${!rightVersion} spine=${!spineHeld}]`;
            }
        }
    }
    check('over 200 random cases with decisions applied, the result still matches the plan', failures === 0, `${failures} failures; first: ${worst}`);
}
{
    const mine = [S('a', 'A mine'), S('b', 'B mine')];
    const theirs = [S('a', 'A theirs'), S('b', 'B theirs')];
    const decisions = new Map<string, RebaseDecision>();
    const blind = planRebase(null, mine, theirs, decisions);
    check('a blind plan reports every difference as unanswered', unresolvedConflicts(blind, decisions).length === 2, String(unresolvedConflicts(blind, decisions).length));
    decisions.set('a', 'theirs');
    const after = planRebase(null, mine, theirs, decisions);
    check('...and answering one leaves exactly the other', unresolvedConflicts(after, decisions).length === 1);
    check('...with the answer actually applied', headings(after.sections) === 'A theirs,B mine', headings(after.sections));
}
{
    const base = [S('a', 'A'), S('b', 'B')];
    const plan = planRebase(base, base, base);
    check('an untouched page rebases to itself', ids(plan.sections) === 'a,b');
    check('an untouched page has nothing to resolve and nothing applied', plan.conflicts.length === 0 && plan.cleanlyApplied === 0);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
    console.log('FAILED: ' + failed.map((f) => f.name).join(', '));
    process.exit(1);
}
