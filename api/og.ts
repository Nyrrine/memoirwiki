import type { VercelRequest, VercelResponse } from '@vercel/node';
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
function esc(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function page(title: string, description: string, url: string, image?: string | null): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta property="og:site_name" content="Memoir Wiki">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="theme-color" content="#d4af37">
<meta http-equiv="refresh" content="0;url=${esc(url)}">
</head>
<body>Redirecting to <a href="${esc(url)}">${esc(title)}</a>...</body>
</html>`;
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
    const pageUrl = `${proto}://${host}/wiki/page/${encodeURIComponent(slug)}`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    if (!slug || !supabaseUrl || !anonKey) {
        return res.status(200).send(page('Memoir Wiki', 'A Project Moon community lore wiki.', pageUrl));
    }
    try {
        const apiRes = await fetch(`${supabaseUrl}/rest/v1/wiki_pages?slug=eq.${encodeURIComponent(slug)}&select=title,subtitle,cover_image`, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
        const rows = (await apiRes.json()) as {
            title: string;
            subtitle: string | null;
            cover_image: string | null;
        }[];
        const row = Array.isArray(rows) ? rows[0] : undefined;
        if (!row) {
            return res.status(200).send(page('Memoir Wiki', 'A Project Moon community lore wiki.', pageUrl));
        }
        return res.status(200).send(page(row.title, row.subtitle || 'A page on the Memoir lore wiki.', pageUrl, row.cover_image));
    }
    catch {
        return res.status(200).send(page('Memoir Wiki', 'A Project Moon community lore wiki.', pageUrl));
    }
}
