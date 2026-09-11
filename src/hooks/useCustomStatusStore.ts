import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { CustomStatus } from '../types/customStatus';
import { listCustomStatuses, createCustomStatus as createStatusApi, deleteCustomStatus as deleteStatusApi, } from '../lib/customStatusPersistence';
interface CustomStatusStore {
    statuses: CustomStatus[];
    loading: boolean;
    error: string | null;
    loadStatuses: () => Promise<void>;
    addStatus: (userId: string, name: string, key: string, classification: 'standard' | 'neutral' | 'positive' | 'negative', iconFile?: File) => Promise<void>;
    removeStatus: (id: string, userId: string) => Promise<void>;
}
export const useCustomStatusStore = create<CustomStatusStore>()(immer((set) => ({
    statuses: [],
    loading: false,
    error: null,
    loadStatuses: async () => {
        set((s) => { s.loading = true; s.error = null; });
        try {
            const statuses = await listCustomStatuses();
            set((s) => { s.statuses = statuses; s.loading = false; });
        }
        catch (err) {
            set((s) => {
                s.error = err instanceof Error ? err.message : 'Failed to load';
                s.loading = false;
            });
        }
    },
    addStatus: async (userId, name, key, classification, iconFile) => {
        try {
            const status = await createStatusApi(userId, name, key, classification, iconFile);
            set((s) => { s.statuses.push(status); });
        }
        catch (err) {
            set((s) => { s.error = err instanceof Error ? err.message : 'Failed to create'; });
            throw err;
        }
    },
    removeStatus: async (id, userId) => {
        try {
            await deleteStatusApi(id, userId);
            set((s) => {
                const idx = s.statuses.findIndex((st) => st.id === id);
                if (idx !== -1)
                    s.statuses.splice(idx, 1);
            });
        }
        catch (err) {
            set((s) => { s.error = err instanceof Error ? err.message : 'Failed to delete'; });
            throw err;
        }
    },
})));
