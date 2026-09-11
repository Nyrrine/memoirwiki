import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env.local', 'utf-8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});
const TABLES = [
    'profiles',
    'projects',
    'wiki_pages',
    'wiki_revisions',
    'wiki_links',
    'wiki_categories',
    'wiki_page_categories',
    'wiki_page_projects',
    'custom_statuses',
    'wiki_page_proposals',
    'wiki_page_views',
    'moderation_log',
];
const BUCKETS = ['project-images', 'wiki-images', 'custom-status-icons'];
const PAGE = 1000;
async function fetchAll(table) {
    const rows = [];
    for (let from = 0;; from += PAGE) {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .range(from, from + PAGE - 1);
        if (error)
            throw new Error(`${table}: ${error.message}`);
        rows.push(...data);
        if (data.length < PAGE)
            break;
    }
    return rows;
}
const backup = {
    exported_at: new Date().toISOString(),
    project_url: env.VITE_SUPABASE_URL,
    tables: {},
    storage: {},
};
for (const table of TABLES) {
    const rows = await fetchAll(table);
    backup.tables[table] = rows;
    console.log(`${table}: ${rows.length} rows`);
}
const { data: users, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (authError) {
    console.error(`FAILED auth users: ${authError.message}`);
    process.exit(1);
}
backup.tables.auth_users = users.users.map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    raw_user_meta_data: u.user_metadata,
}));
console.log(`auth_users: ${users.users.length} rows`);
for (const bucket of BUCKETS) {
    const { data, error } = await supabase.storage.from(bucket).list('', { limit: 1000 });
    if (error) {
        console.warn(`storage ${bucket}: ${error.message}`);
        continue;
    }
    backup.storage[bucket] = data.map((f) => f.name);
    console.log(`storage/${bucket}: ${data.length} top-level entries`);
}
mkdirSync('backups', { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const path = `backups/db-${stamp}.json`;
const serialized = JSON.stringify(backup, null, 2);
writeFileSync(path, serialized);
const bytes = Buffer.byteLength(serialized);
console.log(`\nwrote ${path} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
