import { useEffect, useRef, useCallback } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { ForceGraphMethods } from 'react-force-graph-3d';
import * as THREE from 'three';
import { useGraphStore } from '../store';
import type { SmoothedLandmark, HandGesture } from '../types/handTracking';
import {
  classifyGesture,
  smoothLandmarks,
  getCursorPoint,
  getPinchDistance,
} from '../utils/gestureClassifier';
import { rotateCamera, zoomCamera, panCamera } from '../utils/cameraControl';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FgRef = ForceGraphMethods<any, any>;

const DETECTION_INTERVAL_MS = 1000 / 30;
const HIGHLIGHT_THROTTLE_MS = 100;
const SELECT_HOLD_MS = 500; // hold pinch still for 0.5s to select
const STILL_THRESHOLD = 0.008; // movement below this = "still"
const INDEX_TIP = 8;
const THUMB_TIP = 4;

interface UseHandTrackingParams {
  fgRef: React.RefObject<FgRef | undefined>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/** Draw only thumb + index finger on the canvas overlay. */
function drawFingers(
  canvas: HTMLCanvasElement,
  landmarks: SmoothedLandmark[],
  gesture: HandGesture,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (landmarks.length === 0) return;

  const w = canvas.width;
  const h = canvas.height;

  // Thumb: 0→1→2→3→4, Index: 0→5→6→7→8
  const thumbChain = [0, 1, 2, 3, 4];
  const indexChain = [0, 5, 6, 7, 8];

  ctx.lineWidth = 2;
  for (const chain of [thumbChain, indexChain]) {
    ctx.strokeStyle = '#22c55e';
    ctx.beginPath();
    for (let i = 0; i < chain.length; i++) {
      const lm = landmarks[chain[i]];
      if (!lm) continue;
      if (i === 0) ctx.moveTo(lm.x * w, lm.y * h);
      else ctx.lineTo(lm.x * w, lm.y * h);
    }
    ctx.stroke();
  }

  // Draw dots on thumb tip + index tip only
  const tips = [THUMB_TIP, INDEX_TIP];
  for (const idx of tips) {
    const lm = landmarks[idx];
    if (!lm) continue;
    ctx.fillStyle =
      gesture === 'pinch' ? '#3b82f6' : gesture === 'zoom' ? '#f59e0b' : '#ef4444';
    ctx.beginPath();
    ctx.arc(lm.x * w, lm.y * h, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // If pinching or zooming, draw a line between thumb and index
  if (gesture === 'pinch' || gesture === 'zoom') {
    const t = landmarks[THUMB_TIP];
    const i = landmarks[INDEX_TIP];
    if (t && i) {
      ctx.strokeStyle = gesture === 'pinch' ? '#3b82f6' : '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(t.x * w, t.y * h);
      ctx.lineTo(i.x * w, i.y * h);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function findNearestNode(
  indexTip: SmoothedLandmark,
  fg: FgRef,
  container: HTMLDivElement,
): string | null {
  const rect = container.getBoundingClientRect();
  const screenX = (1 - indexTip.x) * rect.width;
  const screenY = indexTip.y * rect.height;

  const nodes = useGraphStore.getState().nodes;
  let nearest: string | null = null;
  let minDist = Infinity;

  for (const node of nodes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const n = node as any;
    if (n.x === undefined || n.y === undefined || n.z === undefined) continue;
    const sc = fg.graph2ScreenCoords(n.x, n.y, n.z);
    const dx = sc.x - screenX;
    const dy = sc.y - screenY;
    const dist = dx * dx + dy * dy;
    if (dist < minDist) {
      minDist = dist;
      nearest = node.id;
    }
  }

  return nearest && minDist < 150 * 150 ? nearest : null;
}

export function useHandTracking({
  fgRef,
  videoRef,
  canvasRef,
  containerRef,
}: UseHandTrackingParams) {
  const isEnabled = useGraphStore((s) => s.isHandTrackingEnabled);
  const setHandTracking = useGraphStore((s) => s.setHandTracking);

  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastDetectionTime = useRef<number>(0);
  const lastHighlightTime = useRef<number>(0);
  const prevLandmarks = useRef<SmoothedLandmark[] | null>(null);
  const prevCursor = useRef<SmoothedLandmark | null>(null);
  const prevPinchDist = useRef<number | null>(null);
  const prevGesture = useRef<HandGesture>('none');

  // Pinch-hold-to-select tracking
  const pinchStillSince = useRef<number | null>(null);
  const pinchSelectedAlready = useRef(false);

  // Stable refs so rAF loop doesn't cause re-renders
  const selectNodeRef = useRef(useGraphStore.getState().selectNode);
  selectNodeRef.current = useGraphStore.getState().selectNode;
  const setHighlightedNodeRef = useRef(useGraphStore.getState().setHighlightedNode);
  setHighlightedNodeRef.current = useGraphStore.getState().setHighlightedNode;

  const processFrame = useCallback(
    function loop(timestamp: number) {
      rafRef.current = requestAnimationFrame(loop);

      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      const fg = fgRef.current;
      if (!video || !landmarker || !fg || video.readyState < 2) return;

      if (timestamp - lastDetectionTime.current < DETECTION_INTERVAL_MS) return;
      lastDetectionTime.current = timestamp;

      let result;
      try {
        result = landmarker.detectForVideo(video, timestamp);
      } catch {
        return;
      }

      const canvas = canvasRef.current;

      if (!result.landmarks?.length) {
        prevLandmarks.current = null;
        prevCursor.current = null;
        prevPinchDist.current = null;
        prevGesture.current = 'none';
        pinchStillSince.current = null;
        pinchSelectedAlready.current = false;
        if (canvas) drawFingers(canvas, [], 'none');
        return;
      }

      const raw = result.landmarks[0];
      const smoothed = smoothLandmarks(raw, prevLandmarks.current);
      prevLandmarks.current = smoothed;

      const gesture = classifyGesture(smoothed);
      const cursor = getCursorPoint(smoothed);
      const pinchDist = getPinchDistance(smoothed);

      if (canvas) drawFingers(canvas, smoothed, gesture);

      const hasPrev = prevCursor.current !== null;
      const dx = hasPrev ? cursor.x - prevCursor.current!.x : 0;
      const dy = hasPrev ? cursor.y - prevCursor.current!.y : 0;
      const dPinch =
        prevPinchDist.current !== null ? pinchDist - prevPinchDist.current : 0;
      const movement = Math.sqrt(dx * dx + dy * dy);

      prevCursor.current = cursor;
      prevPinchDist.current = pinchDist;

      const camera = fg.camera();
      const controls = fg.controls() as { target?: THREE.Vector3 };
      const target = controls.target ?? new THREE.Vector3(0, 0, 0);

      if (gesture === 'pointing') {
        // Index finger extended → rotate orbit
        pinchStillSince.current = null;
        pinchSelectedAlready.current = false;
        if (hasPrev) rotateCamera(camera, target, dx, dy);

        // Also highlight nearest node to index tip (throttled)
        if (timestamp - lastHighlightTime.current > HIGHLIGHT_THROTTLE_MS) {
          lastHighlightTime.current = timestamp;
          const container = containerRef.current;
          if (container) {
            const nearest = findNearestNode(smoothed[INDEX_TIP], fg, container);
            setHighlightedNodeRef.current(nearest);
          }
        }
      } else if (gesture === 'zoom') {
        // Zoom band: spread/close fingers to zoom in/out
        pinchStillSince.current = null;
        pinchSelectedAlready.current = false;
        if (hasPrev && Math.abs(dPinch) > 0.002) {
          zoomCamera(camera, target, dPinch);
        }
      } else if (gesture === 'pinch') {
        // Pinch: pan (move while pinched) + hold-to-select
        if (hasPrev && movement > 0.003) {
          panCamera(camera, target, dx, dy);
        }

        // Hold-still-to-select: if pinching and barely moving for SELECT_HOLD_MS
        if (movement < STILL_THRESHOLD) {
          if (pinchStillSince.current === null) {
            pinchStillSince.current = timestamp;
          } else if (
            !pinchSelectedAlready.current &&
            timestamp - pinchStillSince.current > SELECT_HOLD_MS
          ) {
            const highlightedId = useGraphStore.getState().highlightedNodeId;
            if (highlightedId) {
              selectNodeRef.current(highlightedId);
              pinchSelectedAlready.current = true;
            }
          }
        } else {
          pinchStillSince.current = null;
          pinchSelectedAlready.current = false;
        }
      }

      prevGesture.current = gesture;
    },
    [videoRef, fgRef, canvasRef, containerRef],
  );

  useEffect(() => {
    if (!isEnabled) return;

    let cancelled = false;

    async function start() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
        );
        if (cancelled) return;

        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        });
        if (cancelled) return;
        landmarkerRef.current = landmarker;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }

        rafRef.current = requestAnimationFrame(processFrame);
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof DOMException && err.name === 'NotAllowedError'
              ? 'Webcam access denied. Please allow camera access to use hand tracking.'
              : 'Failed to initialize hand tracking. Check console for details.';
          alert(msg);
          console.error('Hand tracking init error:', err);
          setHandTracking(false);
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }

      prevLandmarks.current = null;
      prevCursor.current = null;
      prevPinchDist.current = null;
      prevGesture.current = 'none';
      pinchStillSince.current = null;
      pinchSelectedAlready.current = false;
      setHighlightedNodeRef.current(null);
    };
  }, [isEnabled, videoRef, processFrame, setHandTracking]);
}
