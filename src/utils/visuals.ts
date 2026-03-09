import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import type { GraphNode } from '../types';
import { getVisualWeight } from '../types';

export function createHighlightRing(radius: number): THREE.Mesh {
  const geometry = new THREE.RingGeometry(radius, radius + 1.2, 32);
  const material = new THREE.MeshBasicMaterial({
    color: 0x3b82f6,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.7,
  });
  return new THREE.Mesh(geometry, material);
}

export function createNodeObject(node: GraphNode): THREE.Group {
  const weight = getVisualWeight(node.connectionCount);
  const group = new THREE.Group();

  // Sphere
  const geometry = new THREE.SphereGeometry(weight.sphereRadius, 16, 16);
  const material = new THREE.MeshLambertMaterial({
    color: node.color,
    transparent: true,
    opacity: weight.opacity,
  });
  const sphere = new THREE.Mesh(geometry, material);
  group.add(sphere);

  // Label (SpriteText billboards toward camera automatically)
  const label = new SpriteText(node.label);
  label.color = '#1F2937';
  label.textHeight = weight.fontSize * 0.3;
  label.fontWeight = weight.fontWeight;
  label.backgroundColor = 'rgba(255, 255, 255, 0.85)';
  label.padding = 1.5;
  label.borderRadius = 2;
  label.position.y = -(weight.sphereRadius + 3);
  // Ensure transparent is set so depth-based opacity fading works
  label.material.transparent = true;
  group.add(label);

  return group;
}
