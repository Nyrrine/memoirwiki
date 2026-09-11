import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env.local', 'utf-8').split('\n').filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const URL_ = env.VITE_SUPABASE_URL, ANON = env.VITE_SUPABASE_ANON_KEY, SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL_, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
const PW = 'rls-test-' + Math.random().toString(36).slice(2);
const results = [];
const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`);
};
const createdUserIds = [];
async function makeUser(tag, role) {
    const email = `rls-test-${tag}-${Date.now()}@test.local`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
    if (error)
        throw new Error(`createUser ${tag}: ${error.message}`);
    createdUserIds.push(data.user.id);
    if (role !== 'reader') {
        const { error: roleErr } = await admin.from('profiles').update({ role }).eq('id', data.user.id);
        if (roleErr)
            throw new Error(`set role ${tag}: ${roleErr.message}`);
    }
    const client = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { error: signErr } = await client.auth.signInWithPassword({ email, password: PW });
    if (signErr)
        throw new Error(`signIn ${tag}: ${signErr.message}`);
    return { client, id: data.user.id };
}
let pageIds = [];
try {
    const reader = await makeUser('reader', 'reader');
    const editor = await makeUser('editor', 'editor');
    const mod = await makeUser('mod', 'moderator');
    console.log('Test users ready.\n');
    {
        const { data } = await anon.from('profiles').select('id').in('id', createdUserIds);
        check('anon reads profiles (attribution)', (data || []).length === 3);
    }
    const { data: draft, error: draftErr } = await editor.client.from('wiki_pages')
        .insert({ slug: 'rls-test-draft', title: 'RLS Draft' }).select().single();
    check('editor creates page', !draftErr, draftErr?.message);
    if (draft)
        pageIds.push(draft.id);
    const { data: pub, error: pubErr } = await editor.client.from('wiki_pages')
        .insert({ slug: 'rls-test-pub', title: 'RLS Published', status: 'published' }).select().single();
    check('editor creates published page', !pubErr, pubErr?.message);
    if (pub)
        pageIds.push(pub.id);
    {
        const { error } = await reader.client.from('wiki_pages').insert({ slug: 'rls-test-reader', title: 'x' });
        check('reader CANNOT create page', !!error);
    }
    {
        const { error } = await anon.from('wiki_pages').insert({ slug: 'rls-test-anon', title: 'x' });
        check('anon CANNOT create page', !!error);
    }
    {
        const { data } = await anon.from('wiki_pages').select('slug').like('slug', 'rls-test%');
        const slugs = (data || []).map((r) => r.slug);
        check('anon sees only published', slugs.length === 1 && slugs[0] === 'rls-test-pub', slugs.join(','));
    }
    {
        const { data } = await reader.client.from('wiki_pages').select('slug').like('slug', 'rls-test%');
        check('reader sees only published', (data || []).length === 1);
    }
    {
        const { data } = await editor.client.from('wiki_pages').select('slug').like('slug', 'rls-test%');
        check('editor sees drafts too', (data || []).length === 2);
    }
    check('created_by stamped to editor', draft?.created_by === editor.id, String(draft?.created_by));
    {
        const { error } = await mod.client.from('wiki_pages')
            .update({ title: 'RLS Draft (edited by mod)', sections: [{ id: 'x', type: 'divider', style: 'gold' }] })
            .eq('id', draft.id);
        check('another editor updates the page', !error, error?.message);
    }
    {
        const { error } = await reader.client.from('wiki_pages').update({ title: 'nope' }).eq('id', pub.id);
        const { data } = await editor.client.from('wiki_pages').select('title').eq('id', pub.id).single();
        check('reader CANNOT update page', !error && data?.title === 'RLS Published');
    }
    {
        const { data } = await editor.client.from('wiki_revisions').select('id, author_id').eq('page_id', draft.id);
        check('revision trigger wrote history', (data || []).length === 2, `${(data || []).length} revisions (editor insert + mod edit, different authors)`);
    }
    {
        await mod.client.from('wiki_pages').update({ title: 'RLS Draft (mod again)' }).eq('id', draft.id);
        const { data } = await editor.client.from('wiki_revisions').select('id').eq('page_id', draft.id);
        check('consecutive same-author saves collapse', (data || []).length === 2, `${(data || []).length} revisions`);
    }
    {
        const { data } = await reader.client.from('wiki_revisions').select('id').eq('page_id', draft.id);
        check('reader CANNOT read revisions', (data || []).length === 0);
    }
    {
        const { data } = await editor.client.from('wiki_pages').delete().eq('id', draft.id).select('id');
        check('editor CANNOT delete page', (data || []).length === 0);
    }
    {
        const { data } = await mod.client.from('wiki_pages').delete().eq('id', draft.id).select('id');
        check('moderator deletes page', (data || []).length === 1);
        if ((data || []).length === 1)
            pageIds = pageIds.filter((id) => id !== draft.id);
    }
    {
        const { error } = await reader.client.from('profiles').update({ role: 'admin' }).eq('id', reader.id);
        check('reader CANNOT self-promote', !!error, error?.message);
    }
    {
        const { error } = await mod.client.from('profiles').update({ role: 'admin' }).eq('id', mod.id);
        check('moderator CANNOT self-promote', !!error, error?.message);
    }
    {
        const { error } = await editor.client.from('custom_statuses')
            .insert({ user_id: editor.id, name: 'RLS Test', key: 'rls_test_status' });
        check('editor creates custom status', !error, error?.message);
    }
    {
        const { data } = await anon.from('custom_statuses').select('key').eq('key', 'rls_test_status');
        check('anon reads custom statuses', (data || []).length === 1);
    }
    {
        const { error } = await reader.client.from('custom_statuses')
            .insert({ user_id: reader.id, name: 'x', key: 'rls_test_reader' });
        check('reader CANNOT create custom status', !!error);
    }
    {
        const { data: proj, error: projErr } = await editor.client.from('projects')
            .insert({ user_id: editor.id, data: { identityName: 'RLS Card' }, name: 'RLS Card' }).select().single();
        check('member creates own card', !projErr, projErr?.message);
        if (proj) {
            const { data: before } = await anon.from('projects').select('id').eq('id', proj.id);
            check('anon CANNOT see unlinked card', (before || []).length === 0);
            const { error: linkErr } = await editor.client.from('wiki_page_projects')
                .insert({ wiki_page_id: pub.id, project_id: proj.id });
            check('editor links own card to page', !linkErr, linkErr?.message);
            const { data: after } = await anon.from('projects').select('id').eq('id', proj.id);
            check('anon sees card once linked to published page', (after || []).length === 1);
            const { data: anonLinks } = await anon.from('wiki_page_projects').select('id').eq('wiki_page_id', pub.id);
            check('anon reads junction rows of published page', (anonLinks || []).length === 1);
            const { error: stealErr } = await mod.client.from('wiki_page_projects')
                .insert({ wiki_page_id: pub.id, project_id: proj.id, display_order: 1 });
            check("editor CANNOT link someone else's card", !!stealErr, stealErr ? 'blocked' : 'NOT blocked');
        }
    }
}
finally {
    console.log('\nCleaning up...');
    for (const id of pageIds)
        await admin.from('wiki_pages').delete().eq('id', id);
    for (const id of createdUserIds)
        await admin.auth.admin.deleteUser(id);
    await admin.from('wiki_pages').delete().like('slug', 'rls-test%');
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length > 0 ? 1 : 0);
