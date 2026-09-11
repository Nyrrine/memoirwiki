import { supabase } from './supabase';
const BUCKET = 'project-images';
export function isBlobUrl(url: string | null | undefined): boolean {
    return typeof url === 'string' && url.startsWith('blob:');
}
export async function uploadBlobUrl(blobUrl: string, userId: string, projectId: string, fieldPath: string): Promise<string> {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    const ext = mimeToExt(blob.type);
    const storagePath = `${userId}/${projectId}/${fieldPath}.${ext}`;
    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, blob, { upsert: true, contentType: blob.type });
    if (error)
        throw new Error(`Upload failed for ${fieldPath}: ${error.message}`);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    return `${data.publicUrl}?v=${Date.now()}`;
}
export async function persistProjectImages(data: Record<string, unknown>, userId: string, projectId: string): Promise<Record<string, unknown>> {
    const result = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
    await uploadField(result, 'portraitUrl', userId, projectId, 'portrait');
    await uploadField(result, 'sinnerIconUrl', userId, projectId, 'sinnerIcon');
    await uploadField(result, 'mirrorWorldIconUrl', userId, projectId, 'mirrorWorldIcon');
    await uploadField(result, 'rightColumnBgUrl', userId, projectId, 'rightColumnBg');
    const sanity = result.sanity as Record<string, unknown> | undefined;
    if (sanity) {
        await uploadField(sanity, 'panicIconUrl', userId, projectId, 'sanity_panicIcon');
    }
    const skills = result.skills as Record<string, unknown>[] | undefined;
    if (skills) {
        for (let i = 0; i < skills.length; i++) {
            await uploadField(skills[i], 'skillIconUrl', userId, projectId, `skill_${i}_icon`);
            const coinEffects = skills[i].coinEffects as Record<string, unknown>[] | undefined;
            if (coinEffects) {
                for (let j = 0; j < coinEffects.length; j++) {
                    await uploadField(coinEffects[j], 'coinIconUrl', userId, projectId, `skill_${i}_coin_${j}_icon`);
                }
            }
        }
    }
    const defenseSkills = result.defenseSkills as Record<string, unknown>[] | undefined;
    if (defenseSkills) {
        for (let i = 0; i < defenseSkills.length; i++) {
            await uploadField(defenseSkills[i], 'skillIconUrl', userId, projectId, `defense_${i}_icon`);
        }
    }
    for (const key of ['combatPassives', 'supportPassives', 'customEffects', 'mentalEffects'] as const) {
        const passives = result[key] as Record<string, unknown>[] | undefined;
        if (passives) {
            for (let i = 0; i < passives.length; i++) {
                await uploadField(passives[i], 'iconUrl', userId, projectId, `${key}_${i}_icon`);
            }
        }
    }
    return result;
}
async function uploadField(obj: Record<string, unknown>, field: string, userId: string, projectId: string, fieldPath: string): Promise<void> {
    const url = obj[field] as string | null | undefined;
    if (isBlobUrl(url)) {
        obj[field] = await uploadBlobUrl(url!, userId, projectId, fieldPath);
    }
}
export async function deleteProjectImages(userId: string, projectId: string): Promise<void> {
    const prefix = `${userId}/${projectId}/`;
    const { data: files } = await supabase.storage.from(BUCKET).list(prefix);
    if (files && files.length > 0) {
        const paths = files.map((f) => `${prefix}${f.name}`);
        await supabase.storage.from(BUCKET).remove(paths);
    }
}
function mimeToExt(mime: string): string {
    const map: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
        'image/gif': 'gif',
    };
    return map[mime] || 'png';
}
export function adoptPersistedUrls(local: unknown, saved: unknown): void {
    if (Array.isArray(local) && Array.isArray(saved)) {
        const byId = new Map<string, unknown>();
        for (const item of saved) {
            const id = entryId(item);
            if (id)
                byId.set(id, item);
        }
        for (const item of local) {
            const id = entryId(item);
            const match = id ? byId.get(id) : undefined;
            if (match)
                adoptPersistedUrls(item, match);
        }
        return;
    }
    if (!local || !saved || typeof local !== 'object' || typeof saved !== 'object')
        return;
    const l = local as Record<string, unknown>;
    const r = saved as Record<string, unknown>;
    for (const key of Object.keys(l)) {
        const lv = l[key];
        const rv = r[key];
        if (typeof lv === 'string') {
            if (isBlobUrl(lv) && typeof rv === 'string' && rv && !isBlobUrl(rv))
                l[key] = rv;
        }
        else {
            adoptPersistedUrls(lv, rv);
        }
    }
}
function entryId(item: unknown): string | null {
    if (!item || typeof item !== 'object')
        return null;
    const id = (item as Record<string, unknown>).id;
    return typeof id === 'string' && id ? id : null;
}
