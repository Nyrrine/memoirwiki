import { v4 as uuid } from 'uuid';
import type { ProjectData } from '../types/project';
export function createDefaultProject(): ProjectData {
    return {
        id: uuid(),
        characterName: '',
        identityName: '',
        rarity: 1,
        level: 1,
        uptieLevel: 1,
        sinAffinity: 'wrath',
        portraitUrl: null,
        stats: {
            hp: 100,
            speedMin: 2,
            speedMax: 5,
            defenseLevel: 30,
            resistances: {
                slash: 'normal',
                pierce: 'normal',
                blunt: 'normal',
            },
        },
        traits: [],
        mirrorWorldIconUrl: null,
        skills: [],
        defenseSkills: [],
        combatPassives: [],
        supportPassives: [],
        mentalEffects: [],
        customEffects: [],
        sanity: {
            panicName: 'Panic',
            panicIconUrl: '/icons/mental/1017 300860.png',
            lowMoraleDesc: 'All of this unit\'s skills have their final power reduced by 1.',
            panicDesc: 'This unit does not act. At the end of the turn, if this unit has the highest SP among all other panicked allies, recover SP by 10 and end panic.',
            factorsIncreasing: [
                'Winning a clash',
                'Killing an enemy',
                'Allies killing an enemy',
            ],
            factorsDecreasing: [
                'Losing a clash',
                'An ally or self being staggered or killed',
                'Getting hit critically',
            ],
            sanityTextColor: '#e8e4dc',
        },
        cautionColor: '#6b5c40',
        infoBarBgColor: '#1a1714',
    };
}
