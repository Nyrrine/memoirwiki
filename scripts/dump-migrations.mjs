import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env.local', 'utf-8').split('\n').filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }, db: { schema: 'supabase_migrations' } });
const { data, error } = await db.from('schema_migrations').select('version, name, statements').gte('version', '20260907');
if (error) {
    console.error(`Could not read supabase_migrations: ${error.message}`);
    console.error('Expected. PostgREST does not expose that schema; this needs a');
    console.error('direct Postgres connection (the database password), not the');
    console.error('service role key. See the note at the top of this file.');
    process.exit(1);
}
mkdirSync('supabase/migrations', { recursive: true });
for (const m of data) {
    const body = (m.statements || []).join(';\n\n') + ';\n';
    const path = `supabase/migrations/${m.version}_${m.name}.sql`;
    writeFileSync(path, body);
    console.log(`${path}  (${body.length} bytes)`);
}
