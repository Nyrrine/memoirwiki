import type { Descendant } from 'slate';
export type SinType = 'wrath' | 'lust' | 'sloth' | 'gluttony' | 'gloom' | 'pride' | 'envy';
export type DamageType = 'slash' | 'pierce' | 'blunt';
export type ResistanceLevel = 'fatal' | 'weak' | 'normal' | 'endured' | 'ineffective';
export type CoinType = 'normal' | 'unbreakable' | 'excision' | 'custom';
export interface Trait {
    label: string;
    struck?: boolean;
}
export type TraitEntry = string | Trait;
export function traitLabel(t: TraitEntry): string {
    return typeof t === 'string' ? t : t.label;
}
export function traitStruck(t: TraitEntry): boolean {
    return typeof t !== 'string' && t.struck === true;
}
export interface CoinEffect {
    coinIndex: number;
    coinType: CoinType;
    coinIconUrl?: string;
    coinLabel?: string;
    description: Descendant[];
}
export interface Skill {
    id: string;
    name: string;
    sinType: SinType;
    damageType: DamageType;
    basePower: number;
    coinCount: number;
    coinPower: number;
    offenseLevel: string;
    atkWeight: number;
    amount: number;
    skillEffect: Descendant[];
    coinEffects: CoinEffect[];
    skillIconUrl?: string;
    skillSlot?: 1 | 2 | 3;
    skillLabel?: string;
}
export type DefenseSkill = Skill;
export interface Passive {
    id: string;
    name: string;
    sinType: SinType;
    cost: {
        sinType: SinType;
        amount: number;
    }[];
    description: Descendant[];
    condition: string;
    iconUrl?: string;
    label?: string;
}
export interface Resistances {
    slash: ResistanceLevel;
    pierce: ResistanceLevel;
    blunt: ResistanceLevel;
}
export interface Stats {
    hp: number;
    speedMin: number;
    speedMax: number;
    defenseLevel: number;
    resistances: Resistances;
}
export interface SanityData {
    panicName: string;
    panicIconUrl: string | null;
    lowMoraleDesc: string;
    panicDesc: string;
    factorsIncreasing: string[];
    factorsDecreasing: string[];
    sanityTextColor: string;
}
export type UptieLevel = 1 | 2 | 3 | 4;
export interface ProjectData {
    id: string;
    characterName: string;
    identityName: string;
    rarity: 1 | 2 | 3;
    level: number;
    uptieLevel: UptieLevel;
    sinAffinity: SinType;
    portraitUrl: string | null;
    sinnerIconUrl?: string;
    stats: Stats;
    traits: TraitEntry[];
    mirrorWorldIconUrl: string | null;
    mirrorWorldName?: string;
    skills: Skill[];
    defenseSkills: DefenseSkill[];
    combatPassives: Passive[];
    supportPassives: Passive[];
    mentalEffects: Passive[];
    customEffects: Passive[];
    sanity: SanityData;
    cautionColor: string;
    infoBarBgColor: string;
    rightColumnBgUrl?: string | null;
    rightColumnBgOpacity?: number;
}
