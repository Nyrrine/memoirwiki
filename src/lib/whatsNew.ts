export interface ReleaseNote {
    version: string;
    date: string;
    label: string;
    items: string[];
}
export const HEADLINE = 'Welcome to V4.1 of the OC Tool!';
export const ASSET_NOTICE = 'Assets currently go up to Canto 7. Content from Cantos 8 through 10, and the Intervallos in between, goes out once Canto 10 has finished.';
export const RELEASES: ReleaseNote[] = [
    {
        version: '4.1',
        date: 'September 2026',
        label: 'New in 4.1',
        items: [
            'The Lore Wiki tab is the whole wiki now: search, filters, Recent Changes and your own proposals, without leaving the maker.',
            'Search matches half-typed words and puts the page you meant first, rather than whatever mentioned it in passing.',
            'Page colours reach readers at last. Accents, backgrounds, fonts and text were showing in the editor and nowhere else, so a few pages are about to look the way they were always meant to.',
            'Progress no longer disappears when you alt-tab or switch tabs, along with a handful of other fixes.',
            'Small UI adjustments.',
        ],
    },
    {
        version: '4.0',
        date: 'Earlier this month',
        label: 'And in 4.0, which never got an announcement',
        items: [
            'Traits can be crossed off instead of deleted, so a title someone lost stays on the card with a line through it.',
            'The wiki opened up. Anyone can propose an edit to a page they did not write, and a maintainer reviews it before it goes live.',
            'Pages can be marked as Memoir canon, sorted by Lore, Character or Guide, and gathered into categories.',
            'You can see who has been reading your pages, and switch that off for yourself whenever you like.',
            'The Story maker is next and in development.',
        ],
    },
];
export const CURRENT_VERSION = RELEASES[0].version;
export const CURRENT_RELEASE = RELEASES[0];
const SEEN_KEY = 'memoirwiki:whats-new-seen';
export function lastSeenRelease(): string | null {
    try {
        return window.localStorage.getItem(SEEN_KEY);
    }
    catch {
        return null;
    }
}
export function markReleaseSeen(version: string): void {
    try {
        window.localStorage.setItem(SEEN_KEY, version);
    }
    catch {
    }
}
export function shouldShowWhatsNew(): boolean {
    return lastSeenRelease() !== CURRENT_VERSION;
}
