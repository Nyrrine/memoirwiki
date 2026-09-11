export interface StoryIcon {
    id: string;
    label: string;
    path: string;
}
export const STORY_ICONS: StoryIcon[] = [
    { id: 'dongrang_distorted', label: 'Dongrang (Distorted)', path: '/icons/story/dongrang_distorted.png' },
    { id: 'dias', label: 'Dias', path: '/icons/story/dias.png' },
    { id: 'yuria', label: 'YuRia', path: '/icons/story/yuria.png' },
    { id: 'ezra', label: 'Ezra', path: '/icons/story/ezra.png' },
    { id: 'h_corp_researcher', label: 'H Corp. Researcher', path: '/icons/story/h_corp_researcher.png' },
    { id: 'dulcinea_past', label: 'Dulcinea (Past)', path: '/icons/story/dulcinea_past.png' },
    { id: 'albina', label: 'Albina', path: '/icons/story/albina.png' },
    { id: 'bamboo_hatted_kim_distorted', label: 'Bamboo-hatted Kim (Distorted)', path: '/icons/story/bamboo_hatted_kim_distorted.png' },
    { id: 'queen_of_hatred', label: 'Queen of Hatred', path: '/icons/story/queen_of_hatred.png' },
];
export const DEFAULT_AVATAR = STORY_ICONS[0].path;
