import type { ProjectData, Skill, Passive } from '../types/project';
import { resolveSlot } from './skillFrames';
export interface MeasuredItem {
    type: 'section-header' | 'skill' | 'defense' | 'combatPassive' | 'supportPassive' | 'customEffect';
    sectionKey: string;
    height: number;
    originalIndex: number;
}
export interface PageSlice {
    items: MeasuredItem[];
    leftTab: 'info' | 'sanity';
}
export function computePages(items: MeasuredItem[], budget: number): PageSlice[] {
    if (items.length === 0) {
        return [{ items: [], leftTab: 'info' }];
    }
    const pages: PageSlice[] = [];
    let currentItems: MeasuredItem[] = [];
    let currentHeight = 0;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (currentHeight + item.height > budget && currentItems.length > 0) {
            const lastItem = currentItems[currentItems.length - 1];
            if (lastItem.type === 'section-header') {
                currentItems.pop();
                pages.push({ items: currentItems, leftTab: 'info' });
                currentItems = [lastItem, item];
                currentHeight = lastItem.height + item.height;
            }
            else {
                pages.push({ items: currentItems, leftTab: 'info' });
                currentItems = [item];
                currentHeight = item.height;
            }
        }
        else {
            currentItems.push(item);
            currentHeight += item.height;
        }
    }
    if (currentItems.length > 0) {
        pages.push({ items: currentItems, leftTab: 'info' });
    }
    if (pages.length > 1) {
        pages[pages.length - 1].leftTab = 'sanity';
    }
    return pages;
}
export function sliceProjectData(original: ProjectData, slice: PageSlice): ProjectData {
    const skillIndices: number[] = [];
    const defenseIndices: number[] = [];
    const combatPassiveIndices: number[] = [];
    const supportPassiveIndices: number[] = [];
    const customEffectIndices: number[] = [];
    for (const item of slice.items) {
        switch (item.type) {
            case 'skill':
                skillIndices.push(item.originalIndex);
                break;
            case 'defense':
                defenseIndices.push(item.originalIndex);
                break;
            case 'combatPassive':
                combatPassiveIndices.push(item.originalIndex);
                break;
            case 'supportPassive':
                supportPassiveIndices.push(item.originalIndex);
                break;
            case 'customEffect':
                customEffectIndices.push(item.originalIndex);
                break;
        }
    }
    const slicedSkills: Skill[] = skillIndices.map((idx) => ({
        ...original.skills[idx],
        skillSlot: resolveSlot(original.skills[idx].skillSlot, idx),
    }));
    const slicedDefense: Skill[] = defenseIndices.map((idx) => ({
        ...original.defenseSkills[idx],
        skillSlot: resolveSlot(original.defenseSkills[idx].skillSlot, idx),
    }));
    const slicedCombatPassives: Passive[] = combatPassiveIndices.map((idx) => original.combatPassives[idx]);
    const slicedSupportPassives: Passive[] = supportPassiveIndices.map((idx) => original.supportPassives[idx]);
    const slicedCustomEffects: Passive[] = customEffectIndices.map((idx) => original.customEffects[idx]);
    return {
        ...original,
        skills: slicedSkills,
        defenseSkills: slicedDefense,
        combatPassives: slicedCombatPassives,
        supportPassives: slicedSupportPassives,
        customEffects: slicedCustomEffects,
    };
}
