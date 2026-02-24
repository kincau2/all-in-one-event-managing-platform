/**
 * @aioemp/seatmap-editor — Default primitive factories
 *
 * Shared factory functions for creating new primitives with sensible defaults.
 * Used by Toolbar (instant-add buttons).
 */

import { generateUUID } from '@aioemp/seatmap-core';

export function createDefaultStage() {
  return {
    id: generateUUID(),
    type: 'stage' as const,
    name: 'Stage',
    width: 300,
    height: 60,
    transform: { x: 100, y: 20, rotation: 0 },
  };
}

export function createDefaultLabel() {
  return {
    id: generateUUID(),
    type: 'label' as const,
    name: 'Label',
    text: 'Section',
    fontSize: 18,
    transform: { x: 100, y: 100, rotation: 0 },
  };
}

export function createDefaultObstacle() {
  return {
    id: generateUUID(),
    type: 'obstacle' as const,
    name: 'Obstacle',
    width: 60,
    height: 60,
    transform: { x: 200, y: 200, rotation: 0 },
  };
}

export function createDefaultImage(src: string, width: number, height: number) {
  return {
    id: generateUUID(),
    type: 'image' as const,
    name: 'Image',
    src,
    width,
    height,
    transform: { x: 100, y: 100, rotation: 0 },
  };
}
