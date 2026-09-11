import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ProjectData, Skill, DefenseSkill, Passive, Stats, SinType, Resistances, SanityData, UptieLevel } from '../types/project';
import { createDefaultProject } from '../lib/testData';
import { traitLabel, traitStruck } from '../types/project';
import { adoptPersistedUrls } from '../lib/imageUpload';
type PassiveArrayKey = 'combatPassives' | 'supportPassives' | 'mentalEffects' | 'customEffects';
const PASSIVE_TYPE_MAP: Record<string, PassiveArrayKey> = {
    combat: 'combatPassives',
    support: 'supportPassives',
    mental: 'mentalEffects',
    custom: 'customEffects',
};
interface ProjectStore {
    project: ProjectData;
    currentProjectId: string | null;
    isDirty: boolean;
    setCharacterName: (name: string) => void;
    setIdentityName: (name: string) => void;
    setRarity: (rarity: 1 | 2 | 3) => void;
    setLevel: (level: number) => void;
    setUptieLevel: (uptie: UptieLevel) => void;
    setSinAffinity: (sin: SinType) => void;
    setPortraitUrl: (url: string | null) => void;
    setSinnerIconUrl: (url: string | null) => void;
    addTrait: (tag: string) => void;
    removeTrait: (index: number) => void;
    toggleTraitStruck: (index: number) => void;
    setMirrorWorldIconUrl: (url: string | null) => void;
    setMirrorWorldName: (name: string) => void;
    setStats: (stats: Partial<Stats>) => void;
    setResistances: (resistances: Partial<Resistances>) => void;
    addSkill: (skill: Skill) => void;
    updateSkill: (id: string, patch: Partial<Skill>) => void;
    removeSkill: (id: string) => void;
    reorderSkills: (from: number, to: number) => void;
    addDefenseSkill: (skill: DefenseSkill) => void;
    updateDefenseSkill: (id: string, patch: Partial<DefenseSkill>) => void;
    removeDefenseSkill: (id: string) => void;
    addPassive: (type: 'combat' | 'support' | 'custom', passive: Passive) => void;
    updatePassive: (type: 'combat' | 'support' | 'custom', id: string, patch: Partial<Passive>) => void;
    removePassive: (type: 'combat' | 'support' | 'custom', id: string) => void;
    setSanity: (patch: Partial<SanityData>) => void;
    addSanityFactor: (type: 'increasing' | 'decreasing', text: string) => void;
    removeSanityFactor: (type: 'increasing' | 'decreasing', index: number) => void;
    updateSanityFactor: (type: 'increasing' | 'decreasing', index: number, text: string) => void;
    setCautionColor: (color: string) => void;
    setInfoBarBgColor: (color: string) => void;
    setRightColumnBgUrl: (url: string | null) => void;
    setRightColumnBgOpacity: (opacity: number) => void;
    loadProject: (project: ProjectData, projectId?: string | null) => void;
    resetProject: () => void;
    markClean: (projectId: string, persistedData?: ProjectData, editedDuringSave?: boolean) => void;
}
export const useProjectStore = create<ProjectStore>()(immer((set) => ({
    project: createDefaultProject(),
    currentProjectId: null,
    isDirty: false,
    setCharacterName: (name) => set((s) => { s.project.characterName = name; s.isDirty = true; }),
    setIdentityName: (name) => set((s) => { s.project.identityName = name; s.isDirty = true; }),
    setRarity: (rarity) => set((s) => { s.project.rarity = rarity; s.isDirty = true; }),
    setLevel: (level) => set((s) => { s.project.level = level; s.isDirty = true; }),
    setUptieLevel: (uptie) => set((s) => { s.project.uptieLevel = uptie; s.isDirty = true; }),
    setSinAffinity: (sin) => set((s) => { s.project.sinAffinity = sin; s.isDirty = true; }),
    setPortraitUrl: (url) => set((s) => { s.project.portraitUrl = url; s.isDirty = true; }),
    setSinnerIconUrl: (url) => set((s) => { s.project.sinnerIconUrl = url ?? undefined; s.isDirty = true; }),
    addTrait: (tag) => set((s) => {
        const trimmed = tag.trim();
        const already = s.project.traits.some((t) => traitLabel(t) === trimmed);
        if (trimmed && !already) {
            s.project.traits.push(trimmed);
            s.isDirty = true;
        }
    }),
    removeTrait: (index) => set((s) => { s.project.traits.splice(index, 1); s.isDirty = true; }),
    toggleTraitStruck: (index) => set((s) => {
        const current = s.project.traits[index];
        if (current === undefined)
            return;
        s.project.traits[index] = traitStruck(current)
            ? traitLabel(current)
            : { label: traitLabel(current), struck: true };
        s.isDirty = true;
    }),
    setMirrorWorldIconUrl: (url) => set((s) => { s.project.mirrorWorldIconUrl = url; s.isDirty = true; }),
    setMirrorWorldName: (name) => set((s) => { s.project.mirrorWorldName = name; s.isDirty = true; }),
    setStats: (stats) => set((s) => { Object.assign(s.project.stats, stats); s.isDirty = true; }),
    setResistances: (resistances) => set((s) => { Object.assign(s.project.stats.resistances, resistances); s.isDirty = true; }),
    addSkill: (skill) => set((s) => { s.project.skills.push(skill); s.isDirty = true; }),
    updateSkill: (id, patch) => set((s) => {
        const skill = s.project.skills.find((sk) => sk.id === id);
        if (skill) {
            Object.assign(skill, patch);
            if (patch.sinType && s.project.skills[0]?.id === id) {
                s.project.sinAffinity = patch.sinType;
            }
            s.isDirty = true;
        }
    }),
    removeSkill: (id) => set((s) => {
        const idx = s.project.skills.findIndex((sk) => sk.id === id);
        if (idx !== -1) {
            s.project.skills.splice(idx, 1);
            s.isDirty = true;
        }
    }),
    reorderSkills: (from, to) => set((s) => {
        const [skill] = s.project.skills.splice(from, 1);
        s.project.skills.splice(to, 0, skill);
        s.isDirty = true;
    }),
    addDefenseSkill: (skill) => set((s) => { s.project.defenseSkills.push(skill); s.isDirty = true; }),
    updateDefenseSkill: (id, patch) => set((s) => {
        const skill = s.project.defenseSkills.find((sk) => sk.id === id);
        if (skill) {
            Object.assign(skill, patch);
            s.isDirty = true;
        }
    }),
    removeDefenseSkill: (id) => set((s) => {
        const idx = s.project.defenseSkills.findIndex((sk) => sk.id === id);
        if (idx !== -1) {
            s.project.defenseSkills.splice(idx, 1);
            s.isDirty = true;
        }
    }),
    addPassive: (type, passive) => set((s) => {
        const key = PASSIVE_TYPE_MAP[type];
        s.project[key].push(passive);
        s.isDirty = true;
    }),
    updatePassive: (type, id, patch) => set((s) => {
        const key = PASSIVE_TYPE_MAP[type];
        const item = s.project[key].find((p) => p.id === id);
        if (item) {
            Object.assign(item, patch);
            s.isDirty = true;
        }
    }),
    removePassive: (type, id) => set((s) => {
        const key = PASSIVE_TYPE_MAP[type];
        const idx = s.project[key].findIndex((p) => p.id === id);
        if (idx !== -1) {
            s.project[key].splice(idx, 1);
            s.isDirty = true;
        }
    }),
    setSanity: (patch) => set((s) => { Object.assign(s.project.sanity, patch); s.isDirty = true; }),
    addSanityFactor: (type, text) => set((s) => {
        const arr = type === 'increasing' ? s.project.sanity.factorsIncreasing : s.project.sanity.factorsDecreasing;
        arr.push(text);
        s.isDirty = true;
    }),
    removeSanityFactor: (type, index) => set((s) => {
        const arr = type === 'increasing' ? s.project.sanity.factorsIncreasing : s.project.sanity.factorsDecreasing;
        if (index >= 0 && index < arr.length) {
            arr.splice(index, 1);
            s.isDirty = true;
        }
    }),
    updateSanityFactor: (type, index, text) => set((s) => {
        const arr = type === 'increasing' ? s.project.sanity.factorsIncreasing : s.project.sanity.factorsDecreasing;
        if (index >= 0 && index < arr.length) {
            arr[index] = text;
            s.isDirty = true;
        }
    }),
    setCautionColor: (color) => set((s) => { s.project.cautionColor = color; s.isDirty = true; }),
    setInfoBarBgColor: (color) => set((s) => { s.project.infoBarBgColor = color; s.isDirty = true; }),
    setRightColumnBgUrl: (url) => set((s) => { s.project.rightColumnBgUrl = url; s.isDirty = true; }),
    setRightColumnBgOpacity: (opacity) => set((s) => { s.project.rightColumnBgOpacity = opacity; s.isDirty = true; }),
    loadProject: (project, projectId) => set((s) => { s.project = project; s.currentProjectId = projectId ?? null; s.isDirty = false; }),
    resetProject: () => set((s) => { s.project = createDefaultProject(); s.currentProjectId = null; s.isDirty = false; }),
    markClean: (projectId, persistedData?, editedDuringSave = false) => set((s) => {
        if (persistedData) {
            if (!editedDuringSave) {
                s.project = persistedData;
            }
            else {
                adoptPersistedUrls(s.project, persistedData);
            }
        }
        s.currentProjectId = projectId;
        s.isDirty = editedDuringSave;
    }),
})));
