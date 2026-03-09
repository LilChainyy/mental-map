import type { HandGesture, SmoothedLandmark } from '../types/handTracking';

const PINCH_THRESHOLD = 0.06;
const ZOOM_UPPER = 0.18;
const EMA_ALPHA = 0.35;

// Only 3 landmarks matter
const THUMB_TIP = 4;
const INDEX_TIP = 8;

/**
 * Classify gesture using only thumb + index finger distance.
 * Pinch = thumb+index touching. Everything else = pointing (index extended).
 */
export function classifyGesture(
  landmarks: Array<{ x: number; y: number; z: number }>,
): HandGesture {
  if (landmarks.length < 21) return 'none';
  const dist = getPinchDistance(landmarks);
  if (dist < PINCH_THRESHOLD) return 'pinch';
  if (dist < ZOOM_UPPER) return 'zoom';
  return 'pointing';
}

/**
 * EMA smoothing on landmark positions to reduce jitter.
 */
export function smoothLandmarks(
  current: Array<{ x: number; y: number; z: number }>,
  previous: SmoothedLandmark[] | null,
): SmoothedLandmark[] {
  if (!previous || previous.length !== current.length) {
    return current.map((l) => ({ x: l.x, y: l.y, z: l.z }));
  }
  return current.map((l, i) => ({
    x: EMA_ALPHA * l.x + (1 - EMA_ALPHA) * previous[i].x,
    y: EMA_ALPHA * l.y + (1 - EMA_ALPHA) * previous[i].y,
    z: EMA_ALPHA * l.z + (1 - EMA_ALPHA) * previous[i].z,
  }));
}

/**
 * Midpoint between thumb tip and index tip — used as the tracking cursor.
 */
export function getCursorPoint(landmarks: SmoothedLandmark[]): SmoothedLandmark {
  const t = landmarks[THUMB_TIP];
  const i = landmarks[INDEX_TIP];
  return {
    x: (t.x + i.x) / 2,
    y: (t.y + i.y) / 2,
    z: (t.z + i.z) / 2,
  };
}

/**
 * Euclidean distance between thumb tip (4) and index tip (8).
 */
export function getPinchDistance(
  landmarks: Array<{ x: number; y: number; z: number }>,
): number {
  const thumb = landmarks[THUMB_TIP];
  const index = landmarks[INDEX_TIP];
  const dx = thumb.x - index.x;
  const dy = thumb.y - index.y;
  const dz = thumb.z - index.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
