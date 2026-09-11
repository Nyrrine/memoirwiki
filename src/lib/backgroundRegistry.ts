export interface BgEntry {
    id: string;
    path: string;
    label: string;
}
function labelFromFilename(filename: string): string {
    return filename
        .replace(/\.webp$/, '')
        .replace(/^(abnormalities|ego)_/, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
const BG_FILES = [
    'abnormalities_alleyway_watchdog.webp',
    'abnormalities_ambling_pearl.webp',
    'abnormalities_ardor_blossom_moth.webp',
    'abnormalities_blubbering_toad.webp',
    'abnormalities_brazen_bull.webp',
    'abnormalities_der_fluchschütze.webp',
    'abnormalities_doomsday_calendar.webp',
    'abnormalities_dream_devouring_siltcurrent.webp',
    'abnormalities_dreaming_electric_sheep.webp',
    'abnormalities_drenched_gossypium.webp',
    'abnormalities_drifting_fox.webp',
    'abnormalities_ebony_queen_s_apple.webp',
    'abnormalities_faelantern.webp',
    'abnormalities_fairy_festival.webp',
    'abnormalities_fairy_gentleman.webp',
    'abnormalities_fairy_long_legs.webp',
    'abnormalities_four_hundred_roses.webp',
    'abnormalities_golden_apple.webp',
    'abnormalities_headless_icythys.webp',
    'abnormalities_kqe_1j_23.webp',
    'abnormalities_my_form_empties.webp',
    'abnormalities_pink_shoes.webp',
    'abnormalities_portrait_of_a_certain_day.webp',
    'abnormalities_rose_hunter.webp',
    'abnormalities_shock_centipede.webp',
    'abnormalities_sign_of_roses.webp',
    'abnormalities_skin_prophet.webp',
    'abnormalities_sleeping_bag_of_a_bygone_day.webp',
    'abnormalities_so_that_no_one_will_cry.webp',
    'abnormalities_spiral_of_contempt.webp',
    'abnormalities_steam_transport_machine.webp',
    'abnormalities_the_king_in_binds.webp',
    'abnormalities_wayward_passenger.webp',
    'abnormalities_you_want_to_get_beat_hurtily.webp',
    'ego_fell_bullet.webp',
    'ego_fourth_match_flame.webp',
    'ego_lifetime_stew.webp',
];
export const BACKGROUNDS: BgEntry[] = BG_FILES.map((f) => ({
    id: f.replace(/\.webp$/, ''),
    path: `/bg/${f}`,
    label: labelFromFilename(f),
}));
