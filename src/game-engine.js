export const WORLD = Object.freeze({ width: 900, height: 1600 });

export const SCREEN_PLANE = Object.freeze({
  z: 0,
  floorY: 930,
  bounds: Object.freeze({ left: 118, top: 365, right: 782, bottom: 948 }),
});

export const LIGHT_MODEL = Object.freeze({
  height: 68,
  depth: 680,
});

export const LANTERN_GOALS = Object.freeze({ blue: 0.285, amber: 0.715 });

// Each point is [horizontal offset from the object's anchor, height above floor].
// These are the actual opaque cut-paper profiles used by the ray caster.
const LEFT_WING_PROFILE = Object.freeze([
  [72, 168], [26, 222], [-48, 283], [-137, 350], [-116, 286],
  [-176, 316], [-132, 253], [-184, 272], [-108, 207], [-43, 164],
  [28, 148],
]);

const RIGHT_WING_PROFILE = Object.freeze(
  LEFT_WING_PROFILE.map(([x, height]) => Object.freeze([-x, height])),
);

const BODY_PROFILE = Object.freeze([
  [-53, 165], [-66, 211], [-55, 257], [-24, 292], [15, 306],
  [48, 299], [62, 321], [89, 329], [70, 306], [96, 298],
  [67, 286], [52, 252], [50, 207], [31, 169], [-6, 143],
]);

const TAIL_PROFILE = Object.freeze([
  [-35, 174], [-72, 119], [-25, 143], [-4, 94], [12, 147],
  [56, 109], [34, 175],
]);

export const STAGE_ONE = Object.freeze({
  id: 'paper-bird-01',
  title: '새의 첫 번째 꿈',
  successThreshold: 0.90,
  holdSeconds: 0.68,
  screen: SCREEN_PLANE,
  lightModel: LIGHT_MODEL,
  lanterns: Object.freeze([
    Object.freeze({ id: 'blue', initial: 0.08, goal: LANTERN_GOALS.blue, glow: '#48d2d4', body: '#1c6b70', beamRgb: [48, 183, 187], shadow: 'rgba(25, 91, 94, .69)' }),
    Object.freeze({ id: 'amber', initial: 0.92, goal: LANTERN_GOALS.amber, glow: '#ff9a59', body: '#8e3f2c', beamRgb: [239, 105, 57], shadow: 'rgba(157, 64, 39, .66)' }),
  ]),
  objects: Object.freeze([
    Object.freeze({
      id: 'pine-wing', kind: 'pine', x: 380, depth: 95, displayX: 278,
      polygons: Object.freeze([LEFT_WING_PROFILE]),
    }),
    Object.freeze({
      id: 'leaf-body', kind: 'leaf', x: 450, depth: 70, displayX: 450,
      polygons: Object.freeze([BODY_PROFILE, TAIL_PROFILE]),
    }),
    Object.freeze({
      id: 'mountain-wing', kind: 'mountains', x: 520, depth: 95, displayX: 626,
      polygons: Object.freeze([RIGHT_WING_PROFILE]),
    }),
  ]),
});

export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function railPoint(t) {
  const p = clamp(t);
  return {
    x: 112 + p * 676,
    y: 1378 - Math.sin(p * Math.PI) * 82,
  };
}

export function lanternTFromX(x) {
  return clamp((x - 112) / 676);
}

/**
 * Converts a lantern's rail position into the 3D-lite lighting space.
 * x: horizontal on the screen, y: height above the stage floor, z: distance from screen.
 */
export function lightPosition(t, stage = STAGE_ONE) {
  return {
    x: railPoint(t).x,
    y: stage.lightModel.height,
    z: stage.lightModel.depth,
  };
}

/**
 * Projects a vertex on an upright object plane onto the screen plane (z = 0).
 * The point is found by intersecting ray L + k(P-L) with the screen plane.
 */
