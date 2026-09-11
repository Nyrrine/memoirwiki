import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env.local', 'utf-8').split('\n').filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const URL_ = env.VITE_SUPABASE_URL, ANON = env.VITE_SUPABASE_ANON_KEY, SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL_, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
const PW = 'adm-' + Math.random().toString(36).slice(2);
const results = [];
const check = (name, ok, detail = '') => {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? `\n        ${detail}` : ''}`);
};
const createdUsers = [];
const createdPages = [];
async function makeUser(tag, role) {
    const email = `adm-${tag}-${Date.now()}@test.local`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
    if (error)
        throw new Error(`createUser ${tag}: ${error.message}`);
    createdUsers.push(data.user.id);
    if (role !== 'reader')
        await admin.from('profiles').update({ role }).eq('id', data.user.id);
    const client = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { error: se } = await client.auth.signInWithPassword({ email, password: PW });
    if (se)
        throw new Error(`signIn ${tag}: ${se.message}`);
    return { client, id: data.user.id };
}
function extractQueries(path) {
    const src = readFileSync(path, 'utf-8');
    const re = /\.from\('([^']+)'\)\s*\n?\s*\.select\('([^']*)'/g;
    const found = [];
    let m;
    while ((m = re.exec(src)) !== null)
        found.push({ table: m[1], select: m[2] });
    return found;
}
try {
    const mod = await makeUser('mod', 'moderator');
    const editor = await makeUser('ed', 'editor');
    console.log('Test users ready.\n');
    const { data: page } = await admin.from('wiki_pages')
        .insert({ slug: `adm-${Date.now()}`, title: 'Admin Panel Test', status: 'published', created_by: editor.id })
        .select().single();
    createdPages.push(page.id);
    const { data: card } = await admin.from('projects')
        .insert({ user_id: editor.id, data: { t: 1 }, name: 'Admin Panel Card' }).select().single();
    const stranger = await makeUser('other', 'editor');
    const { data: strangerCard } = await admin.from('projects')
        .insert({ user_id: stranger.id, data: { t: 2 }, name: 'Not Yours' }).select().single();
    const { data: status } = await admin.from('custom_statuses')
        .insert({ user_id: editor.id, name: 'Admin Panel Status', key: `adm_${Date.now()}` }).select().single();
    const stampNow = async () => {
        const { data } = await admin.from('wiki_pages').select('updated_at').eq('id', page.id).single();
        return data.updated_at;
    };
    const { data: propId, error: propErr } = await editor.client.rpc('submit_proposal', {
        p_page_id: page.id, p_base_updated_at: await stampNow(),
        p_title: 'Admin Panel Test', p_subtitle: 'proposed change',
        p_cover_image: null, p_sections: [], p_link_slugs: [],
        p_kind: 'lore', p_is_memoir: false, p_category_slugs: [], p_summary: 'smoke test',
    });
    check('a proposal exists for the queue', !!propId && !propErr, propErr?.message);
    await editor.client.rpc('record_page_view', { p_page_id: page.id });
    const queries = extractQueries('src/lib/adminPersistence.ts');
    const tablesCovered = new Set(queries.map((q) => q.table));
    const mustCover = ['wiki_page_proposals', 'wiki_pages', 'profiles', 'projects',
        'custom_statuses', 'moderation_log', 'wiki_page_views'];
    const missing = mustCover.filter((t) => !tablesCovered.has(t));
    check('every table the panel reads is covered by this test', missing.length === 0, `not matched by the extractor: ${missing.join(', ')}`);
    for (const q of queries) {
        const { error } = await mod.client.from(q.table).select(q.select).limit(5);
        const label = `${q.table}: ${q.select.length > 62 ? q.select.slice(0, 62) + '...' : q.select}`;
        check(label, !error, error ? `${error.code || ''} ${error.message}` : '');
    }
    {
        const { data } = await mod.client
            .from('wiki_page_proposals')
            .select('id, author:profiles!wiki_page_proposals_author_id_fkey(username), page:wiki_pages!wiki_page_proposals_page_id_fkey(slug, updated_at)')
            .eq('id', propId).single();
        check('proposal join returns an author name', data?.author?.username != null);
        check('proposal join returns the page', data?.page?.slug === page.slug);
    }
    {
        const { data } = await mod.client
            .from('wiki_pages')
            .select('id, author:profiles!wiki_pages_created_by_fkey(username)')
            .eq('id', page.id).single();
        check('page join returns an author name', data?.author?.username != null);
    }
    {
        const { data: cards, error: cardErr } = await mod.client
            .from('projects').select('id, user_id, name').eq('id', card.id);
        check('moderator can read another user\'s card', !cardErr && cards?.length === 1, cardErr?.message);
        const { data: who } = await mod.client.from('profiles').select('id, username').eq('id', editor.id);
        check('owner name is resolvable for that card', who?.[0]?.username != null);
    }
    {
        const { data } = await mod.client
            .from('custom_statuses')
            .select('id, owner:profiles!custom_statuses_user_id_fkey(username)')
            .eq('id', status.id).single();
        check('status join returns an owner name', data?.owner?.username != null);
    }
    {
        const { data } = await mod.client
            .from('wiki_page_views')
            .select('page_id, view_count, page:wiki_pages!wiki_page_views_page_id_fkey(slug, title)')
            .eq('page_id', page.id);
        check('read-trail join returns the page', data?.[0]?.page?.slug === page.slug);
    }
    {
        const { data: fresh } = await admin.from('wiki_page_proposals')
            .select('updated_at').eq('id', propId).single();
        const { error } = await mod.client.rpc('merge_proposal', {
            p_id: propId, p_expected_updated_at: fresh.updated_at, p_note: 'smoke test',
        });
        check('merge from the panel succeeds with the content pin', !error, error?.message);
    }
    {
        const { error } = await mod.client.from('wiki_pages').update({ status: 'draft' }).eq('id', page.id);
        check('moderator can unpublish from the panel', !error, error?.message);
        await admin.from('wiki_pages').update({ status: 'published' }).eq('id', page.id);
    }
    {
        const { data, error } = await mod.client.from('moderation_log')
            .select('*, actor:profiles!moderation_log_actor_id_fkey(username)')
            .eq('target_id', page.id);
        check('the merge shows up in the activity feed', !error && (data || []).length >= 1 && data[0].actor?.username != null, error?.message);
    }
    {
        const { data: p } = await editor.client.from('wiki_page_proposals').select('id').neq('author_id', editor.id);
        check("editor cannot read other people's proposals", (p || []).length === 0);
        const { data: l } = await editor.client.from('moderation_log').select('id').limit(1);
        check('editor cannot read the moderation log', (l || []).length === 0);
        const { data: c } = await editor.client.from('projects').select('id').eq('id', strangerCard.id);
        check("editor cannot read someone else's unlinked card", (c || []).length === 0);
        const { data: m } = await mod.client.from('projects').select('id').eq('id', strangerCard.id);
        check('moderator can read that same card', (m || []).length === 1);
    }
    {
        const { error } = await mod.client.rpc('admin_set_page_status', {
            p_page_id: page.id, p_status: 'archived',
        });
        check('moderator can archive through the RPC', !error, error?.message);
        const { data: logged } = await admin.from('moderation_log')
            .select('action, detail').eq('target_id', page.id).eq('action', 'page.status');
        check('archiving is written to the log', (logged || []).length === 1 && logged[0].detail.to === 'archived');
        await admin.from('wiki_pages').update({ status: 'published' }).eq('id', page.id);
    }
    {
        const { error } = await editor.client.rpc('admin_delete_card', { p_card_id: strangerCard.id });
        check('an editor cannot delete someone else\'s card', !!error && /maintainer/i.test(error.message), error?.message || 'was allowed');
    }
    {
        const { error } = await mod.client.rpc('admin_delete_card', {
            p_card_id: strangerCard.id, p_reason: 'smoke test',
        });
        check('moderator can delete a card through the RPC', !error, error?.message);
        const { count } = await admin.from('projects')
            .select('id', { count: 'exact', head: true }).eq('id', strangerCard.id);
        check('the card is really gone', count === 0);
        const { data: logged } = await admin.from('moderation_log')
            .select('detail').eq('action', 'card.delete').eq('target_id', stranger.id);
        check('the card deletion names the owner and the reason', (logged || []).length === 1 && logged[0].detail.reason === 'smoke test');
    }
    {
        const { error } = await mod.client.rpc('admin_delete_status', {
            p_status_id: status.id, p_reason: 'smoke test',
        });
        check('moderator can delete a status through the RPC', !error, error?.message);
        const { data: logged } = await admin.from('moderation_log')
            .select('detail').eq('action', 'status.delete').eq('target_id', editor.id);
        check('the status deletion is logged with its key', (logged || []).length === 1 && !!logged[0].detail.key);
    }
    {
        const { error } = await editor.client.rpc('admin_delete_page', { p_page_id: page.id });
        check('an editor cannot delete a page through the RPC', !!error && /maintainer/i.test(error.message), error?.message || 'was allowed');
    }
    {
        await new Promise((r) => setTimeout(r, 5200));
        const { error: pErr } = await editor.client.rpc('submit_proposal', {
            p_page_id: page.id, p_base_updated_at: await stampNow(),
            p_title: 'Admin Panel Test', p_subtitle: 'second pass',
            p_cover_image: null,
            p_sections: [
                { id: crypto.randomUUID(), type: 'richtext', heading: 'Visible',
                    content: [{ type: 'paragraph', children: [{ text: 'ordinary body text' }] }] },
                { id: crypto.randomUUID(), type: 'divider', style: 'gold', text: 'ZZSMUGGLEDZZ' },
                { id: crypto.randomUUID(), type: 'divider', style: 'gold', junk: { heading: 'ZZSMUGGLEDZZ' } },
            ],
            p_link_slugs: [],
            p_kind: 'lore', p_is_memoir: false, p_category_slugs: [], p_summary: 'looks harmless',
        });
        check('a proposal carrying smuggled section text is accepted', !pErr, pErr?.message);
        const { data: prop } = await admin.from('wiki_page_proposals')
            .select('id, updated_at').eq('page_id', page.id).eq('state', 'open').maybeSingle();
        check('the proposal is in the queue', !!prop);
        const { error: mErr } = prop
            ? await mod.client.rpc('merge_proposal', { p_id: prop.id, p_expected_updated_at: prop.updated_at })
            : { error: { message: 'no proposal to merge' } };
        check('it merges', !mErr, mErr?.message);
        const { data: merged } = await admin.from('wiki_pages')
            .select('search_text').eq('id', page.id).single();
        check('text smuggled into a section that renders none is not indexed either', !merged.search_text.includes('ZZSMUGGLEDZZ'), `search_text: ${merged.search_text.slice(0, 200)}`);
        check('search text is derived from the visible content instead', merged.search_text.includes('ordinary body text'), merged.search_text.slice(0, 120));
        for (const term of ['ZZSMUGGLEDZZ']) {
            const { data: found } = await admin.from('wiki_pages')
                .select('id').textSearch('search_tsv', term, { type: 'websearch', config: 'english' });
            check(`and the page cannot be found by searching for ${term}`, (found || []).length === 0);
        }
        let deep = [{ text: 'ZZDEEPLEAFZZ' }];
        for (let i = 0; i < 500; i++)
            deep = [{ type: 'paragraph', children: deep }];
        const started = Date.now();
        const { error: deepErr } = await admin.from('wiki_pages')
            .update({ sections: [{ id: crypto.randomUUID(), type: 'richtext', heading: 'Deep', content: deep }] })
            .eq('id', page.id);
        const elapsed = Date.now() - started;
        check('a deeply nested payload is refused, and refused promptly', !!deepErr && /nested too deeply/i.test(deepErr.message) && elapsed < 3000, deepErr ? `${deepErr.message} (${elapsed}ms)` : `accepted in ${elapsed}ms`);
        const { data: deepRow } = await admin.from('wiki_pages')
            .select('search_text').eq('id', page.id).single();
        check('nothing from the rejected payload reached the index', !deepRow.search_text.includes('ZZDEEPLEAFZZ'), `search_text: ${deepRow.search_text.slice(0, 120)}`);
        for (const [label, bad] of [
            ['an unknown section type', [{ id: 'x', type: 'evil-script' }]],
            ['a section with no id', [{ type: 'richtext', heading: 'x' }]],
            ['sections that are not a list', { id: 'x', type: 'richtext' }],
        ]) {
            const { error } = await admin.from('wiki_pages').update({ sections: bad }).eq('id', page.id);
            check(`${label} is refused`, !!error, 'was accepted');
        }
    }
    {
        const { error } = await mod.client.rpc('admin_delete_page', {
            p_page_id: page.id, p_reason: 'smoke test',
        });
        check('moderator can delete a page through the RPC', !error, error?.message);
        const { count } = await admin.from('wiki_pages')
            .select('id', { count: 'exact', head: true }).eq('id', page.id);
        check('the page is really gone', count === 0);
        const { data: logged } = await admin.from('moderation_log')
            .select('detail').eq('action', 'page.delete').eq('target_id', page.id);
        check('the page deletion records what went with it', (logged || []).length === 1 && typeof logged[0].detail.proposals_lost === 'number');
    }
    await admin.from('projects').delete().eq('id', card.id);
    await admin.from('custom_statuses').delete().eq('id', status.id);
}
catch (err) {
    console.error('\nHARNESS ERROR:', err.message);
    results.push({ name: 'harness', ok: false });
}
finally {
    console.log('\nCleaning up...');
    if (createdUsers.length) {
        await admin.from('moderation_log').delete().in('actor_id', createdUsers);
        await admin.from('moderation_log').delete().in('target_id', createdUsers);
    }
    for (const id of createdPages) {
        await admin.from('moderation_log').delete().eq('target_id', id);
        await admin.from('wiki_pages').delete().eq('id', id);
    }
    for (const id of createdUsers)
        await admin.auth.admin.deleteUser(id);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
    console.log('FAILED: ' + failed.map((f) => f.name).join(', '));
    process.exit(1);
}
