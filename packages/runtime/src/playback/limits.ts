// packages/runtime/src/playback/limits.ts
/** Resource bounds for the deliberately dense integer-frame format. */
export const MAX_PLAYBACK_FRAMES = 100_000;
export const MAX_PLAYBACK_OBJECTS = 10_000;
export const MAX_PLAYBACK_CELLS = 1_000_000;
/** Conservative structural work units, including semantic validation and repeated evaluator scans. */
export const MAX_PLAYBACK_COMPILE_WORK = 10_000_000;
export const MAX_PLAYBACK_JSON_NODES = 8_000_000;
export const MAX_PLAYBACK_TEXT_LENGTH = 10_000_000;
export const MAX_PLAYBACK_DEPTH = 64;
