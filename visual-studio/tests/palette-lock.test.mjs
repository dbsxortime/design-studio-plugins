import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgb, nearestPaletteColor, gradeStrength } from '../scripts/lib/palette-lock.mjs';

test('hexToRgb', () => {
  assert.deepEqual(hexToRgb('#0046FF'), [0, 70, 255]);
});

test('nearestPaletteColor: 가까운 팔레트 색으로', () => {
  const pal = [[0, 0, 0], [255, 255, 255]];
  assert.deepEqual(nearestPaletteColor([20, 20, 20], pal), [0, 0, 0]);
  assert.deepEqual(nearestPaletteColor([200, 200, 200], pal), [255, 255, 255]);
});

test('gradeStrength: 강도 매핑', () => {
  assert.equal(gradeStrength('strong'), 0.85);
  assert.equal(gradeStrength('light'), 0.4);
  assert.equal(gradeStrength('off'), 0);
});
