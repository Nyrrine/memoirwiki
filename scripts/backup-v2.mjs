import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env.local', 'utf-8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});
const TABLES = ['profiles', 'projects', 'wiki_pages', 'wiki_page_projects', 'custom_statuses'];
const backup = { exported_at: new Date().toISOString(), tables: {} };
for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
        console.error(`FAILED ${table}: ${error.message}`);
        process.exit(1);
    }
    backup.tables[table] = data;
    console.log(`${table}: ${data.length} rows`);
}
const { data: users, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (authError) {
    console.error(`FAILED auth users: ${authError.message}`);
    process.exit(1);
}
backup.tables.auth_users = users.users.map((u) => ({
    id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
}));
console.log(`auth_users: ${users.users.length} rows`);
mkdirSync('backups', { recursive: true });
const path = `backups/v2-backup-${new Date().toISOString().slice(0, 10)}.json`;
writeFileSync(path, JSON.stringify(backup, null, 2));
console.log(`\nWrote ${path}`);
