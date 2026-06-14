(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const sprinkleEl = document.getElementById('sprinkles');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayCopy = document.getElementById('overlay-copy');
  const startButton = document.getElementById('start-button');

  const W = canvas.width;
  const H = canvas.height;
  const groundY = H - 56;
  const cakeX = 205;
  const state = {
    mode: 'ready',
    t: 0,
    score: 0,
    best: Number(localStorage.getItem('cake-flap-best') || 0),
    sprinkles: 0,
    speed: 3.35,
    muted: false,
    particles: [],
    obstacles: [],
    bonuses: [],
    clouds: [],
    shake: 0,
    flash: 0,
    audio: null,
  };

  const cake = {
    x: cakeX,
    y: H * 0.46,
    vy: 0,
    r: 25,
    rot: 0,
    flapGlow: 0,
  };

  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const ease = v => 1 - Math.pow(1 - v, 3);

  bestEl.textContent = state.best;

  function makeClouds() {
    state.clouds = Array.from({ length: 12 }, (_, i) => ({
      x: rand(0, W),
      y: rand(45, 250),
      s: rand(0.6, 1.55),
      speed: rand(0.15, 0.48),
      hue: i % 2 ? '#fff0ce' : '#ffcfdf',
    }));
  }

  function resetGame() {
    state.mode = 'playing';
    state.t = 0;
    state.score = 0;
    state.sprinkles = 0;
    state.speed = 3.35;
    state.particles.length = 0;
    state.obstacles.length = 0;
    state.bonuses.length = 0;
    state.shake = 0;
    state.flash = 0;
    cake.y = H * 0.46;
    cake.vy = -5;
    cake.rot = -0.18;
    cake.flapGlow = 1;
    spawnObstacle();
    spawnObstacle(W + 320);
    updateHUD();
    hideOverlay();
  }

  function updateHUD() {
    scoreEl.textContent = state.score;
    bestEl.textContent = state.best;
    sprinkleEl.textContent = state.sprinkles;
  }

  function showOverlay(title, copy, buttonText = 'Start baking') {
    overlayTitle.textContent = title;
    overlayCopy.textContent = copy;
    startButton.textContent = buttonText;
    overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  function spawnObstacle(forcedX) {
    const gap = clamp(158 - state.score * 0.7, 122, 158);
    const center = rand(155, groundY - 125);
    const width = rand(68, 86);
    const kind = Math.random() > 0.48 ? 'forks' : 'candles';
    const x = forcedX || W + rand(60, 120);
    state.obstacles.push({ x, width, gapTop: center - gap / 2, gapBottom: center + gap / 2, passed: false, kind });
    if (Math.random() > 0.24) {
      state.bonuses.push({ x: x + width / 2, y: center + rand(-gap * 0.24, gap * 0.24), r: 12, taken: false, wobble: rand(0, 10) });
    }
  }

  function flap() {
    if (state.mode === 'ready' || state.mode === 'gameover') {
      resetGame();
      ping(420, 0.08, 'triangle', 0.05);
      return;
    }
    if (state.mode !== 'playing') return;
    cake.vy = -8.25;
    cake.flapGlow = 1;
    state.shake = 2;
    for (let i = 0; i < 11; i++) {
      addParticle(cake.x - 15, cake.y + rand(-16, 16), rand(-2.3, -0.4), rand(-1.4, 1.4), rand(3, 8), pick(['#ff9fc7', '#fff0ce', '#86f1cf', '#ffce74']));
    }
    ping(560, 0.055, 'sine', 0.035);
  }

  function pauseToggle() {
    if (state.mode === 'playing') {
      state.mode = 'paused';
      showOverlay('Paused', 'The cake is catching its breath. Press P, tap, or click to continue.', 'Resume');
    } else if (state.mode === 'paused') {
      state.mode = 'playing';
      hideOverlay();
    }
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function addParticle(x, y, vx, vy, size, color, life = 50) {
    state.particles.push({ x, y, vx, vy, size, color, life, maxLife: life, spin: rand(-0.18, 0.18) });
  }

  function collideCircleRect(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy < cr * cr;
  }

  function gameOver() {
    if (state.mode !== 'playing') return;
    state.mode = 'gameover';
    state.flash = 1;
    state.shake = 14;
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem('cake-flap-best', String(state.best));
    }
    for (let i = 0; i < 42; i++) {
      addParticle(cake.x + rand(-18, 18), cake.y + rand(-18, 18), rand(-5, 4), rand(-5, 3), rand(4, 11), pick(['#ff9fc7', '#fff0ce', '#5a2e22', '#ff4f77']), rand(40, 75));
    }
    updateHUD();
    ping(110, 0.22, 'sawtooth', 0.055);
    setTimeout(() => showOverlay('Cake down!', `Score ${state.score}. Strawberries ${state.sprinkles}. Press R or tap to bake another run.`, 'Try again'), 350);
  }

  function update() {
    state.t++;
    if (state.mode !== 'playing') {
      updateClouds();
      updateParticles();
      state.flash *= 0.9;
      state.shake *= 0.86;
      return;
    }

    state.speed = clamp(3.35 + state.score * 0.035, 3.35, 5.8);
    cake.vy += 0.42;
    cake.y += cake.vy;
    cake.rot = clamp(cake.vy * 0.055, -0.55, 0.9);
    cake.flapGlow *= 0.88;

    updateClouds();
    updateParticles();

    if (cake.y + cake.r > groundY || cake.y - cake.r < 0) gameOver();

    const last = state.obstacles[state.obstacles.length - 1];
    if (!last || last.x < W - 300) spawnObstacle();

    for (const obstacle of state.obstacles) {
      obstacle.x -= state.speed;
      if (!obstacle.passed && obstacle.x + obstacle.width < cake.x) {
        obstacle.passed = true;
        state.score++;
        state.shake = 1.5;
        updateHUD();
        ping(740 + Math.min(state.score, 20) * 8, 0.065, 'square', 0.024);
      }
      const hitTop = collideCircleRect(cake.x, cake.y, cake.r * 0.8, obstacle.x, 0, obstacle.width, obstacle.gapTop);
      const hitBottom = collideCircleRect(cake.x, cake.y, cake.r * 0.8, obstacle.x, obstacle.gapBottom, obstacle.width, groundY - obstacle.gapBottom);
      if (hitTop || hitBottom) gameOver();
    }
    state.obstacles = state.obstacles.filter(o => o.x + o.width > -30);

    for (const bonus of state.bonuses) {
      bonus.x -= state.speed;
      bonus.y += Math.sin(state.t * 0.05 + bonus.wobble) * 0.32;
      const dx = cake.x - bonus.x;
      const dy = cake.y - bonus.y;
      if (!bonus.taken && dx * dx + dy * dy < (cake.r + bonus.r) ** 2) {
        bonus.taken = true;
        state.sprinkles++;
        state.score++;
        updateHUD();
        state.flash = 0.45;
        for (let i = 0; i < 24; i++) addParticle(bonus.x, bonus.y, rand(-4, 4), rand(-4, 3), rand(2.5, 7), pick(['#ff4f77', '#86f1cf', '#fff0ce', '#ffce74']), rand(30, 60));
        ping(920, 0.08, 'triangle', 0.04);
      }
    }
    state.bonuses = state.bonuses.filter(b => b.x > -35 && !b.taken);
  }

  function updateClouds() {
    for (const cloud of state.clouds) {
      cloud.x -= cloud.speed;
      if (cloud.x < -120) {
        cloud.x = W + rand(20, 100);
        cloud.y = rand(45, 250);
      }
    }
  }

  function updateParticles() {
    for (const p of state.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.vx *= 0.99;
      p.life--;
    }
    state.particles = state.particles.filter(p => p.life > 0);
  }

  function draw() {
    const shakeX = rand(-state.shake, state.shake);
    const shakeY = rand(-state.shake, state.shake);
    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawBackground();
    drawObstacles();
    drawBonuses();
    drawCake();
    drawParticles();
    drawGround();
    ctx.restore();

    if (state.flash > 0.01) {
      ctx.fillStyle = `rgba(255, 240, 206, ${state.flash * 0.18})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#342045');
    sky.addColorStop(0.58, '#5c2f48');
    sky.addColorStop(1, '#2a1428');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 36; i++) {
      const x = (i * 73 - (state.t * 0.36) % 73);
      const y = 28 + (i * 47) % 255;
      drawSprinkle(x, y, (i * 0.7) % Math.PI, pick(['#fff0ce', '#ff9fc7', '#86f1cf']));
    }
    ctx.globalAlpha = 1;

    for (const c of state.clouds) drawCloud(c.x, c.y, c.s, c.hue);
  }

  function drawCloud(x, y, s, hue) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = hue;
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.ellipse(0, 8, 45, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(-18, 0, 26, 20, 0, 0, Math.PI * 2);
    ctx.ellipse(17, -4, 30, 24, 0, 0, Math.PI * 2);
    ctx.ellipse(44, 7, 24, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawObstacles() {
    for (const o of state.obstacles) {
      if (o.kind === 'candles') drawCandles(o); else drawForks(o);
    }
  }

  function drawCandles(o) {
    const stripe = 14;
    drawCandleColumn(o.x, -20, o.width, o.gapTop + 20, true, stripe);
    drawCandleColumn(o.x, o.gapBottom, o.width, groundY - o.gapBottom + 8, false, stripe);
  }

  function drawCandleColumn(x, y, w, h, upside, stripe) {
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, '#fff0ce');
    grad.addColorStop(1, '#ffc9dc');
    roundedRect(x, y, w, h, 17, grad);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,79,119,0.58)';
    ctx.lineWidth = 8;
    for (let yy = y - h; yy < y + h * 2; yy += stripe * 2) {
      ctx.beginPath();
      ctx.moveTo(x - 18, yy);
      ctx.lineTo(x + w + 18, yy + 50);
      ctx.stroke();
    }
    ctx.restore();
    drawFlame(x + w / 2, upside ? y + h + 6 : y - 7, upside ? Math.PI : 0);
  }

  function drawForks(o) {
    drawForkColumn(o.x, -18, o.width, o.gapTop + 18, true);
    drawForkColumn(o.x, o.gapBottom, o.width, groundY - o.gapBottom + 12, false);
  }

  function drawForkColumn(x, y, w, h, upside) {
    roundedRect(x + w * 0.18, y, w * 0.64, h, 15, '#d9d4ce');
    const tipY = upside ? y + h : y;
    const dir = upside ? 1 : -1;
    ctx.fillStyle = '#f0ece4';
    for (let i = 0; i < 4; i++) {
      const tx = x + 8 + i * (w - 16) / 3;
      roundedRect(tx - 4, tipY - dir * 2, 8, dir * 34, 5, '#f0ece4');
    }
    ctx.fillStyle = 'rgba(90,46,34,0.18)';
    ctx.fillRect(x + w * 0.55, y + 12, 5, Math.max(0, h - 24));
  }

  function drawFlame(x, y, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot + Math.sin(state.t * 0.15) * 0.08);
    ctx.fillStyle = '#ffce74';
    ctx.beginPath();
    ctx.moveTo(0, -19);
    ctx.bezierCurveTo(16, -3, 11, 16, 0, 19);
    ctx.bezierCurveTo(-11, 10, -13, -4, 0, -19);
    ctx.fill();
    ctx.fillStyle = '#ff4f77';
    ctx.beginPath();
    ctx.ellipse(0, 5, 5, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBonuses() {
    for (const b of state.bonuses) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.sin(state.t * 0.07 + b.wobble) * 0.4);
      ctx.fillStyle = '#ff4f77';
      ctx.beginPath();
      ctx.ellipse(0, 2, 12, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#86f1cf';
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.ellipse(0, -13, 4, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(-4, -1, 3, 6, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawCake() {
    ctx.save();
    ctx.translate(cake.x, cake.y);
    ctx.rotate(cake.rot);
    if (cake.flapGlow > 0.02) {
      ctx.fillStyle = `rgba(255,159,199,${cake.flapGlow * 0.18})`;
      ctx.beginPath();
      ctx.ellipse(-5, 2, 46 + cake.flapGlow * 16, 38 + cake.flapGlow * 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cake slice triangle.
    ctx.fillStyle = '#ffd69a';
    ctx.strokeStyle = '#5a2e22';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-31, -24);
    ctx.lineTo(30, -4);
    ctx.lineTo(-23, 31);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Chocolate layers.
    ctx.strokeStyle = '#8b4a2e';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-19, -8);
    ctx.lineTo(12, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-20, 11);
    ctx.lineTo(4, 18);
    ctx.stroke();

    // Frosting cap.
    ctx.fillStyle = '#ff9fc7';
    ctx.strokeStyle = '#5a2e22';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-33, -25);
    ctx.quadraticCurveTo(-14, -42, 6, -24);
    ctx.quadraticCurveTo(19, -15, 30, -5);
    ctx.quadraticCurveTo(-3, 0, -33, -25);
    ctx.fill();
    ctx.stroke();

    // Eye and smile.
    ctx.fillStyle = '#2a1428';
    ctx.beginPath();
    ctx.arc(9, -7, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2a1428';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(12, 3, 7, 0.1, 1.1);
    ctx.stroke();

    // Tiny candle jetpack.
    ctx.fillStyle = '#fff0ce';
    roundedRect(-31, -6, 10, 25, 4, '#fff0ce');
    ctx.strokeStyle = '#ff4f77';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-30, 1);
    ctx.lineTo(-22, 8);
    ctx.moveTo(-31, 10);
    ctx.lineTo(-22, 17);
    ctx.stroke();
    if (cake.vy < -1) drawFlame(-26, 25, Math.PI);

    ctx.restore();
  }

  function drawParticles() {
    for (const p of state.particles) {
      ctx.save();
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin * p.life);
      drawSprinkle(0, 0, 0, p.color, p.size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawGround() {
    const grad = ctx.createLinearGradient(0, groundY, 0, H);
    grad.addColorStop(0, '#7b4a35');
    grad.addColorStop(1, '#3a1d22');
    ctx.fillStyle = grad;
    ctx.fillRect(0, groundY, W, H - groundY);

    ctx.fillStyle = '#fff0ce';
    ctx.globalAlpha = 0.24;
    for (let x = -((state.t * state.speed) % 44); x < W + 44; x += 44) {
      ctx.beginPath();
      ctx.ellipse(x, groundY + 14, 18, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function roundedRect(x, y, w, h, r, fill) {
    if (h < 0) { y += h; h = -h; }
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  function drawSprinkle(x, y, rot, color, len = 8) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, len * 0.35);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0);
    ctx.lineTo(len / 2, 0);
    ctx.stroke();
    ctx.restore();
  }

  function initAudio() {
    if (state.audio) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    state.audio = new AudioContext();
  }

  function ping(freq, duration, type, gain) {
    if (state.muted) return;
    initAudio();
    const ac = state.audio;
    if (!ac) return;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
    osc.connect(g).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + duration);
  }

  function frame() {
    update();
    draw();
    requestAnimationFrame(frame);
  }

  function onPrimaryAction(ev) {
    if (ev) ev.preventDefault();
    if (state.mode === 'paused') pauseToggle(); else flap();
  }

  window.addEventListener('keydown', ev => {
    if (ev.code === 'Space' || ev.code === 'ArrowUp') onPrimaryAction(ev);
    if (ev.key === 'p' || ev.key === 'P') pauseToggle();
    if (ev.key === 'r' || ev.key === 'R') resetGame();
    if (ev.key === 'm' || ev.key === 'M') state.muted = !state.muted;
  });
  canvas.addEventListener('pointerdown', onPrimaryAction);
  startButton.addEventListener('click', onPrimaryAction);

  makeClouds();
  showOverlay('Tap to flap', 'Collect strawberries, skim the sprinkle trails, and avoid the cutlery. The cake believes in you.', 'Start baking');
  frame();
})();
