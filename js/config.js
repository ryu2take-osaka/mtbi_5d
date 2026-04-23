/**
 * Scoring weights for complementary calculation
 * @type {Object}
 */
export const SCORE_CONFIG = {
    FULL: 40,
    PARTIAL: 25,
    MIRROR: {
        position: 0.04,
        strong: 0.04,
        lvNear: 0.02,
        cap: 0.12
    }
};

/**
 * Thresholds for function level classification
 * @type {Object}
 */
export const LV_BAND = {
    HIGH: 70,
    MID: 40
};

/**
 * UI and Animation parameters
 * @type {Object}
 */
export const UI_CONFIG = {
    SCALE: 4.0,
    ANALYSIS_TIME: 1200,
    INTERACTION_TIMEOUT: 600,
    NARRATION_INTERVALS: {
        INTRO: 0,
        CORE: 2,
        SUB: 6,
        DIFF: 12,
        OVERVIEW: 16
    }
};
