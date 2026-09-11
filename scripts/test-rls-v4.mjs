import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env.local', 'utf-8').split('\n').filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const URL_ = env.VITE_SUPABASE_URL, ANON = env.VITE_SUPABASE_ANON_KEY, SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL_, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
const PW = 'rls4-' + Math.random().toString(36).slice(2);
const results = [];
const check = (name, ok, detail = '') => {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? ` - ${detail}` : ''}`);
};
const createdUsers = [];
const createdPages = [];
const createdCategories = [];
const createdImages = [];
let cleanupFailed = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function makeUser(tag, role) {
    const email = `rls4-${tag}-${Date.now()}@test.local`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
    if (error)
        throw new Error(`createUser ${tag}: ${error.message}`);
    createdUsers.push(data.user.id);
    if (role !== 'reader') {
        const { error: e } = await admin.from('profiles').update({ role }).eq('id', data.user.id);
        if (e)
            throw new Error(`set role ${tag}: ${e.message}`);
    }
    const client = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { error: se } = await client.auth.signInWithPassword({ email, password: PW });
    if (se)
        throw new Error(`signIn ${tag}: ${se.message}`);
    return { client, id: data.user.id };
}
async function newPage(ownerId, status = 'published') {
    const { data } = await admin.from('wiki_pages')
        .insert({ slug: `rls4-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: 'RLS4 Page', status, created_by: ownerId })
        .select().single();
    createdPages.push(data.id);
    return data;
}
async function refuses(label, promise) {
    const { error } = await promise;
    check(label, !!error, error ? '' : 'the call was ALLOWED');
}
async function noEffect(label, promise, verify) {
    await promise;
    check(label, await verify());
}
async function imageExists(path, tries = 3) {
    for (let i = 0; i < tries; i++) {
        const { data, error } = await admin.storage.from('wiki-images').list('', { search: path });
        if (!error)
            return (data || []).some((o) => o.name === path);
        if (i === tries - 1) {
            console.error(`  storage list failed: ${error.message}`);
            return null;
        }
        await sleep(300);
    }
    return null;
}
{
    const [{ data: ghostUsers }, { data: ghostPages }] = await Promise.all([
        admin.from('profiles').select('id, username, role').like('username', 'rls4-%'),
        admin.from('wiki_pages').select('id, slug, status').like('slug', 'rls4-%'),
    ]);
    const ghosts = [...(ghostUsers || []), ...(ghostPages || [])];
    if (ghosts.length) {
        console.error('REFUSING TO RUN: fixtures from another run of this script are on the database.');
        console.error('Either a run is in progress right now, or one died before cleaning up.');
        for (const g of ghostUsers || [])
            console.error(`  profile ${g.id}  ${g.username}  ${g.role}`);
        for (const g of ghostPages || [])
            console.error(`  page    ${g.id}  ${g.slug}  ${g.status}`);
        console.error('Wait for the other run, or delete these, then try again.');
        process.exit(1);
    }
}
try {
    const editorA = await makeUser('edA', 'editor');
    const editorB = await makeUser('edB', 'editor');
    const mod = await makeUser('mod', 'moderator');
    const owner = await makeUser('adm', 'admin');
    const villain = await makeUser('ban', 'editor');
    console.log('Test users ready.\n');
    const page = await newPage(editorA.id);
    {
        await editorB.client.from('wiki_pages')
            .update({ subtitle: 'should not stick' }).eq('id', page.id);
        const { data: after } = await admin.from('wiki_pages')
            .select('subtitle').eq('id', page.id).single();
        check('an editor cannot edit a page they did not create (1b)', after.subtitle !== 'should not stick', `subtitle is now ${after.subtitle}`);
        const ownDraft = await newPage(editorA.id, 'draft');
        const { error: ownErr } = await editorA.client.from('wiki_pages')
            .update({ subtitle: 'mine to edit' }).eq('id', ownDraft.id);
        const { data: mine } = await admin.from('wiki_pages')
            .select('subtitle').eq('id', ownDraft.id).single();
        check('...but their own draft is still theirs', !ownErr && mine.subtitle === 'mine to edit', ownErr?.message ?? `subtitle ${mine.subtitle}`);
        const { data: live } = await admin.from('wiki_pages')
            .select('status').eq('id', ownDraft.id).single();
        await editorA.client.from('wiki_pages')
            .update({ status: 'published' }).eq('id', ownDraft.id);
        const { data: stillDraft } = await admin.from('wiki_pages')
            .select('status').eq('id', ownDraft.id).single();
        check('...and only a maintainer publishes', stillDraft.status === live.status, `status became ${stillDraft.status}`);
    }
    {
        const live = page;
        const draft = await newPage(editorA.id, 'draft');
        await editorB.client.from('wiki_links').insert({ from_page: live.id, to_slug: 'rls4-nowhere' });
        const { count: linkAdded } = await admin.from('wiki_links')
            .select('to_slug', { count: 'exact', head: true }).eq('from_page', live.id).eq('to_slug', 'rls4-nowhere');
        check('a stranger cannot add a backlink to a live page', linkAdded === 0);
        await admin.from('wiki_links').insert({ from_page: live.id, to_slug: 'rls4-keepme' });
        await editorB.client.from('wiki_links').delete().eq('from_page', live.id).eq('to_slug', 'rls4-keepme');
        const { count: linkKept } = await admin.from('wiki_links')
            .select('to_slug', { count: 'exact', head: true }).eq('from_page', live.id).eq('to_slug', 'rls4-keepme');
        check('...and cannot delete one either', linkKept === 1);
        const { error: ownLinkErr } = await editorA.client.from('wiki_links')
            .insert({ from_page: draft.id, to_slug: 'rls4-mine' });
        const { count: ownLink } = await admin.from('wiki_links')
            .select('to_slug', { count: 'exact', head: true }).eq('from_page', draft.id);
        check('...but an author still links from their own draft', !ownLinkErr && ownLink === 1, ownLinkErr?.message ?? `${ownLink} rows`);
        const catSlug = `rls4-cat-${Date.now()}`;
        await admin.from('wiki_categories').insert({ slug: catSlug, name: 'RLS4 Category' });
        createdCategories.push(catSlug);
        await editorB.client.from('wiki_categories').update({ name: 'DEFACED' }).eq('slug', catSlug);
        const { data: cat } = await admin.from('wiki_categories').select('name').eq('slug', catSlug).single();
        check('a stranger cannot rename a category', cat.name === 'RLS4 Category', `name is now ${cat.name}`);
        await editorB.client.from('wiki_page_categories').insert({ page_id: live.id, category_slug: catSlug });
        const { count: tagged } = await admin.from('wiki_page_categories')
            .select('page_id', { count: 'exact', head: true }).eq('page_id', live.id).eq('category_slug', catSlug);
        check('...cannot tag a live page', tagged === 0);
        await admin.from('wiki_page_categories').insert({ page_id: live.id, category_slug: catSlug });
        await editorB.client.from('wiki_page_categories').delete().eq('page_id', live.id).eq('category_slug', catSlug);
        const { count: stillTagged } = await admin.from('wiki_page_categories')
            .select('page_id', { count: 'exact', head: true }).eq('page_id', live.id).eq('category_slug', catSlug);
        check('...and cannot untag one', stillTagged === 1);
        const imgPath = `rls4-${Date.now()}.png`;
        const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
        const { error: upErr } = await editorA.client.storage.from('wiki-images')
            .upload(imgPath, png, { contentType: 'image/png' });
        if (upErr) {
            check('an editor can still upload a wiki image', false, upErr.message);
        }
        else {
            createdImages.push(imgPath);
            let landed = await imageExists(imgPath);
            for (let i = 0; landed === false && i < 5; i++) {
                await sleep(300);
                landed = await imageExists(imgPath);
            }
            check('an editor can still upload a wiki image', landed === true, landed === null ? 'could not read the bucket' : 'the upload reported success but the object is not there');
            if (landed === true) {
                await editorB.client.storage.from('wiki-images').remove([imgPath]);
                const survived = await imageExists(imgPath);
                check('...but another editor cannot delete it', survived === true, survived === null ? 'could not read the bucket' : 'the object is gone');
                await editorB.client.storage.from('wiki-images')
                    .upload(imgPath, new Blob([new Uint8Array([0, 0, 0, 0])], { type: 'image/png' }), { contentType: 'image/png', upsert: true });
                const { data: blob, error: dlErr } = await admin.storage.from('wiki-images').download(imgPath);
                const bytes = blob ? new Uint8Array(await blob.arrayBuffer()) : null;
                check('...nor overwrite it, which would swap what every live page renders', !!bytes && bytes.length === 4 && bytes[0] === 137 && bytes[1] === 80, dlErr ? `download failed: ${dlErr.message}` : `bytes are now [${bytes}]`);
            }
        }
    }
    {
        const live = page;
        const draft = await newPage(editorA.id, 'draft');
        const { data: cardA } = await admin.from('projects')
            .insert({ user_id: editorA.id, data: { t: 1 }, name: 'RLS4 card A' }).select().single();
        const { data: cardB } = await admin.from('projects')
            .insert({ user_id: editorB.id, data: { t: 1 }, name: 'RLS4 card B' }).select().single();
        await editorB.client.from('wiki_page_projects')
            .insert({ wiki_page_id: live.id, project_id: cardB.id });
        const { count: stapled } = await admin.from('wiki_page_projects')
            .select('id', { count: 'exact', head: true }).eq('wiki_page_id', live.id).eq('project_id', cardB.id);
        check('a stranger cannot staple their card onto a live page', stapled === 0);
        const { error: ownCardErr } = await editorA.client.from('wiki_page_projects')
            .insert({ wiki_page_id: draft.id, project_id: cardA.id });
        const { count: ownCard } = await admin.from('wiki_page_projects')
            .select('id', { count: 'exact', head: true }).eq('wiki_page_id', draft.id);
        check('...but an author still links their own card to their own draft', !ownCardErr && ownCard === 1, ownCardErr?.message ?? `${ownCard} rows`);
        const draftB = await newPage(editorB.id, 'draft');
        await editorB.client.from('wiki_page_projects')
            .insert({ wiki_page_id: draftB.id, project_id: cardA.id });
        const { count: borrowed } = await admin.from('wiki_page_projects')
            .select('id', { count: 'exact', head: true }).eq('wiki_page_id', draftB.id).eq('project_id', cardA.id);
        check('...and nobody links a card they do not own', borrowed === 0);
        const { data: linked } = await admin.from('wiki_page_projects')
            .insert({ wiki_page_id: live.id, project_id: cardA.id, display_order: 0 }).select().single();
        await editorB.client.from('wiki_page_projects').update({ display_order: 9 }).eq('id', linked.id);
        const { data: order } = await admin.from('wiki_page_projects')
            .select('display_order').eq('id', linked.id).single();
        check('a stranger cannot reorder the cards on a live page', order.display_order === 0, `display_order is now ${order.display_order}`);
        await editorB.client.from('wiki_page_projects').delete().eq('id', linked.id);
        const { count: stillLinked } = await admin.from('wiki_page_projects')
            .select('id', { count: 'exact', head: true }).eq('id', linked.id);
        check('...and cannot unlink one either', stillLinked === 1);
    }
    {
        const p = await newPage(editorA.id, 'draft');
        const countRevs = async () => {
            const { count } = await admin.from('wiki_revisions')
                .select('id', { count: 'exact', head: true }).eq('page_id', p.id);
            return count;
        };
        const before = await countRevs();
        await editorA.client.from('wiki_pages').update({ subtitle: 'save one' }).eq('id', p.id);
        await editorA.client.from('wiki_pages').update({ subtitle: 'save two' }).eq('id', p.id);
        await editorA.client.from('wiki_pages').update({ subtitle: 'save three' }).eq('id', p.id);
        const after = await countRevs();
        check('consecutive saves by one author collapse into one revision', after - before === 1, `added ${after - before} rows for 3 saves`);
        const { data: rev } = await admin.from('wiki_revisions')
            .select('subtitle').eq('page_id', p.id).order('created_at', { ascending: false }).limit(1).single();
        check('the collapsed revision holds the newest content', rev.subtitle === 'save three');
        const mid = await countRevs();
        await editorA.client.from('wiki_pages').update({ global_bg_color: '#123456' }).eq('id', p.id);
        check('a metadata-only change writes no revision', (await countRevs()) === mid);
    }
    const currentStamp = async () => {
        const { data } = await admin.from('wiki_pages').select('updated_at').eq('id', page.id).single();
        return data.updated_at;
    };
    const submit = async (who, summary, extra = {}) => who.client.rpc('submit_proposal', {
        p_page_id: page.id, p_base_updated_at: await currentStamp(),
        p_title: 'RLS4 Page', p_subtitle: 'proposed',
        p_cover_image: null, p_sections: [],
        p_link_slugs: [], p_kind: 'lore', p_is_memoir: false,
        p_category_slugs: [], p_summary: summary, ...extra,
    });
    const { data: propId, error: subErr } = await submit(editorA, 'first');
    check('editor can submit a proposal', !!propId && !subErr, subErr?.message);
    await refuses('a resubmission inside the rate limit is refused', submit(editorA, 'too fast'));
    await sleep(5200);
    const { data: propId2 } = await submit(editorA, 'second');
    check('resubmitting overwrites rather than stacking', propId2 === propId);
    {
        const { count } = await admin.from('wiki_page_proposals')
            .select('id', { count: 'exact', head: true })
            .eq('page_id', page.id).eq('author_id', editorA.id).in('state', ['open', 'changes_requested']);
        check('exactly one open proposal per author per page', count === 1, `count=${count}`);
    }
    await refuses('slug arrays are capped by size, not just element count', submit(editorA, 'huge slugs', { p_link_slugs: Array.from({ length: 500 }, () => 'x'.repeat(20000)) }));
    await sleep(5200);
    {
        const { error } = await submit(editorA, 'normal slugs', { p_link_slugs: Array.from({ length: 500 }, (_, i) => `some-page-slug-${i}`) });
        check('500 real slugs are still allowed', !error, error?.message);
        await sleep(5200);
    }
    {
        const { data: row } = await admin.from('wiki_page_proposals')
            .select('base_sections, base_updated_at').eq('id', propId).single();
        check('a proposal written against the current page records its base', row.base_sections !== null);
        const { data: pageNow } = await admin.from('wiki_pages')
            .select('sections').eq('id', page.id).single();
        check('...and the base is exactly what the page held at the time', JSON.stringify(row.base_sections) === JSON.stringify(pageNow.sections));
        const stale = await editorB.client.rpc('submit_proposal', {
            p_page_id: page.id, p_base_updated_at: new Date(Date.now() - 3600000).toISOString(),
            p_title: 'RLS4 Page', p_subtitle: 'stale from birth',
            p_cover_image: null, p_sections: [], p_link_slugs: [], p_kind: 'lore',
            p_is_memoir: false, p_category_slugs: [], p_summary: 'stale',
        });
        check('a proposal submitted against a moved page is accepted', !stale.error, stale.error?.message);
        const { data: staleRow } = await admin.from('wiki_page_proposals')
            .select('base_sections').eq('id', stale.data).single();
        check('...and records no base rather than an invented one', staleRow.base_sections === null);
        const { data: mine } = await editorA.client.from('wiki_page_proposals')
            .select('sections, base_sections').eq('id', propId).maybeSingle();
        check('an author can read their own proposal content back', !!mine);
        const { data: notMine } = await editorB.client.from('wiki_page_proposals')
            .select('base_sections').eq('id', propId).maybeSingle();
        check('...and cannot read anyone else\'s base', notMine === null);
        await sleep(5200);
    }
    {
        const { data } = await editorB.client.from('wiki_page_proposals').select('id').eq('id', propId);
        check("editor cannot read another editor's proposal", (data || []).length === 0);
    }
    {
        const { data } = await mod.client.from('wiki_page_proposals').select('id').eq('id', propId);
        check('moderator reads all proposals', (data || []).length === 1);
    }
    const propStamp = async (id) => {
        const { data } = await admin.from('wiki_page_proposals').select('updated_at').eq('id', id).single();
        return data.updated_at;
    };
    await refuses('editor cannot merge', editorB.client.rpc('merge_proposal', { p_id: propId, p_expected_updated_at: await propStamp(propId) }));
    await refuses('editor cannot review', editorB.client.rpc('review_proposal', { p_id: propId, p_state: 'rejected' }));
    await refuses("editor cannot withdraw someone else's proposal", editorB.client.rpc('withdraw_proposal', { p_id: propId }));
    await refuses('a merge with a stale content pin is refused', mod.client.rpc('merge_proposal', {
        p_id: propId, p_expected_updated_at: '2020-01-01T00:00:00Z', p_note: 'x',
    }));
    {
        const stamp = await propStamp(propId);
        const { error } = await mod.client.rpc('merge_proposal', {
            p_id: propId, p_expected_updated_at: stamp, p_note: 'ok',
        });
        check('moderator can merge', !error, error?.message);
        const { data: after } = await admin.from('wiki_pages')
            .select('subtitle, updated_by').eq('id', page.id).single();
        check('merge applies the proposal content', after.subtitle === 'proposed');
        check('merge credits the author, not the merger', after.updated_by === editorA.id);
        const { data: rev } = await admin.from('wiki_revisions')
            .select('author_id').eq('page_id', page.id)
            .order('created_at', { ascending: false }).limit(1).single();
        check('revision credits the author', rev.author_id === editorA.id);
        const { data: logged } = await admin.from('moderation_log')
            .select('actor_id').eq('target_id', page.id).eq('action', 'proposal.merge');
        check('merge is written to the moderation log', (logged || []).length === 1 && logged[0].actor_id === mod.id);
    }
    {
        await sleep(5200);
        const { data: stale } = await submit(editorB, 'stale one');
        await admin.from('wiki_pages').update({ subtitle: 'moved on' }).eq('id', page.id);
        const { error } = await mod.client.rpc('merge_proposal', {
            p_id: stale, p_expected_updated_at: await propStamp(stale),
        });
        check('a proposal whose page moved on is refused', !!error && /rebase/i.test(error.message));
        await admin.from('wiki_page_proposals').delete().eq('id', stale);
    }
    {
        const { data: card } = await admin.from('projects')
            .insert({ user_id: editorA.id, data: { t: 1 }, name: 'RLS4 card' }).select().single();
        const { data: byMod } = await mod.client.from('projects').select('id').eq('id', card.id);
        check("moderator can see another user's card", (byMod || []).length === 1);
        const { data: byEditor } = await editorB.client.from('projects').select('id').eq('id', card.id);
        check("editor still cannot see another user's card", (byEditor || []).length === 0);
        await admin.from('projects').delete().eq('id', card.id);
    }
    await refuses('moderator cannot change roles', mod.client.rpc('set_member_role', { p_user_id: editorB.id, p_role: 'moderator' }));
    await refuses('admin cannot change their own role', owner.client.rpc('set_member_role', { p_user_id: owner.id, p_role: 'reader' }));
    {
        const other = await makeUser('adm2', 'admin');
        await refuses('an admin cannot be demoted through the app', owner.client.rpc('set_member_role', { p_user_id: other.id, p_role: 'reader' }));
        await refuses('an admin cannot be banned through the app', owner.client.rpc('ban_member', { p_user_id: other.id, p_reason: 'x' }));
    }
    await noEffect('admin cannot demote themselves by PATCHing profiles directly', owner.client.from('profiles').update({ role: 'reader' }).eq('id', owner.id), async () => {
        const { data } = await admin.from('profiles').select('role').eq('id', owner.id).single();
        return data.role === 'admin';
    });
    await noEffect('admin cannot ban anyone by PATCHing profiles directly', owner.client.from('profiles').update({ role: 'banned', banned_at: new Date().toISOString() })
        .eq('id', editorA.id), async () => {
        const { data } = await admin.from('profiles').select('role').eq('id', editorA.id).single();
        return data.role === 'editor';
    });
    {
        const { error } = await owner.client.from('profiles')
            .update({ username: 'renamed-by-admin' }).eq('id', editorA.id);
        check('admin can still rename a member (moderation still works)', !error, error?.message);
    }
    {
        const { error } = await owner.client.rpc('set_member_role', { p_user_id: editorB.id, p_role: 'reader' });
        check('admin can demote', !error, error?.message);
        const { data } = await admin.from('profiles').select('role, role_locked').eq('id', editorB.id).single();
        check('demotion persists and locks the role against re-promotion', data.role === 'reader' && data.role_locked === true);
    }
    const { data: villainCard } = await admin.from('projects')
        .insert({ user_id: villain.id, data: { t: 1 }, name: 'before the ban' }).select().single();
    const { data: villainStatus } = await admin.from('custom_statuses')
        .insert({ user_id: villain.id, name: 'before the ban', key: `v_${Date.now()}` }).select().single();
    {
        const { error } = await owner.client.rpc('ban_member', { p_user_id: villain.id, p_reason: 'testing' });
        check('admin can ban', !error, error?.message);
        const { data: prof } = await admin.from('profiles').select('role, banned_reason').eq('id', villain.id).single();
        check('ban sets the role and reason', prof.role === 'banned' && prof.banned_reason === 'testing');
    }
    {
        const { error: e1 } = await villain.client.from('projects')
            .insert({ user_id: villain.id, data: { t: 1 }, name: 'nope' });
        check('banned: cannot create cards', !!e1);
        const { error: e2 } = await villain.client.from('custom_statuses')
            .insert({ user_id: villain.id, name: 'x', key: `nope_${Date.now()}` });
        check('banned: cannot create statuses', !!e2);
        check('banned: cannot propose', !!(await submit(villain, 'nope')).error);
        await noEffect('banned: cannot rewrite their existing cards', villain.client.from('projects').update({ name: 'defaced' }).eq('id', villainCard.id), async () => {
            const { data } = await admin.from('projects').select('name').eq('id', villainCard.id).single();
            return data.name === 'before the ban';
        });
        await noEffect('banned: cannot delete their cards (which would cascade off live pages)', villain.client.from('projects').delete().eq('id', villainCard.id), async () => {
            const { count } = await admin.from('projects')
                .select('id', { count: 'exact', head: true }).eq('id', villainCard.id);
            return count === 1;
        });
        await noEffect('banned: cannot rewrite their globally-visible status tokens', villain.client.from('custom_statuses').update({ name: 'defaced' }).eq('id', villainStatus.id), async () => {
            const { data } = await admin.from('custom_statuses').select('name').eq('id', villainStatus.id).single();
            return data.name === 'before the ban';
        });
        await noEffect('banned: cannot rename themselves', villain.client.from('profiles').update({ username: 'defaced' }).eq('id', villain.id), async () => {
            const { data } = await admin.from('profiles').select('username').eq('id', villain.id).single();
            return data.username !== 'defaced';
        });
        await noEffect('banned: cannot clear their own ban record', villain.client.from('profiles').update({ banned_at: null, banned_reason: null }).eq('id', villain.id), async () => {
            const { data } = await admin.from('profiles').select('banned_at').eq('id', villain.id).single();
            return data.banned_at !== null;
        });
        await villain.client.rpc('record_page_view', { p_page_id: page.id });
        const { count: trailRows } = await admin.from('wiki_page_views')
            .select('user_id', { count: 'exact', head: true }).eq('user_id', villain.id);
        check('banned: cannot write themselves into the public read trail', trailRows === 0);
        const { error: upErr } = await villain.client.storage.from('project-images')
            .upload(`${villain.id}/defaced-${Date.now()}.png`, new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), { contentType: 'image/png' });
        check('banned: cannot replace images in the public bucket', !!upErr);
        await admin.from('projects').delete().eq('id', villainCard.id);
        await admin.from('custom_statuses').delete().eq('id', villainStatus.id);
    }
    {
        const { count: merged } = await admin.from('wiki_page_proposals')
            .select('id', { count: 'exact', head: true }).eq('author_id', editorA.id).eq('state', 'merged');
        check('a merged proposal is kept as a review record', merged >= 1);
        await refuses('editor cannot purge proposals', editorA.client.rpc('purge_proposals', { p_author_id: editorA.id }));
        const { data: removed, error } = await mod.client.rpc('purge_proposals', { p_author_id: editorA.id });
        check('maintainer can clear an author\'s finished proposals', !error && removed >= 1, error?.message);
        const { data: logged } = await admin.from('moderation_log')
            .select('detail').eq('action', 'proposal.merge').limit(1);
        check('the merge log stands alone without the proposal row', (logged || []).length === 1 && !!logged[0].detail.summary && !!logged[0].detail.page_slug);
    }
    {
        await editorA.client.rpc('record_page_view', { p_page_id: page.id });
        const { data } = await admin.from('wiki_page_views')
            .select('view_count').eq('page_id', page.id).eq('user_id', editorA.id);
        check('a view is recorded', (data || []).length === 1);
        await editorA.client.rpc('record_page_view', { p_page_id: page.id });
        const { data: again } = await admin.from('wiki_page_views')
            .select('view_count').eq('page_id', page.id).eq('user_id', editorA.id).single();
        check('a re-read within a minute does not inflate the count', again.view_count === 1);
        const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
        const { data: trail, error: trailErr } = await anon.from('wiki_page_views')
            .select('user_id').eq('page_id', page.id);
        check('the trail is refused to anon at the grant, not merely filtered', trailErr?.code === '42501', trailErr ? `code ${trailErr.code}` : `no error, ${(trail || []).length} rows`);
        const { data: memberSees } = await editorB.client.from('wiki_page_views')
            .select('user_id').eq('page_id', page.id);
        check('a signed-in member can still read the trail', (memberSees || []).some((r) => r.user_id === editorA.id));
        const { data: beforeRows } = await admin.from('wiki_page_views').select('user_id').eq('page_id', page.id);
        await anon.rpc('record_page_view', { p_page_id: page.id });
        const { data: after } = await admin.from('wiki_page_views').select('user_id').eq('page_id', page.id);
        check('an anonymous call records nothing', (after || []).length === (beforeRows || []).length);
    }
    {
        await editorA.client.rpc('set_read_receipts', { p_on: false });
        const { data: purged } = await admin.from('wiki_page_views').select('user_id').eq('user_id', editorA.id);
        check('opting out deletes the trail rows already recorded', (purged || []).length === 0);
        await editorA.client.rpc('record_page_view', { p_page_id: page.id });
        const { data: none } = await admin.from('wiki_page_views').select('user_id').eq('user_id', editorA.id);
        check('opted out: nothing is recorded, not merely hidden', (none || []).length === 0);
        await admin.from('wiki_page_views').insert({ page_id: page.id, user_id: editorA.id });
        const { data: hidden } = await editorB.client.from('wiki_page_views')
            .select('user_id').eq('page_id', page.id).eq('user_id', editorA.id);
        check('an opted-out member is absent from another member\'s trail', (hidden || []).length === 0);
        await editorA.client.rpc('set_read_receipts', { p_on: true });
        const { data: backAgain } = await editorB.client.from('wiki_page_views')
            .select('user_id').eq('page_id', page.id).eq('user_id', editorA.id);
        check('opting back in makes the surviving rows visible again', (backAgain || []).length === 1);
        await editorA.client.from('profiles').update({ show_read_receipts: false }).eq('id', editorA.id);
        const { data: patchPurged } = await admin.from('wiki_page_views').select('user_id').eq('user_id', editorA.id);
        check('a direct PATCH to the column purges too, not just the RPC', (patchPurged || []).length === 0);
        await admin.from('wiki_page_views').insert({ page_id: page.id, user_id: villain.id });
        await villain.client.rpc('set_read_receipts', { p_on: false });
        const { data: villainRows } = await admin.from('wiki_page_views')
            .select('user_id').eq('user_id', villain.id);
        check('banned: can still purge their own read trail', (villainRows || []).length === 0);
        await refuses('banned: cannot switch recording back on', villain.client.rpc('set_read_receipts', { p_on: true }));
        await admin.from('wiki_page_views').insert({ page_id: page.id, user_id: editorB.id });
        await refuses('an admin cannot flip another member\'s read receipts', owner.client.from('profiles').update({ show_read_receipts: false }).eq('id', editorB.id));
        const { data: bRows } = await admin.from('wiki_page_views')
            .select('user_id').eq('user_id', editorB.id);
        check('...so one member\'s trail cannot be purged out from under them', (bRows || []).length === 1);
        const { data: bFlag } = await admin.from('profiles')
            .select('show_read_receipts').eq('id', editorB.id).single();
        check('...and their preference is left alone', bFlag.show_read_receipts === true);
        await editorA.client.rpc('set_read_receipts', { p_on: false });
        await admin.from('wiki_page_views').insert({ page_id: page.id, user_id: editorA.id });
        await editorA.client.rpc('set_read_receipts', { p_on: false });
        const { data: raced } = await admin.from('wiki_page_views')
            .select('user_id').eq('user_id', editorA.id);
        check('opting out again clears a row that raced in', (raced || []).length === 0);
    }
    {
        const { error: emptyErr } = await admin.from('wiki_pages')
            .insert({ slug: '', title: 'no slug', status: 'draft', created_by: editorA.id });
        check('a page cannot be created with an empty slug', emptyErr?.code === '23514', emptyErr ? `code ${emptyErr.code}` : 'the insert was ALLOWED');
        const { error: blankErr } = await admin.from('wiki_pages')
            .insert({ slug: '   ', title: 'blank slug', status: 'draft', created_by: editorA.id });
        check('whitespace does not count as a slug', blankErr?.code === '23514', blankErr ? `code ${blankErr.code}` : 'the insert was ALLOWED');
        const { error: wipeErr } = await admin.from('wiki_pages')
            .update({ slug: '' }).eq('id', page.id);
        check('an existing page cannot be blanked to an empty slug', wipeErr?.code === '23514', wipeErr ? `code ${wipeErr.code}` : 'the update was ALLOWED');
        const { error: noTitleErr } = await admin.from('wiki_pages')
            .insert({ slug: `rls4-untitled-${Date.now()}`, title: '', status: 'draft', created_by: editorA.id });
        check('a page cannot be created with an empty title', noTitleErr?.code === '23514', noTitleErr ? `code ${noTitleErr.code}` : 'the insert was ALLOWED');
        const { error: blankTitleErr } = await admin.from('wiki_pages')
            .update({ title: '   ' }).eq('id', page.id);
        check('whitespace does not count as a title', blankTitleErr?.code === '23514', blankTitleErr ? `code ${blankTitleErr.code}` : 'the update was ALLOWED');
        const { data: stillThere } = await admin.from('wiki_pages')
            .select('title').eq('id', page.id).single();
        check('...and the title it had is untouched by either refusal', stillThere.title === 'RLS4 Page', `title is ${stillThere.title}`);
    }
    {
        const token = `zzsearch${Date.now()}`;
        const draft = await newPage(editorA.id, 'draft');
        await admin.from('wiki_pages').update({ title: `${token} draft` }).eq('id', draft.id);
        const pub = await newPage(editorA.id, 'published');
        await admin.from('wiki_pages').update({ title: `${token} published` }).eq('id', pub.id);
        const anonS = createClient(URL_, ANON, { auth: { persistSession: false } });
        const { data: anonHits, error: anonErr } = await anonS.rpc('search_wiki_pages', { p_query: token });
        const anonSlugs = (anonHits || []).map((r) => r.slug);
        check('anon can search, and finds a published page', !anonErr && anonSlugs.includes(pub.slug), anonErr?.message ?? anonSlugs.join(','));
        check('...but the search does not hand anon a draft', !anonSlugs.includes(draft.slug), anonSlugs.join(','));
        const { data: mineHits } = await editorA.client.rpc('search_wiki_pages', { p_query: token });
        check('...while the author still finds their own draft through it', (mineHits || []).some((r) => r.slug === draft.slug));
        const { data: partial } = await anonS.rpc('search_wiki_pages', { p_query: token.slice(0, 9) });
        check('a partial word still matches, which is what search does on every keystroke', (partial || []).some((r) => r.slug === pub.slug));
        const { error: opErr } = await anonS.rpc('search_wiki_pages', { p_query: "') | x:* --" });
        check('tsquery syntax in the query is not an error, it is just text', !opErr, opErr?.message ?? '');
    }
    {
        const anon2 = createClient(URL_, ANON, { auth: { persistSession: false } });
        for (const [tbl, row] of [
            ['moderation_log', { action: 'forged', target_type: 'profile' }],
            ['wiki_page_views', { page_id: page.id, user_id: editorA.id }],
        ]) {
            const { error: anonErr } = await anon2.from(tbl).insert(row);
            check(`anon cannot insert into ${tbl}`, anonErr?.code === '42501', anonErr ? `code ${anonErr.code}` : 'the call was ALLOWED');
            const { error: memberErr } = await editorA.client.from(tbl).insert(row);
            check(`a member cannot insert into ${tbl} either`, memberErr?.code === '42501', memberErr ? `code ${memberErr.code}` : 'the call was ALLOWED');
        }
        const { error: banErr } = await anon2.from('profiles').select('banned_reason').limit(1);
        check('anon cannot read ban bookkeeping', banErr?.code === '42501', banErr ? `code ${banErr.code}` : 'the call was ALLOWED');
        const { error: roleErr } = await anon2.from('profiles').select('role').limit(1);
        check('anon cannot read who is banned via role', roleErr?.code === '42501', roleErr ? `code ${roleErr.code}` : 'the call was ALLOWED');
        const { data: byline } = await anon2.from('profiles').select('id, username, avatar_icon').limit(1);
        check('...but the byline columns a published page needs still work', (byline || []).length === 1);
    }
    {
        const { data } = await editorA.client.from('moderation_log').select('id').limit(1);
        check('editor cannot read the moderation log', (data || []).length === 0);
        const { data: modSees } = await mod.client.from('moderation_log').select('id').limit(1);
        check('moderator can read the moderation log', (modSees || []).length >= 1);
    }
}
catch (err) {
    console.error('\nHARNESS ERROR:', err.message);
    results.push({ name: 'harness', ok: false });
}
finally {
    console.log('\nCleaning up...');
    let dirty = false;
    const del = async (label, promise) => {
        const { error } = await promise;
        if (error) {
            dirty = true;
            console.error(`CLEANUP FAILED - ${label}: ${error.message}`);
        }
    };
    if (createdUsers.length) {
        await del('moderation_log by actor', admin.from('moderation_log').delete().in('actor_id', createdUsers));
        await del('moderation_log by target', admin.from('moderation_log').delete().in('target_id', createdUsers));
    }
    for (const id of createdPages) {
        await del(`moderation_log for page ${id}`, admin.from('moderation_log').delete().eq('target_id', id));
        await del(`page ${id}`, admin.from('wiki_pages').delete().eq('id', id));
    }
    for (const slug of createdCategories) {
        await del(`page tags for ${slug}`, admin.from('wiki_page_categories').delete().eq('category_slug', slug));
        await del(`category ${slug}`, admin.from('wiki_categories').delete().eq('slug', slug));
    }
    if (createdImages.length) {
        const { error } = await admin.storage.from('wiki-images').remove(createdImages);
        if (error) {
            dirty = true;
            console.error(`CLEANUP FAILED - wiki images: ${error.message}`);
        }
    }
    for (const id of createdUsers) {
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) {
            dirty = true;
            console.error(`CLEANUP FAILED - user ${id}: ${error.message}`);
        }
    }
    const [{ data: leftUsers }, { data: leftPages }, { count: orphans }] = await Promise.all([
        admin.from('profiles').select('id, username, role').in('id', createdUsers.length ? createdUsers : ['00000000-0000-0000-0000-000000000000']),
        admin.from('wiki_pages').select('id, slug, status').in('id', createdPages.length ? createdPages : ['00000000-0000-0000-0000-000000000000']),
        admin.from('moderation_log').select('id', { count: 'exact', head: true }).is('actor_id', null),
    ]);
    if (createdCategories.length) {
        const { data: leftCats } = await admin.from('wiki_categories').select('slug').in('slug', createdCategories);
        for (const c of leftCats || []) {
            dirty = true;
            console.error(`STILL ON THE DATABASE: category ${c.slug}`);
        }
    }
    for (const path of createdImages) {
        const there = await imageExists(path);
        if (there !== false) {
            dirty = true;
            console.error(there === null
                ? `COULD NOT CONFIRM wiki image ${path} was deleted`
                : `STILL ON THE DATABASE: wiki image ${path}`);
        }
    }
    for (const u of leftUsers || []) {
        dirty = true;
        console.error(`STILL ON THE DATABASE: profile ${u.id} ${u.username} ${u.role}`);
    }
    for (const pg of leftPages || []) {
        dirty = true;
        console.error(`STILL ON THE DATABASE: page ${pg.id} ${pg.slug} ${pg.status}`);
    }
    if (orphans) {
        dirty = true;
        console.error(`STILL ON THE DATABASE: ${orphans} orphaned moderation_log rows`);
    }
    if (dirty) {
        console.error('\nCLEANUP INCOMPLETE - this is production. Remove the rows above by hand.');
        cleanupFailed = true;
    }
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
    console.log('FAILED: ' + failed.map((f) => f.name).join(', '));
}
if (failed.length || cleanupFailed)
    process.exit(1);
