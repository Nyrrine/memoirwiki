import { supabase } from './supabase';
import type { CustomStatus } from '../types/customStatus';
const BUCKET = 'custom-status-icons';
export async function listCustomStatuses(): Promise<CustomStatus[]> {
    const { data, error } = await supabase
        .from('custom_statuses')
        .select('*')
        .order('created_at', { ascending: true });
    if (error)
        throw new Error(`List custom statuses failed: ${error.message}`);
    return (data || []) as CustomStatus[];
}
export async function createCustomStatus(userId: string, name: string, key: string, classification: 'standard' | 'neutral' | 'positive' | 'negative', iconFile?: File): Promise<CustomStatus> {
    let iconUrl: string | null = null;
    if (iconFile) {
        iconUrl = await uploadStatusIcon(userId, key, iconFile);
    }
    const { data, error } = await supabase
        .from('custom_statuses')
        .insert({
        user_id: userId,
        name,
        key,
        classification,
        icon_url: iconUrl,
    })
        .select()
        .single();
    if (error) {
        if (error.code === '23505')
            throw new Error('This status key is already taken (keys are shared across the whole site).');
        throw new Error(`Create custom status failed: ${error.message}`);
    }
    return data as CustomStatus;
}
export async function updateCustomStatus(id: string, userId: string, updates: {
    name?: string;
    classification?: string;
    iconFile?: File;
}): Promise<CustomStatus> {
    const patch: Record<string, unknown> = {};
    if (updates.name !== undefined)
        patch.name = updates.name;
    if (updates.classification !== undefined)
        patch.classification = updates.classification;
    if (updates.iconFile) {
        const { data: current } = await supabase
            .from('custom_statuses')
            .select('key')
            .eq('id', id)
            .single();
        if (current) {
            patch.icon_url = await uploadStatusIcon(userId, current.key, updates.iconFile);
        }
    }
    const { data, error } = await supabase
        .from('custom_statuses')
        .update(patch)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
    if (error)
        throw new Error(`Update custom status failed: ${error.message}`);
    return data as CustomStatus;
}
export async function deleteCustomStatus(id: string, userId: string): Promise<void> {
    const { data, error } = await supabase
        .from('custom_statuses')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .select('id, key');
    if (error)
        throw new Error(`Delete custom status failed: ${error.message}`);
    if (!data || data.length === 0)
        throw new Error('Delete failed: status not found');
    const key = (data[0] as {
        key: string;
    }).key;
    const prefix = `${userId}/${key}`;
    const { data: files } = await supabase.storage.from(BUCKET).list(prefix);
    if (files && files.length > 0) {
        await supabase.storage.from(BUCKET).remove(files.map((f) => `${prefix}/${f.name}`));
    }
}
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
async function uploadStatusIcon(userId: string, statusKey: string, file: File): Promise<string> {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
        throw new Error('Only PNG, JPEG, WebP, and GIF images are allowed.');
    }
    const ext = file.name.split('.').pop() || 'png';
    const storagePath = `${userId}/${statusKey}/icon.${ext}`;
    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { upsert: true, contentType: file.type });
    if (error)
        throw new Error(`Icon upload failed: ${error.message}`);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    return `${data.publicUrl}?v=${Date.now()}`;
}
