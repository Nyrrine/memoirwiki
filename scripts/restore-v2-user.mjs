import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
        const key = argv[i].slice(2);
        if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
            args[key] = argv[++i];
        }
        else {
            args[key] = true;
        }
    }
}
if (!args.backup || !args['old-username'] || !args['new-user-id']) {
    console.error('Required: --backup <file> --old-username <name> --new-user-id <uuid>');
    process.exit(1);
}
const env = Object.fromEntries(readFileSync('.env.local', 'utf-8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});
const backup = JSON.parse(readFileSync(args.backup, 'utf-8'));
const oldProfile = backup.tables.profiles.find((p) => p.username === args['old-username']);
if (!oldProfile) {
    console.error(`No v2 profile with username "${args['old-username']}". Available: ${backup.tables.profiles.map((p) => p.username).join(', ')}`);
    process.exit(1);
}
const newUserId = args['new-user-id'];
const { data: newProfile, error: profErr } = await supabase
    .from('profiles').select('id, username').eq('id', newUserId).single();
if (profErr || !newProfile) {
    console.error(`No v3 profile with id ${newUserId} - has the user signed in with Discord yet?`);
    process.exit(1);
}
console.log(`Restoring v2 "${oldProfile.username}" -> v3 "${newProfile.username}" (${newUserId})\n`);
const projects = backup.tables.projects.filter((p) => p.user_id === oldProfile.id);
let restored = 0;
for (const p of projects) {
    const { error } = await supabase.from('projects').upsert({
        id: p.id, user_id: newUserId, data: p.data, name: p.name,
        rarity: p.rarity, portrait_url: p.portrait_url, created_at: p.created_at,
    }, { onConflict: 'id' });
    if (error)
        console.warn(`  card "${p.name}": ${error.message}`);
    else
        restored++;
}
console.log(`Cards: ${restored}/${projects.length} restored`);
if (args.statuses) {
    const statuses = backup.tables.custom_statuses.filter((s) => s.user_id === oldProfile.id);
    let ok = 0;
    for (const s of statuses) {
        const { error } = await supabase.from('custom_statuses').insert({
            id: s.id, user_id: newUserId, name: s.name, key: s.key,
            icon_url: s.icon_url, classification: s.classification, created_at: s.created_at,
        });
        if (error)
            console.warn(`  status "${s.key}": ${error.message}`);
        else
            ok++;
    }
    console.log(`Custom statuses: ${ok}/${statuses.length} restored`);
}
if (args.wiki) {
    const pages = backup.tables.wiki_pages.filter((w) => w.user_id === oldProfile.id);
    let ok = 0;
    for (const w of pages) {
        let slug = w.slug;
        const { data: taken } = await supabase.from('wiki_pages').select('id').eq('slug', slug).maybeSingle();
        if (taken && taken.id !== w.id)
            slug = `${w.slug}-${oldProfile.username.toLowerCase()}`;
        const { error } = await supabase.from('wiki_pages').upsert({
            id: w.id, slug, title: w.title, subtitle: w.subtitle,
            cover_image: w.cover_image, sections: w.sections,
            kind: w.is_guide ? 'guide' : 'character',
            status: w.published ? 'published' : 'draft',
            created_by: newUserId, updated_by: newUserId, created_at: w.created_at,
            global_bg_color: w.global_bg_color, global_accent_color: w.global_accent_color,
            global_text_color: w.global_text_color, global_font: w.global_font,
        }, { onConflict: 'id' });
        if (error) {
            console.warn(`  page "${w.title}": ${error.message}`);
            continue;
        }
        ok++;
        const links = backup.tables.wiki_page_projects.filter((l) => l.wiki_page_id === w.id);
        for (const l of links) {
            const { error: linkErr } = await supabase.from('wiki_page_projects').upsert({
                id: l.id, wiki_page_id: l.wiki_page_id, project_id: l.project_id,
                display_order: l.display_order, detail_sections: l.detail_sections,
            }, { onConflict: 'id' });
            if (linkErr)
                console.warn(`    link on "${w.title}": ${linkErr.message}`);
        }
    }
    console.log(`Wiki pages: ${ok}/${pages.length} restored`);
}
console.log('\nDone.');
