import './style.css';
import {
  WORLD,
  LANTERN_GOALS,
  STAGE_ONE,
  calculateShadowSimilarity,
  getProjectedShadows,
  getTargetShadowScene,
  lanternTFromX,
  nearestLantern,
  railPoint,
} from './game-engine.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d', { alpha: false });
const statusNode = document.querySelector('#a11y-status');
const TAU = Math.PI * 2;
const stage = STAGE_ONE;
const targetShadowScene = getTargetShadowScene(stage);
const targetUmbraCanvas = buildUmbraCanvas(targetShadowScene, '#5b4738');

const assets = {
  background: loadImage('/assets/dark-hanji-bg.png'),
  screen: loadImage('/assets/warm-hanji-screen.png'),
};

const state = {
  mode: 'intro',
  lanterns: Object.fromEntries(stage.lanterns.map((lantern) => [lantern.id, lantern.initial])),
  selected: 'blue',
  dragging: null,
  score: 0,
  scoreDirty: true,
  matchHold: 0,
  elapsed: 0,
  successTime: 0,
  particles: [],
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
};

function loadImage(src) {
  const image = new Image();
  image.src = src;
  image.addEventListener('load', render, { once: true });
  return image;
}

function resetGame() {
  state.mode = 'play';
  stage.lanterns.forEach((lantern) => { state.lanterns[lantern.id] = lantern.initial; });
  state.score = calculateShadowSimilarity(state.lanterns, stage);
  state.scoreDirty = false;
  state.matchHold = 0;
  state.elapsed = 0;
  state.successTime = 0;
  state.particles = [];
  statusNode.textContent = '공연이 시작됐습니다. 두 랜턴을 곡선 레일 위에서 움직여 희미한 새 모양을 그림자로 채우세요.';
}

function beginSuccess() {
  if (state.mode === 'success') return;
  state.mode = 'success';
  state.successTime = 0;
  state.dragging = null;
  state.particles = Array.from({ length: 28 }, (_, index) => ({
    angle: (index / 28) * TAU + ((index * 17) % 7) * 0.07,
    speed: 38 + (index % 6) * 14,
    size: 3 + (index % 4) * 2,
    phase: index * 0.41,
  }));
  statusNode.textContent = '성공! 흩어진 그림자가 하나가 되어 새가 깨어났습니다.';
  playChime();
}

function playChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const audio = new AudioContextClass();
    const now = audio.currentTime;
    [392, 523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now + index * 0.09);
      gain.gain.linearRampToValueAtTime(0.08, now + index * 0.09 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.09 + 0.7);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now + index * 0.09);
      oscillator.stop(now + index * 0.09 + 0.75);
    });
    window.setTimeout(() => audio.close(), 1400);
  } catch {
    // Audio is a bonus; browsers may block it without changing gameplay.
  }
}

function update(dt) {
  state.elapsed += dt;
  if (state.mode === 'play') {
    if (state.scoreDirty) {
      state.score = calculateShadowSimilarity(state.lanterns, stage);
      state.scoreDirty = false;
    }
    if (state.score >= stage.successThreshold) {
      state.matchHold += dt;
      if (state.matchHold >= stage.holdSeconds) beginSuccess();
    } else {
      state.matchHold = Math.max(0, state.matchHold - dt * 2.2);
    }
  } else if (state.mode === 'success') {
    state.successTime += dt;
  }
}

function roundRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
}

