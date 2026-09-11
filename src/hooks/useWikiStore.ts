import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { WikiPageData, WikiPageKind, WikiPageStatus, WikiSection, WikiSectionType, WikiPageProject } from '../types/wiki';
import { createDefaultSection } from '../types/wiki';
import { adoptPersistedUrls, isBlobUrl } from '../lib/imageUpload';
export const MAX_SECTIONS_PER_PAGE = 100;
interface WikiStore {
    page: WikiPageData | null;
    linkedProjects: WikiPageProject[];
    categorySlugs: string[];
    isDirty: boolean;
    saving: boolean;
    setTitle: (title: string) => void;
    setSlug: (slug: string) => void;
    setSubtitle: (subtitle: string | null) => void;
    setCoverImage: (url: string | null) => void;
    setStatus: (status: WikiPageStatus) => void;
    setKind: (kind: WikiPageKind) => void;
    setIsMemoir: (isMemoir: boolean) => void;
    setCategorySlugs: (slugs: string[]) => void;
    setGlobalBgColor: (color: string | undefined) => void;
    setGlobalAccentColor: (color: string | undefined) => void;
    setGlobalTextColor: (color: string | undefined) => void;
    setGlobalFont: (font: string | undefined) => void;
    addSection: (type: WikiSectionType) => void;
    insertSectionAt: (type: WikiSectionType, index: number) => void;
    updateSection: (id: string, patch: Partial<WikiSection>) => void;
    removeSection: (id: string) => void;
    applyResolvedSection: (id: string, section: WikiSection | null, fallbackIndex: number) => boolean;
    reorderSection: (from: number, to: number) => void;
    setLinkedProjects: (projects: WikiPageProject[]) => void;
    linkProject: (projectId: string) => void;
    unlinkProject: (projectId: string) => void;
    reorderProjects: (from: number, to: number) => void;
    setIdentityDetailSections: (wikiPageProjectId: string, sections: WikiSection[]) => void;
    loadPage: (page: WikiPageData, linkedProjects?: WikiPageProject[], categorySlugs?: string[]) => void;
    applyServerRow: (row: WikiPageData) => void;
    setSaving: (saving: boolean) => void;
    beginSave: () => void;
    failSave: () => void;
    markClean: (updatedPage?: WikiPageData, editedDuringSave?: boolean) => void;
    resetPage: () => void;
}
export const useWikiStore = create<WikiStore>()(immer((set, get) => ({
    page: null,
    linkedProjects: [],
    categorySlugs: [],
    isDirty: false,
    saving: false,
    setTitle: (title) => set((s) => { if (s.page) {
        s.page.title = title;
        s.isDirty = true;
    } }),
    setSlug: (slug) => set((s) => { if (s.page) {
        s.page.slug = slug;
        s.isDirty = true;
    } }),
    setSubtitle: (subtitle) => set((s) => { if (s.page) {
        s.page.subtitle = subtitle;
        s.isDirty = true;
    } }),
    setCoverImage: (url) => set((s) => { if (s.page) {
        s.page.cover_image = url;
        s.isDirty = true;
    } }),
    setStatus: (status) => set((s) => { if (s.page) {
        s.page.status = status;
        s.isDirty = true;
    } }),
    setKind: (kind) => set((s) => { if (s.page) {
        s.page.kind = kind;
        s.isDirty = true;
    } }),
    setIsMemoir: (isMemoir) => set((s) => { if (s.page) {
        s.page.is_memoir = isMemoir;
        s.isDirty = true;
    } }),
    setCategorySlugs: (slugs) => set((s) => { s.categorySlugs = slugs; s.isDirty = true; }),
    setGlobalBgColor: (color) => set((s) => { if (s.page) {
        s.page.global_bg_color = color;
        s.isDirty = true;
    } }),
    setGlobalAccentColor: (color) => set((s) => { if (s.page) {
        s.page.global_accent_color = color;
        s.isDirty = true;
    } }),
    setGlobalTextColor: (color) => set((s) => { if (s.page) {
        s.page.global_text_color = color;
        s.isDirty = true;
    } }),
    setGlobalFont: (font) => set((s) => { if (s.page) {
        s.page.global_font = font;
        s.isDirty = true;
    } }),
    addSection: (type) => set((s) => {
        if (s.page && s.page.sections.length < MAX_SECTIONS_PER_PAGE) {
            s.page.sections.push(createDefaultSection(type) as WikiSection);
            s.isDirty = true;
        }
    }),
    insertSectionAt: (type, index) => set((s) => {
        if (s.page && s.page.sections.length < MAX_SECTIONS_PER_PAGE) {
            s.page.sections.splice(index, 0, createDefaultSection(type) as WikiSection);
            s.isDirty = true;
        }
    }),
    updateSection: (id, patch) => set((s) => {
        if (s.page) {
            const section = s.page.sections.find((sec) => sec.id === id);
            if (section) {
                Object.assign(section, patch);
                s.isDirty = true;
            }
        }
    }),
    removeSection: (id) => set((s) => {
        if (s.page) {
            const idx = s.page.sections.findIndex((sec) => sec.id === id);
            if (idx !== -1) {
                s.page.sections.splice(idx, 1);
                s.isDirty = true;
            }
        }
    }),
    applyResolvedSection: (id, section, fallbackIndex) => {
        const page = get().page;
        if (!page)
            return false;
        const idx = page.sections.findIndex((sec) => sec.id === id);
        if (section === null && idx === -1)
            return true;
        if (section !== null && idx === -1 && page.sections.length >= MAX_SECTIONS_PER_PAGE) {
            return false;
        }
        set((s) => {
            if (!s.page)
                return;
            const at = s.page.sections.findIndex((sec) => sec.id === id);
            if (section === null) {
                if (at !== -1) {
                    s.page.sections.splice(at, 1);
                    s.isDirty = true;
                }
                return;
            }
            if (at !== -1) {
                s.page.sections.splice(at, 1, section);
            }
            else {
                const into = Math.max(0, Math.min(fallbackIndex, s.page.sections.length));
                s.page.sections.splice(into, 0, section);
            }
            s.isDirty = true;
        });
        return true;
    },
    reorderSection: (from, to) => set((s) => {
        if (s.page) {
            const [section] = s.page.sections.splice(from, 1);
            s.page.sections.splice(to, 0, section);
            s.isDirty = true;
        }
    }),
    setLinkedProjects: (projects) => set((s) => { s.linkedProjects = projects; }),
    linkProject: (projectId) => set((s) => {
        if (!s.linkedProjects.some((lp) => lp.project_id === projectId)) {
            s.linkedProjects.push({
                id: crypto.randomUUID(),
                wiki_page_id: s.page?.id || '',
                project_id: projectId,
                display_order: s.linkedProjects.length,
                detail_sections: [],
            });
            s.isDirty = true;
        }
    }),
    unlinkProject: (projectId) => set((s) => {
        const idx = s.linkedProjects.findIndex((lp) => lp.project_id === projectId);
        if (idx !== -1) {
            s.linkedProjects.splice(idx, 1);
            s.isDirty = true;
        }
    }),
    reorderProjects: (from, to) => set((s) => {
        const [project] = s.linkedProjects.splice(from, 1);
        s.linkedProjects.splice(to, 0, project);
        s.linkedProjects.forEach((p, i) => { p.display_order = i; });
        s.isDirty = true;
    }),
    setIdentityDetailSections: (wikiPageProjectId, sections) => set((s) => {
        const link = s.linkedProjects.find((lp) => lp.id === wikiPageProjectId);
        if (link) {
            link.detail_sections = sections;
            s.isDirty = true;
        }
    }),
    loadPage: (page, linkedProjects, categorySlugs) => set((s) => {
        s.page = page;
        s.linkedProjects = linkedProjects || [];
        s.categorySlugs = categorySlugs || [];
        s.isDirty = false;
        s.saving = false;
    }),
    applyServerRow: (row) => set((s) => {
        if (!s.page)
            return;
        s.page.status = row.status;
        s.page.updated_at = row.updated_at;
        s.page.updated_by = row.updated_by;
    }),
    setSaving: (saving) => set((s) => { s.saving = saving; }),
    beginSave: () => set((s) => { s.saving = true; }),
    failSave: () => set((s) => { s.saving = false; }),
    markClean: (updatedPage, editedDuringSave = false) => set((s) => {
        if (updatedPage) {
            if (!editedDuringSave) {
                s.page = updatedPage;
            }
            else if (s.page) {
                s.page.updated_at = updatedPage.updated_at;
                s.page.updated_by = updatedPage.updated_by;
                s.page.created_by = updatedPage.created_by;
                s.page.created_at = updatedPage.created_at;
                adoptPersistedUrls(s.page.sections, updatedPage.sections);
                if (isBlobUrl(s.page.cover_image) && updatedPage.cover_image
                    && !isBlobUrl(updatedPage.cover_image)) {
                    s.page.cover_image = updatedPage.cover_image;
                }
            }
        }
        s.isDirty = editedDuringSave;
        s.saving = false;
    }),
    resetPage: () => set((s) => {
        s.page = null;
        s.linkedProjects = [];
        s.categorySlugs = [];
        s.isDirty = false;
        s.saving = false;
    }),
})));
