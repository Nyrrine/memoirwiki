import { supabase } from './supabase';
import { persistProjectImages, deleteProjectImages } from './imageUpload';
import type { ProjectData } from '../types/project';
export interface SavedProjectMeta {
    id: string;
    user_id: string;
    name: string;
    character_name: string | null;
    rarity: number;
    portrait_url: string | null;
    created_at: string;
    updated_at: string;
}
export interface SavedProject extends SavedProjectMeta {
    data: ProjectData;
}
export async function saveProject(project: ProjectData, userId: string, existingProjectId?: string): Promise<{
    id: string;
    data: ProjectData;
}> {
    const projectId = existingProjectId || project.id;
    const persistedData = await persistProjectImages(project as unknown as Record<string, unknown>, userId, projectId);
    const pd = persistedData as unknown as ProjectData;
    const row = {
        id: projectId,
        user_id: userId,
        data: persistedData,
        name: pd.identityName || pd.characterName || 'Untitled',
        rarity: pd.rarity || 1,
        portrait_url: pd.portraitUrl || null,
    };
    const { error } = await supabase
        .from('projects')
        .upsert(row, { onConflict: 'id' });
    if (error)
        throw new Error(`Save failed: ${error.message}`);
    return { id: projectId, data: pd };
}
export async function loadProject(projectId: string): Promise<SavedProject | null> {
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
    if (error) {
        if (error.code === 'PGRST116')
            return null;
        throw new Error(`Load failed: ${error.message}`);
    }
    return data as SavedProject;
}
export async function listUserProjects(userId: string): Promise<SavedProjectMeta[]> {
    const { data, error } = await supabase
        .from('projects')
        .select('id, user_id, name, rarity, portrait_url, created_at, updated_at, data->>characterName')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
    if (error)
        throw new Error(`List failed: ${error.message}`);
    return (data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        user_id: row.user_id as string,
        name: row.name as string,
        character_name: (row.characterName as string) || null,
        rarity: row.rarity as number,
        portrait_url: (row.portrait_url as string) || null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
    }));
}
export async function listProjectMetas(projectIds: string[]): Promise<SavedProjectMeta[]> {
    if (projectIds.length === 0)
        return [];
    const { data, error } = await supabase
        .from('projects')
        .select("id, user_id, name, rarity, portrait_url, created_at, updated_at, data->>characterName")
        .in('id', projectIds);
    if (error)
        throw new Error(`List failed: ${error.message}`);
    return (data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        user_id: row.user_id as string,
        name: row.name as string,
        character_name: (row.characterName as string) || null,
        rarity: row.rarity as number,
        portrait_url: (row.portrait_url as string) || null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
    }));
}
export async function deleteProject(projectId: string, userId: string): Promise<void> {
    await deleteProjectImages(userId, projectId);
    const { data, error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', userId)
        .select('id');
    if (error)
        throw new Error(`Delete failed: ${error.message}`);
    if (!data || data.length === 0)
        throw new Error('Delete failed: project not found or permission denied');
}
