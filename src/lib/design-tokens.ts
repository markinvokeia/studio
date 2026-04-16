// Design system constants — single source of truth for layout measurements
// and animation timings. Import these instead of magic numbers in components.

/** Width of the collapsed icon-only sidebar in px */
export const SIDEBAR_WIDTH = 64;

/** Duration of panel slide-in/out animation in ms — mirrors --panel-transition CSS var */
export const PANEL_ANIMATION_DURATION = 220;

/** Left panel pixel width below which narrow (card) mode is activated */
export const LEFT_PANEL_NARROW_THRESHOLD = 380;

/** Calendar breakpoint: viewport below this width is considered mobile */
export const BREAKPOINT_MOBILE = 768;

/** Calendar breakpoint: viewport below this width is considered tablet (above is desktop) */
export const BREAKPOINT_TABLET = 1024;
