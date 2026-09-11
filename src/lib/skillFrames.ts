import type { SinType } from '../types/project';
export type SkillSlot = 1 | 2 | 3;
export function frameBorderPath(sin: SinType, slot: SkillSlot): string {
    return `/icons/skillframes/${sin}_s${slot}.png`;
}
export function frameMaskPath(slot: SkillSlot): string {
    return `/icons/skillframes/mask_s${slot}.png`;
}
export function resolveSlot(skillSlot: SkillSlot | undefined, arrayIndex: number): SkillSlot {
    if (skillSlot)
        return skillSlot;
    return Math.min(arrayIndex + 1, 3) as SkillSlot;
}
