import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const guildId = process.env.DISCORD_GUILD_ID;
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({ error: 'Server not configured' });
    }
    if (!guildId) {
        return res.status(200).json({ promoted: false, reason: 'guild-gating disabled' });
    }
    const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const providerToken = (req.body as {
        providerToken?: string;
    } | undefined)?.providerToken;
    if (!accessToken || !providerToken) {
        return res.status(400).json({ error: 'Missing tokens' });
    }
    const admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
    if (userError || !userData.user) {
        return res.status(401).json({ error: 'Invalid session' });
    }
    const userId = userData.user.id;
    const { data: profile } = await admin
        .from('profiles')
        .select('role, role_locked')
        .eq('id', userId)
        .single();
    if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
    }
    if (profile.role_locked) {
        return res.status(200).json({ promoted: false, reason: 'role set by a maintainer' });
    }
    if (profile.role !== 'reader') {
        return res.status(200).json({ promoted: false, reason: 'already promoted' });
    }
    const discordRes = await fetch('https://discord.com/api/users/@me/guilds?limit=200', {
        headers: { Authorization: `Bearer ${providerToken}` },
    });
    if (!discordRes.ok) {
        return res.status(502).json({ error: `Discord API error (${discordRes.status})` });
    }
    const guilds = (await discordRes.json()) as {
        id: string;
    }[];
    if (!guilds.some((g) => g.id === guildId)) {
        return res.status(200).json({ promoted: false, reason: 'not a member' });
    }
    const { error: updateError } = await admin
        .from('profiles')
        .update({ role: 'editor' })
        .eq('id', userId)
        .eq('role', 'reader')
        .eq('role_locked', false);
    if (updateError) {
        return res.status(500).json({ error: 'Promotion failed' });
    }
    return res.status(200).json({ promoted: true });
}
