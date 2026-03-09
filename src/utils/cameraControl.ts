import * as THREE from 'three';

/**
 * Rotate the camera around a target point using spherical coordinates.
 * dx/dy are normalized hand movement deltas (-1..1 range, mirrored).
 */
export function rotateCamera(
  camera: THREE.Camera,
  target: THREE.Vector3,
  dx: number,
  dy: number,
): void {
  const offset = camera.position.clone().sub(target);
  const spherical = new THREE.Spherical().setFromVector3(offset);

  // Scale for natural feel: ~2 radians across full hand sweep
  spherical.theta -= dx * 4.0;
  spherical.phi -= dy * 4.0;

  // Clamp phi to avoid flipping
  spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

  offset.setFromSpherical(spherical);
  camera.position.copy(target).add(offset);
  camera.lookAt(target);
}

/**
 * Dolly the camera along its view vector based on pinch delta.
 * Positive dPinch = spreading fingers = zoom in.
 */
export function zoomCamera(
  camera: THREE.Camera,
  target: THREE.Vector3,
  dPinch: number,
): void {
  const offset = camera.position.clone().sub(target);
  const currentDist = offset.length();

  // Scale factor: spreading fingers zooms in, pinching zooms out
  const scaleFactor = 1.0 - dPinch * 5.0;
  const newDist = Math.max(10, Math.min(2000, currentDist * scaleFactor));

  offset.normalize().multiplyScalar(newDist);
  camera.position.copy(target).add(offset);
}

/**
 * Pan the camera + target in screen-space right/up vectors.
 */
export function panCamera(
  camera: THREE.Camera,
  target: THREE.Vector3,
  dx: number,
  dy: number,
): void {
  // Get camera's right and up vectors in world space
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  camera.matrix.extractBasis(right, up, new THREE.Vector3());

  const dist = camera.position.distanceTo(target);
  const panSpeed = dist * 1.2;

  const panOffset = new THREE.Vector3()
    .addScaledVector(right, dx * panSpeed)
    .addScaledVector(up, dy * panSpeed);

  camera.position.add(panOffset);
  target.add(panOffset);
}
