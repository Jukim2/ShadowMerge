import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LANTERN_GOALS,
  STAGE_ONE,
  calculateSimilarity,
  calculateShadowSimilarity,
  clamp,
  getProjectedShadows,
  lightPosition,
  lanternTFromX,
  nearestLantern,
  projectObjectShadow,
  projectVertexToScreen,
  railPoint,
} from '../src/game-engine.js';

test('clamp and rail mapping keep lanterns inside the curved track', () => {
  assert.equal(clamp(-2), 0);
  assert.equal(clamp(3), 1);
  assert.equal(lanternTFromX(112), 0);
  assert.equal(lanternTFromX(788), 1);
  assert.equal(lanternTFromX(-200), 0);
  assert.equal(lanternTFromX(2000), 1);

  const start = railPoint(0);
  const middle = railPoint(0.5);
  const end = railPoint(1);
  assert.deepEqual(start, { x: 112, y: 1378 });
  assert.ok(middle.y < start.y, 'the rail should arch upward in the middle');
  assert.ok(Math.abs(end.x - 788) < 1e-9);
  assert.ok(Math.abs(end.y - 1378) < 1e-9);
});

test('goal lantern positions reproduce the target silhouette exactly', () => {
  const score = calculateSimilarity(LANTERN_GOALS.blue, LANTERN_GOALS.amber, 3);
  assert.equal(score, 1);
});

test('the initial pose is meaningfully different and both lanterns matter', () => {
  const initialScore = calculateSimilarity(
    STAGE_ONE.lanterns[0].initial,
    STAGE_ONE.lanterns[1].initial,
  );
  assert.ok(initialScore > 0.55 && initialScore < 0.75);
  assert.ok(calculateSimilarity(LANTERN_GOALS.blue, 0.9) < STAGE_ONE.successThreshold);
  assert.ok(calculateSimilarity(0.1, LANTERN_GOALS.amber) < STAGE_ONE.successThreshold);
});

test('success tolerance is playable on touch without accepting a visibly loose match', () => {
  const near = calculateSimilarity(LANTERN_GOALS.blue - 0.04, LANTERN_GOALS.amber + 0.04);
  const loose = calculateSimilarity(LANTERN_GOALS.blue - 0.06, LANTERN_GOALS.amber + 0.06);
  assert.ok(near >= STAGE_ONE.successThreshold);
  assert.ok(loose < STAGE_ONE.successThreshold);
});

test('projected point lies on the light-to-object ray and on z=0 screen', () => {
  const light = lightPosition(LANTERN_GOALS.blue);
  const object = STAGE_ONE.objects[0];
  const vertex = object.polygons[0][2];
  const projected = projectVertexToScreen(light, object, vertex);
  const point = { x: object.x + vertex[0], y: vertex[1], z: object.depth };
  const projectedWorld = {
    x: projected.x,
    y: STAGE_ONE.screen.floorY - projected.y,
    z: STAGE_ONE.screen.z,
  };

  for (const axis of ['x', 'y', 'z']) {
    const expected = light[axis] + projected.rayScale * (point[axis] - light[axis]);
    assert.ok(Math.abs(projectedWorld[axis] - expected) < 1e-9, `${axis} must be collinear`);
  }
});

test('moving a point light right moves every projected object vertex left', () => {
  const object = STAGE_ONE.objects[1];
  const vertex = object.polygons[0][0];
  const fromLeftLight = projectVertexToScreen(lightPosition(0.25), object, vertex);
  const fromRightLight = projectVertexToScreen(lightPosition(0.75), object, vertex);
  assert.ok(fromRightLight.x < fromLeftLight.x);
  assert.equal(fromRightLight.y, fromLeftLight.y);
});

test('objects closer to the light cast larger perspective shadows', () => {
  const light = lightPosition(0.5);
  const nearScreen = { ...STAGE_ONE.objects[0], depth: 40 };
  const nearLight = { ...STAGE_ONE.objects[0], depth: 180 };
  const screenShadow = projectObjectShadow(light, nearScreen).polygons[0];
  const lightShadow = projectObjectShadow(light, nearLight).polygons[0];
  const width = (polygon) => Math.max(...polygon.map(([x]) => x)) - Math.min(...polygon.map(([x]) => x));
  assert.ok(width(lightShadow) > width(screenShadow));
});

test('every light projects every object instead of using assigned fragments', () => {
  const scene = getProjectedShadows({ blue: LANTERN_GOALS.blue, amber: LANTERN_GOALS.amber });
  assert.deepEqual(Object.keys(scene), ['blue', 'amber']);
  assert.equal(scene.blue.objects.length, STAGE_ONE.objects.length);
  assert.equal(scene.amber.objects.length, STAGE_ONE.objects.length);
  assert.deepEqual(
    scene.blue.objects.map(({ objectId }) => objectId),
    STAGE_ONE.objects.map(({ id }) => id),
  );
});

test('generic scoring supports a stage with a third lantern', () => {
  const third = Object.freeze({
    id: 'gold', initial: 0.5, goal: 0.5, glow: '#ffd36b', body: '#8b6929',
    beamRgb: [255, 211, 107], shadow: 'rgba(112, 86, 35, .6)',
  });
  const stage = {
    ...STAGE_ONE,
    lanterns: [...STAGE_ONE.lanterns, third],
  };
  const positions = { blue: LANTERN_GOALS.blue, amber: LANTERN_GOALS.amber, gold: 0.5 };
  assert.equal(calculateShadowSimilarity(positions, stage, 6), 1);
  assert.equal(getProjectedShadows(positions, stage).gold.objects.length, stage.objects.length);
});

test('nearest lantern hit testing works for every configured lantern', () => {
  const lanterns = Object.fromEntries(STAGE_ONE.lanterns.map((item) => [item.id, item.initial]));
  assert.equal(nearestLantern(railPoint(lanterns.blue), lanterns), 'blue');
  assert.equal(nearestLantern(railPoint(lanterns.amber), lanterns), 'amber');
  assert.equal(nearestLantern({ x: 450, y: 400 }, lanterns), null);
});