function drawCover(image, x, y, width, height) {
  if (!image.complete || !image.naturalWidth) return false;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sw = width / scale;
  const sh = height / scale;
  const sx = (image.naturalWidth - sw) / 2;
  const sy = (image.naturalHeight - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
  return true;
}

function drawBackground() {
  ctx.fillStyle = '#1d141a';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  drawCover(assets.background, 0, 0, WORLD.width, WORLD.height);

  const vignette = ctx.createRadialGradient(450, 690, 210, 450, 760, 920);
  vignette.addColorStop(0, 'rgba(83, 48, 38, .08)');
  vignette.addColorStop(0.62, 'rgba(20, 10, 18, .08)');
  vignette.addColorStop(1, 'rgba(5, 4, 7, .62)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  drawStars();
  drawMoon();
  drawSideFoliage();
}

function drawStars() {
  const stars = [[118, 164, 14], [771, 190, 8], [238, 273, 7], [676, 258, 5], [66, 318, 4], [831, 333, 6]];
  ctx.save();
  stars.forEach(([x, y, size], index) => {
    const pulse = state.reducedMotion ? 1 : 0.78 + Math.sin(state.elapsed * 1.2 + index) * 0.16;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = index % 2 ? '#d8984f' : '#a96a34';
    ctx.beginPath();
    ctx.moveTo(x, y - size * 1.7);
    ctx.lineTo(x + size * 0.35, y - size * 0.3);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x + size * 0.35, y + size * 0.3);
    ctx.lineTo(x, y + size * 1.7);
    ctx.lineTo(x - size * 0.35, y + size * 0.3);
    ctx.lineTo(x - size, y);
    ctx.lineTo(x - size * 0.35, y - size * 0.3);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
}

function drawMoon() {
  ctx.save();
  ctx.translate(755, 257);
  ctx.rotate(-0.16);
  ctx.shadowColor = 'rgba(219, 153, 79, .36)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#aa7445';
  ctx.beginPath();
  ctx.arc(0, 0, 45, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#251821';
  ctx.beginPath();
  ctx.arc(-17, -15, 44, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawSideFoliage() {
  ctx.save();
  ctx.globalAlpha = 0.92;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side < 0 ? 0 : 900, 760);
    ctx.scale(side, 1);
    const colors = ['#2f2727', '#3b2d2d', '#4c322e', '#231f22'];
    for (let i = 0; i < 13; i += 1) {
      const x = 22 + (i % 3) * 27;
      const y = -170 + i * 30;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.ellipse(x, y, 52 - (i % 4) * 4, 74, -0.55 + (i % 3) * 0.24, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawHeader() {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ead6b5';
  ctx.shadowColor = 'rgba(0,0,0,.5)';
  ctx.shadowBlur = 4;
  ctx.font = '700 58px "Gowun Batang", "Nanum Myeongjo", serif';
  ctx.fillText('빌린 그림자', 450, 112);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#d9914d';
  ctx.font = '400 25px "Gowun Batang", "Nanum Myeongjo", serif';
  ctx.fillText(state.mode === 'success' ? '새가 빛을 기억했어요' : '흩어진 빛으로 새를 깨워요', 450, 158);
  ctx.restore();
}

function theaterOpeningPath() {
  ctx.beginPath();
  ctx.moveTo(104, 405);
  ctx.quadraticCurveTo(104, 326, 186, 326);
  ctx.quadraticCurveTo(302, 325, 450, 262);
  ctx.quadraticCurveTo(598, 325, 714, 326);
  ctx.quadraticCurveTo(796, 326, 796, 405);
  ctx.lineTo(796, 1038);
  ctx.quadraticCurveTo(796, 1082, 752, 1082);
  ctx.lineTo(148, 1082);
  ctx.quadraticCurveTo(104, 1082, 104, 1038);
  ctx.closePath();
}

function drawTheater() {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.72)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 18;
  theaterOpeningPath();
  ctx.fillStyle = '#4b2e27';
  ctx.fill();
  ctx.restore();

  ctx.save();
  theaterOpeningPath();
  ctx.clip();
  ctx.fillStyle = '#e9c98c';
  ctx.fillRect(104, 260, 692, 822);
  drawCover(assets.screen, 104, 260, 692, 822);
  drawLightBeams();
  drawTargetAndShadows();
  drawStageFloor();
  ctx.restore();

  drawCurtains();
  drawFrame();
}

function drawLightBeams() {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  stage.lanterns.forEach((lantern, index) => {
    const point = railPoint(state.lanterns[lantern.id]);
    const sectionWidth = 576 / stage.lanterns.length;
    const left = 162 + index * sectionWidth;
    const right = left + sectionWidth + 36;
    const color = lantern.beamRgb;
    const gradient = ctx.createLinearGradient(point.x, point.y, 450, 430);
    gradient.addColorStop(0, `rgba(${color.join(',')}, .2)`);
    gradient.addColorStop(0.7, `rgba(${color.join(',')}, .1)`);
    gradient.addColorStop(1, `rgba(${color.join(',')}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(point.x - 18, point.y);
    ctx.lineTo(left, 404);
    ctx.lineTo(right, 404);
    ctx.lineTo(point.x + 18, point.y);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
}

function polygonPath(points) {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function drawLightShadowGeometry(lightShadow, fill) {
  lightShadow.objects.forEach((objectShadow) => {
    objectShadow.polygons.forEach((polygon) => fillPolygon(polygon, fill, 4));
  });
}

function buildUmbraCanvas(shadowScene, fill) {
  const result = document.createElement('canvas');
  result.width = WORLD.width;
  result.height = WORLD.height;
  const resultContext = result.getContext('2d');
  const lightCanvas = document.createElement('canvas');
  lightCanvas.width = WORLD.width;
  lightCanvas.height = WORLD.height;
  const lightContext = lightCanvas.getContext('2d');

  Object.values(shadowScene).forEach((lightShadow, index) => {
    lightContext.clearRect(0, 0, WORLD.width, WORLD.height);
    lightContext.fillStyle = fill;
    lightShadow.objects.forEach((objectShadow) => {
      objectShadow.polygons.forEach((polygon) => {
        lightContext.beginPath();
        polygon.forEach(([x, y], pointIndex) => {
          if (pointIndex === 0) lightContext.moveTo(x, y);
          else lightContext.lineTo(x, y);
        });
        lightContext.closePath();
        lightContext.fill();
      });
    });
    if (index === 0) {
      resultContext.drawImage(lightCanvas, 0, 0);
    } else {
      resultContext.globalCompositeOperation = 'destination-in';
      resultContext.drawImage(lightCanvas, 0, 0);
      resultContext.globalCompositeOperation = 'source-over';
    }
  });
  return result;
}

function fillPolygon(points, fill, blur = 0) {
  ctx.save();
  if (blur) {
    ctx.shadowColor = fill;
    ctx.shadowBlur = blur;
  }
  polygonPath(points);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function drawTargetAndShadows() {
  const current = getProjectedShadows(state.lanterns, stage);
  const nearing = Math.max(0, (state.score - 0.68) / 0.32);

  ctx.save();
  ctx.globalAlpha = 0.15 + nearing * 0.08;
  ctx.shadowColor = 'rgba(89, 61, 42, .65)';
  ctx.shadowBlur = 7;
  ctx.drawImage(targetUmbraCanvas, 0, 0);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  stage.lanterns.forEach((lantern) => {
    drawLightShadowGeometry(current[lantern.id], lantern.shadow);
  });
  ctx.restore();

  if (state.mode === 'success') drawAwakenedBird();
}

function drawAwakenedBird() {
  const rise = state.reducedMotion ? 0 : Math.min(1, state.successTime / 1.25);
  const bob = state.reducedMotion ? 0 : Math.sin(state.successTime * 4) * 4;
  ctx.save();
  ctx.translate(0, -rise * 72 + bob);
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowColor = 'rgba(255, 193, 96, .8)';
  ctx.shadowBlur = 34;
  ctx.globalAlpha = 0.94;
  ctx.drawImage(targetUmbraCanvas, 0, 0);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#f0b15c';
  ctx.beginPath();
  ctx.arc(519, 634, 4.5, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  state.particles.forEach((particle) => {
    const distance = Math.min(180, state.successTime * particle.speed);
    const x = 470 + Math.cos(particle.angle) * distance;
    const y = 665 + Math.sin(particle.angle) * distance - state.successTime * 26;
    const alpha = Math.max(0, 1 - state.successTime / 3.2);
    ctx.fillStyle = `rgba(242, 178, 90, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, particle.size, 0, TAU);
    ctx.fill();
  });
  ctx.restore();
}

function drawStageFloor() {
  const gradient = ctx.createLinearGradient(0, 850, 0, 1090);
  gradient.addColorStop(0, 'rgba(153, 103, 62, .08)');
  gradient.addColorStop(1, 'rgba(89, 53, 38, .38)');
  ctx.fillStyle = gradient;
  ctx.fillRect(104, 905, 692, 180);
  ctx.strokeStyle = 'rgba(107, 68, 44, .38)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(104, 989);
  ctx.lineTo(796, 989);
  ctx.stroke();
  drawPaperObjects();
}

function drawPaperObjects() {
  ctx.save();
  ctx.shadowColor = 'rgba(38, 21, 19, .46)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 12;
  ctx.shadowOffsetY = 15;
  const palette = {
    pine: ['#28514d', '#183a38'],
    leaf: ['#53604a', '#384234'],
    mountains: ['#884533', '#633326'],
  };
  const baseY = 1040;
  const scale = 0.48;
  stage.objects.forEach((object) => {
    const [fill, stroke] = palette[object.kind];
    object.polygons.forEach((polygon, polygonIndex) => {
      const displayPolygon = polygon.map(([x, height]) => [
        object.displayX + x * scale,
        baseY - height * scale,
      ]);
      polygonPath(displayPolygon);
      ctx.fillStyle = polygonIndex === 0 ? fill : stroke;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 3;
      ctx.fill();
      ctx.stroke();
    });

    ctx.shadowBlur = 0;
    ctx.strokeStyle = object.kind === 'mountains' ? '#bc6846' : '#9a805b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(object.displayX, baseY - 12);
    ctx.lineTo(object.displayX, baseY - 115);
    ctx.stroke();
    ctx.shadowBlur = 12;
  });
  ctx.restore();
}

function drawCurtains() {
  ctx.save();
  ctx.fillStyle = '#43272c';
  ctx.strokeStyle = '#a7613e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(94, 344); ctx.lineTo(305, 332); ctx.quadraticCurveTo(285, 428, 226, 447);
  ctx.quadraticCurveTo(176, 459, 111, 538); ctx.lineTo(94, 344); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(806, 344); ctx.lineTo(595, 332); ctx.quadraticCurveTo(615, 428, 674, 447);
  ctx.quadraticCurveTo(724, 459, 789, 538); ctx.lineTo(806, 344); ctx.fill(); ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(250, 322); ctx.quadraticCurveTo(288, 401, 342, 333);
  ctx.quadraticCurveTo(389, 401, 450, 330);
  ctx.quadraticCurveTo(511, 401, 558, 333);
  ctx.quadraticCurveTo(612, 401, 650, 322);
  ctx.lineTo(650, 292); ctx.lineTo(250, 292); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawFrame() {
  ctx.save();
  ctx.strokeStyle = '#6d402d';
  ctx.lineWidth = 28;
  theaterOpeningPath();
  ctx.stroke();
  ctx.strokeStyle = '#b06b3e';
  ctx.lineWidth = 2;
  theaterOpeningPath();
  ctx.stroke();

  ctx.fillStyle = '#543222';
  ctx.strokeStyle = '#aa653c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(82, 348);
  ctx.quadraticCurveTo(222, 317, 330, 270);
  ctx.quadraticCurveTo(406, 234, 450, 202);
  ctx.quadraticCurveTo(494, 234, 570, 270);
  ctx.quadraticCurveTo(678, 317, 818, 348);
  ctx.lineTo(805, 390);
  ctx.quadraticCurveTo(645, 339, 450, 284);
  ctx.quadraticCurveTo(255, 339, 95, 390);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#23191b';
  ctx.beginPath();
  ctx.moveTo(384, 309); ctx.lineTo(420, 268); ctx.lineTo(440, 319);
  ctx.lineTo(450, 253); ctx.lineTo(470, 319); ctx.lineTo(492, 270);
  ctx.lineTo(517, 309); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawRailAndLanterns() {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#2a1e1d';
  ctx.lineWidth = 38;
  traceRail(); ctx.stroke();
  ctx.strokeStyle = '#76503a';
  ctx.lineWidth = 28;
  traceRail(); ctx.stroke();
  ctx.strokeStyle = '#b07a50';
  ctx.lineWidth = 2;
  traceRail(); ctx.stroke();
  ctx.setLineDash([10, 12]);
  ctx.strokeStyle = 'rgba(240, 213, 171, .85)';
  ctx.lineWidth = 3;
  traceRail(); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  stage.lanterns.forEach((lantern) => drawLantern(lantern.id, lantern.glow, lantern.body));
}

function traceRail() {
  ctx.beginPath();
  for (let i = 0; i <= 60; i += 1) {
    const point = railPoint(i / 60);
    if (i === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
}

function drawLantern(key, glow, body) {
  const point = railPoint(state.lanterns[key]);
  const selected = state.selected === key && state.mode === 'play';
  const pulse = state.reducedMotion ? 1 : 0.9 + Math.sin(state.elapsed * 3 + (key === 'blue' ? 0 : 1.4)) * 0.08;
  ctx.save();
  ctx.translate(point.x, point.y - 11);
  const radial = ctx.createRadialGradient(0, 2, 4, 0, 2, selected ? 83 : 67);
  radial.addColorStop(0, `${glow}dd`);
  radial.addColorStop(0.22, `${glow}88`);
  radial.addColorStop(1, `${glow}00`);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = radial;
  ctx.beginPath(); ctx.arc(0, 2, selected ? 83 : 67, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#2b211f';
  ctx.strokeStyle = '#b1794b';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, 45, 47, 16, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = body;
  polygonPath([[-38, 33], [-31, -21], [0, -38], [31, -21], [38, 33]]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = `${glow}bb`;
  polygonPath([[-24, 24], [-19, -12], [0, -21], [19, -12], [24, 24]]); ctx.fill();
  ctx.fillStyle = '#241b1b';
  ctx.fillRect(-4, -51, 8, 18);
  ctx.beginPath(); ctx.arc(0, -52, 7, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,244,202,.84)';
  ctx.beginPath(); ctx.moveTo(-7, 20); ctx.quadraticCurveTo(0, -5, 8, 20); ctx.closePath(); ctx.fill();

  if (selected) {
    ctx.strokeStyle = '#f3dfbb';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 7]);
    ctx.beginPath(); ctx.arc(0, 0, 60, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

function drawHUD() {
  if (state.mode === 'intro') return;
  const score = Math.round(state.score * 100);
  const x = 238;
  const y = 1188;
  const width = 424;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d9c4a2';
  ctx.font = '400 21px "Gowun Batang", serif';
  ctx.fillText(state.mode === 'success' ? '그림자가 하나가 되었어요' : '그림자 일치율', 450, y - 21);
  roundRect(x, y, width, 18, 9);
  ctx.fillStyle = 'rgba(26, 17, 19, .68)'; ctx.fill();
  const meter = ctx.createLinearGradient(x, 0, x + width, 0);
  meter.addColorStop(0, '#3db3b3'); meter.addColorStop(.5, '#d6a45e'); meter.addColorStop(1, '#df6d42');
  roundRect(x + 3, y + 3, Math.max(12, (width - 6) * state.score), 12, 6);
  ctx.fillStyle = meter; ctx.fill();
  const thresholdX = x + 3 + (width - 6) * stage.successThreshold;
  ctx.strokeStyle = 'rgba(255, 239, 209, .8)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(thresholdX, y - 3); ctx.lineTo(thresholdX, y + 21); ctx.stroke();
  ctx.fillStyle = '#f1dfbd';
  ctx.font = '700 22px "Gowun Batang", serif';
  ctx.fillText(`${score}%`, 450, y + 53);
  ctx.restore();
}

function drawResetButton() {
  if (state.mode === 'intro') return;
  ctx.save();
  ctx.translate(450, 1492);
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 7;
  ctx.fillStyle = '#d8b987';
  ctx.strokeStyle = '#9c6e48';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 28; i += 1) {
    const angle = (i / 28) * TAU;
    const radius = i % 2 ? 45 : 48;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#493126'; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(2, 0, 20, -0.2, Math.PI * 1.55); ctx.stroke();
  ctx.fillStyle = '#493126';
  polygonPath([[-21, -12], [-2, -16], [-12, 1]]); ctx.fill();
  ctx.restore();
}

function drawHint() {
  if (state.mode !== 'play' || state.elapsed > 8 || state.dragging) return;
  const alpha = Math.max(0, 1 - Math.max(0, state.elapsed - 6) / 2) * (0.72 + Math.sin(state.elapsed * 3) * 0.18);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#efdbb9';
  ctx.textAlign = 'center';
  ctx.font = '400 20px "Gowun Batang", serif';
  ctx.fillText('랜턴을 잡고 레일을 따라 움직여 보세요', 450, 1276);
  ctx.restore();
}

function drawIntro() {
  if (state.mode !== 'intro') return;
  ctx.save();
  ctx.fillStyle = 'rgba(21, 14, 18, .6)';
  ctx.fillRect(0, 0, 900, 1600);

  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 24;
  roundRect(118, 460, 664, 515, 38);
  ctx.fillStyle = 'rgba(49, 31, 32, .94)'; ctx.fill();
  ctx.strokeStyle = '#a86842'; ctx.lineWidth = 2; ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f0ddbd';
  ctx.font = '700 39px "Gowun Batang", serif';
  ctx.fillText('잠든 새에게 빛을 빌려주세요', 450, 548);
  ctx.fillStyle = '#cbb594';
  ctx.font = '400 23px "Gowun Batang", serif';
  ctx.fillText('두 랜턴을 곡선 레일 위에서 움직여', 450, 617);
  ctx.fillText('세 종이 오브젝트의 그림자를 모아보세요.', 450, 654);

  drawMiniLantern(327, 735, '#43c6ca');
  ctx.fillStyle = '#b99568'; ctx.font = '400 34px serif'; ctx.fillText('↔', 450, 748);
  drawMiniLantern(573, 735, '#f3834e');

  ctx.fillStyle = '#9f896c';
  ctx.font = '400 18px "Gowun Batang", serif';
  ctx.fillText('마우스 · 터치로 드래그  /  F 전체화면', 450, 820);

  roundRect(290, 862, 320, 72, 36);
  const button = ctx.createLinearGradient(290, 0, 610, 0);
  button.addColorStop(0, '#2f8587'); button.addColorStop(1, '#b95b39');
  ctx.fillStyle = button; ctx.fill();
  ctx.strokeStyle = 'rgba(255,233,195,.58)'; ctx.stroke();
  ctx.fillStyle = '#fff0d1'; ctx.font = '700 25px "Gowun Batang", serif';
  ctx.fillText('공연 시작', 450, 907);
  ctx.restore();
}

function drawMiniLantern(x, y, color) {
  ctx.save(); ctx.translate(x, y);
  ctx.shadowColor = color; ctx.shadowBlur = 24;
  ctx.fillStyle = color; ctx.fillRect(-22, -25, 44, 47);
  ctx.shadowBlur = 0; ctx.strokeStyle = '#d2a573'; ctx.lineWidth = 3; ctx.strokeRect(-22, -25, 44, 47);
  ctx.beginPath(); ctx.moveTo(-29, -25); ctx.lineTo(0, -47); ctx.lineTo(29, -25); ctx.closePath(); ctx.fillStyle = '#2d2020'; ctx.fill();
  ctx.restore();
}

function drawSuccessCard() {
  if (state.mode !== 'success' || state.successTime < 1.15) return;
  const alpha = Math.min(1, (state.successTime - 1.15) * 2.5);
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#4b3027';
  ctx.font = '700 34px "Gowun Batang", serif';
  ctx.fillText('새가 깨어났어요!', 450, 895);
  ctx.fillStyle = '#76533b'; ctx.font = '400 19px "Gowun Batang", serif';
  ctx.fillText('아래 되돌리기 버튼으로 다시 맞춰볼 수 있어요', 450, 928);
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);
  drawBackground();
  drawHeader();
  drawTheater();
  drawHUD();
  drawRailAndLanterns();
  drawHint();
  drawResetButton();
  drawSuccessCard();
  drawIntro();
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WORLD.width,
    y: ((event.clientY - rect.top) / rect.height) * WORLD.height,
  };
}

canvas.addEventListener('pointerdown', (event) => {
  const point = canvasPoint(event);
  if (state.mode === 'intro') {
    if (point.x >= 260 && point.x <= 640 && point.y >= 825 && point.y <= 955) {
      resetGame();
      canvas.setPointerCapture(event.pointerId);
    }
    return;
  }

  if (Math.hypot(point.x - 450, point.y - 1492) <= 70) {
    resetGame();
    return;
  }
  if (state.mode !== 'play') return;
  const hit = nearestLantern(point, state.lanterns, 96);
  if (hit) {
    state.dragging = hit;
    state.selected = hit;
    canvas.setPointerCapture(event.pointerId);
  }
});

canvas.addEventListener('pointermove', (event) => {
  if (!state.dragging || state.mode !== 'play') return;
  const point = canvasPoint(event);
  state.lanterns[state.dragging] = lanternTFromX(point.x);
  state.scoreDirty = true;
});

function endDrag(event) {
  if (state.dragging) {
    state.dragging = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

window.addEventListener('keydown', async (event) => {
  const key = event.key.toLowerCase();
  if (key === 'f') {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    else await document.exitFullscreen?.();
    return;
  }
  if (key === 'r') {
    resetGame();
    return;
  }
  if (state.mode === 'intro' && (key === 'enter' || key === ' ')) {
    event.preventDefault(); resetGame(); return;
  }
  if (state.mode !== 'play') return;
  if (/^[1-9]$/.test(key)) {
    const lantern = stage.lanterns[Number(key) - 1];
    if (lantern) state.selected = lantern.id;
  }
  if (key === 'arrowleft' || key === 'arrowright') {
    event.preventDefault();
    const direction = key === 'arrowleft' ? -1 : 1;
    state.lanterns[state.selected] = Math.min(1, Math.max(0, state.lanterns[state.selected] + direction * 0.012));
    state.scoreDirty = true;
  }
});

let previousTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - previousTime) / 1000);
  previousTime = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

window.render_game_to_text = () => JSON.stringify({
  coordinateSystem: '900x1600 canvas; origin top-left; x right; y down',
  mode: state.mode,
  objective: 'Move every lantern along the curved rail until the physically projected umbra fills the faint bird silhouette.',
  lanterns: {
    blue: { t: Number(state.lanterns.blue.toFixed(3)), ...railPoint(state.lanterns.blue) },
    amber: { t: Number(state.lanterns.amber.toFixed(3)), ...railPoint(state.lanterns.amber) },
  },
  selectedLantern: state.selected,
  dragging: state.dragging,
  similarityPercent: Math.round(state.score * 100),
  successThresholdPercent: Math.round(stage.successThreshold * 100),
  optics: {
    screenPlaneZ: stage.screen.z,
    lightDepth: stage.lightModel.depth,
    lightHeight: stage.lightModel.height,
    objectDepths: Object.fromEntries(stage.objects.map((object) => [object.id, object.depth])),
    scoringMask: 'umbra: points occluded from every active light',
  },
  matchHoldSeconds: Number(state.matchHold.toFixed(2)),
  controls: 'drag lanterns; number keys select; arrows move; R reset; F fullscreen',
});

window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) update(1 / 60);
  render();
};

window.__shadowGame = {
  state,
  setLanternPositions(positions) {
    Object.assign(state.lanterns, positions);
    state.score = calculateShadowSimilarity(state.lanterns, stage);
    state.scoreDirty = false;
    render();
  },
  setLanterns(blue, amber) {
    state.lanterns.blue = blue;
    state.lanterns.amber = amber;
    state.score = calculateShadowSimilarity(state.lanterns, stage);
    state.scoreDirty = false;
    render();
  },
  goals: LANTERN_GOALS,
};

state.score = calculateShadowSimilarity(state.lanterns, stage);
render();
requestAnimationFrame(frame);