export function projectVertexToScreen(light, object, vertex, screen = SCREEN_PLANE) {
  if (!(object.depth > screen.z && object.depth < light.z)) {
    throw new RangeError('Object depth must be strictly between the screen and the light.');
  }
  const point = {
    x: object.x + vertex[0],
    y: vertex[1],
    z: object.depth,
  };
  const denominator = point.z - light.z;
  if (Math.abs(denominator) < 1e-9) {
    throw new RangeError('Object and light cannot share the same depth plane.');
  }
  const rayScale = (screen.z - light.z) / denominator;
  if (rayScale <= 0) {
    throw new RangeError('Object must lie between the light and the projection screen.');
  }

  const projectedWorldX = light.x + rayScale * (point.x - light.x);
  const projectedHeight = light.y + rayScale * (point.y - light.y);
  return {
    x: projectedWorldX,
    y: screen.floorY - projectedHeight,
    rayScale,
  };
}

export function projectObjectShadow(light, object, screen = SCREEN_PLANE) {
  return {
    objectId: object.id,
    polygons: object.polygons.map((polygon) => polygon.map((vertex) => {
      const projected = projectVertexToScreen(light, object, vertex, screen);
      return [projected.x, projected.y];
    })),
  };
}

/** Projects every opaque object from every light. No fragment is assigned to a lamp. */
export function getProjectedShadows(lanternPositions, stage = STAGE_ONE) {
  return Object.fromEntries(stage.lanterns.map((lantern) => {
    const light = lightPosition(lanternPositions[lantern.id], stage);
    return [lantern.id, {
      light,
      objects: stage.objects.map((object) => projectObjectShadow(light, object, stage.screen)),
    }];
  }));
}

export function goalLanternPositions(stage = STAGE_ONE) {
  return Object.fromEntries(stage.lanterns.map((lantern) => [lantern.id, lantern.goal]));
}

export function getTargetShadowScene(stage = STAGE_ONE) {
  return getProjectedShadows(goalLanternPositions(stage), stage);
}

export function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const crossing = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (crossing) inside = !inside;
  }
  return inside;
}

export function pointInLightShadow(x, y, lightShadow) {
  return lightShadow.objects.some((object) =>
    object.polygons.some((polygon) => pointInPolygon(x, y, polygon)));
}

/**
 * Full shadow (umbra): a point hidden from every active light by at least one object.
 * Areas hidden from only some lights remain colored penumbra in the renderer.
 */
export function pointInUmbra(x, y, shadowScene) {
  const lightShadows = Object.values(shadowScene);
  return lightShadows.length > 0 && lightShadows.every((shadow) => pointInLightShadow(x, y, shadow));
}

export function calculateSimilarity(blue, amber, step = 5, stage = STAGE_ONE) {
  return calculateShadowSimilarity({ blue: clamp(blue), amber: clamp(amber) }, stage, step);
}

export function calculateShadowSimilarity(lanternPositions, stage = STAGE_ONE, step = 5) {
  const current = getProjectedShadows(lanternPositions, stage);
  const target = getTargetShadowScene(stage);
  const bounds = stage.screen.bounds;
  let intersection = 0;
  let union = 0;

  for (let y = bounds.top; y <= bounds.bottom; y += step) {
    for (let x = bounds.left; x <= bounds.right; x += step) {
      const inCurrent = pointInUmbra(x, y, current);
      const inTarget = pointInUmbra(x, y, target);
      if (inCurrent || inTarget) union += 1;
      if (inCurrent && inTarget) intersection += 1;
    }
  }

  return union ? intersection / union : 0;
}

export function nearestLantern(pointer, lanterns, radius = 82) {
  let match = null;
  let best = radius;
  for (const key of Object.keys(lanterns)) {
    const point = railPoint(lanterns[key]);
    const distance = Math.hypot(pointer.x - point.x, pointer.y - point.y);
    if (distance < best) {
      best = distance;
      match = key;
    }
  }
  return match;
}
