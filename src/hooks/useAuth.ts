import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
export type MemberRole = 'banned' | 'reader' | 'editor' | 'moderator' | 'admin';
const ROLE_ORDER: Record<MemberRole, number> = {
    banned: 0,
    reader: 1,
    editor: 2,
    moderator: 3,
    admin: 4,
};
export function roleAtLeast(role: MemberRole | null | undefined, min: MemberRole): boolean {
    if (!role)
        return false;
    return ROLE_ORDER[role] >= ROLE_ORDER[min];
}
export interface Profile {
    id: string;
    username: string;
    role: MemberRole;
    avatar_icon: string | null;
    created_at: string;
    show_read_receipts: boolean;
}
interface AuthState {
    user: User | null;
    session: Session | null;
    profile: Profile | null;
    loading: boolean;
    initialized: boolean;
    error: string | null;
    initialize: () => Promise<void>;
    signInWithDiscord: () => Promise<void>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    clearError: () => void;
    setAvatarIcon: (icon: string) => Promise<void>;
    setReadReceipts: (on: boolean) => Promise<void>;
}
export const useAuth = create<AuthState>()((set, get) => ({
    user: null,
    session: null,
    profile: null,
    loading: true,
    initialized: false,
    error: null,
    initialize: async () => {
        if (get().initialized)
            return;
        set({ initialized: true, loading: true, error: null });
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error)
                throw error;
            if (session?.user) {
                const profile = await fetchProfile(session.user.id);
                set({ user: session.user, session, profile, loading: false });
            }
            else {
                set({ loading: false });
            }
            supabase.auth.onAuthStateChange(async (_event, newSession) => {
                if (newSession?.user) {
                    const current = get();
                    if (current.user?.id === newSession.user.id && current.profile) {
                        set({ user: newSession.user, session: newSession });
                    }
                    else {
                        const profile = await fetchProfile(newSession.user.id);
                        set({ user: newSession.user, session: newSession, profile });
                    }
                }
                else {
                    set({ user: null, session: null, profile: null });
                }
            });
        }
        catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                set({ initialized: false, loading: true });
                return;
            }
            set({ loading: false, initialized: false, error: 'Failed to initialize auth' });
        }
    },
    signInWithDiscord: async () => {
        set({ error: null, loading: true });
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                scopes: 'identify email guilds',
            },
        });
        if (error) {
            set({ error: error.message, loading: false });
        }
    },
    signOut: async () => {
        await supabase.auth.signOut();
        set({ user: null, session: null, profile: null });
    },
    refreshProfile: async () => {
        const { user } = get();
        if (!user)
            return;
        const profile = await fetchProfile(user.id);
        if (profile)
            set({ profile });
    },
    clearError: () => set({ error: null }),
    setAvatarIcon: async (icon: string) => {
        const { profile } = get();
        if (!profile)
            return;
        set({ profile: { ...profile, avatar_icon: icon } });
        const { error } = await supabase
            .from('profiles')
            .update({ avatar_icon: icon })
            .eq('id', profile.id);
        if (error) {
            console.error('Failed to save avatar:', error.message);
            const current = get().profile;
            if (current)
                set({ profile: { ...current, avatar_icon: profile.avatar_icon } });
        }
    },
    setReadReceipts: async (on: boolean) => {
        const { profile } = get();
        if (!profile)
            return;
        const previous = profile.show_read_receipts;
        set({ profile: { ...profile, show_read_receipts: on } });
        const { error } = await supabase.rpc('set_read_receipts', { p_on: on });
        if (error) {
            const current = get().profile;
            if (current)
                set({ profile: { ...current, show_read_receipts: previous } });
            throw new Error(error.message);
        }
    },
}));
async function fetchProfile(userId: string): Promise<Profile | null> {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) {
            console.warn('Failed to fetch profile:', error.message);
            return null;
        }
        const row = data as Record<string, unknown>;
        return {
            id: row.id as string,
            username: row.username as string,
            role: (row.role as MemberRole) || 'reader',
            avatar_icon: (row.avatar_icon as string) || null,
            created_at: row.created_at as string,
            show_read_receipts: row.show_read_receipts !== false,
        };
    }
    catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError')
            return null;
        console.warn('Failed to fetch profile:', err);
        return null;
    }
}
