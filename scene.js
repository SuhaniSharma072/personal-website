// Halftone night scene: dotted crescent moon, twinkling stars, rolling dot hills.
// Colors come from your CSS variables, so it follows light/dark mode automatically.
(() => {
  const scene = document.querySelector('.night-scene');
  if (!scene) return;

  const canvas = scene.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const still = document.createElement('canvas'); // pre-rendered moon + hills
  const sctx = still.getContext('2d');

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const dark = matchMedia('(prefers-color-scheme: dark)');

  const GAP = 7; // spacing of the halftone grid, in px
  let W = 0, H = 0, dpr = 1, moon, stars = [], colors = {}, visible = true, raf = 0;

  // Seeded random so the scene looks identical on every load
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  function readColors() {
    const s = getComputedStyle(document.documentElement);
    colors.accent = s.getPropertyValue('--accent').trim();
    colors.muted = s.getPropertyValue('--muted').trim();
  }

  // Ridge line for hill layer L (0 = far, 2 = near)
  function ridge(x, L) {
    const f = x / W;
    const base = [0.44, 0.6, 0.76][L] * H;
    const amp = [0.15, 0.12, 0.08][L] * H;
    return base - amp * (
      Math.sin(f * 7.1 + L * 1.7) * 0.55 +
      Math.sin(f * 15.3 + L * 3.1) * 0.3 +
      Math.sin(f * 31 + L) * 0.15
    );
  }

  function dot(c, x, y, r, color, a) {
    c.globalAlpha = a;
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }

  function drawMoon(c) {
    const { x: cx, y: cy, r } = moon;
    // The shadow disc that carves the crescent
    const sx = cx - r * 0.5, sy = cy - r * 0.15, sr = r * 0.95;

    c.save();
    // Clip to the sky so the moon tucks behind the far hills
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(W, 0);
    for (let x = W; x >= 0; x -= 4) c.lineTo(x, ridge(x, 0));
    c.closePath();
    c.clip();

    const g = 3.2;
    for (let y = cy - r; y <= cy + r; y += g) {
      for (let x = cx - r; x <= cx + r; x += g) {
        if (Math.hypot(x - cx, y - cy) > r - 0.8) continue;
        const lit = Math.min(1, Math.max(0, (Math.hypot(x - sx, y - sy) - sr) / (r * 0.35) + 0.15));
        dot(c, x, y, 0.35 + lit * 1.15, colors.accent, 0.18 + lit * 0.82);
      }
    }

    c.globalAlpha = 0.45;
    c.strokeStyle = colors.accent;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  function drawHills(c) {
    const maxR = [1.5, 2.3, 3.1];
    const alpha = [0.4, 0.65, 1];
    for (let row = 0, y = GAP / 2; y < H + GAP; row++, y += GAP) {
      const offset = row % 2 ? GAP / 2 : 0; // staggered rows, like print halftone
      for (let x = offset; x < W + GAP; x += GAP) {
        for (let L = 2; L >= 0; L--) {
          const top = ridge(x, L);
          if (y < top) continue;
          const depth = Math.min(1, (y - top) / Math.max(1, H - top));
          const r = maxR[L] * (0.2 + 0.8 * Math.pow(depth, 0.7)) * (0.85 + rand() * 0.3);
          dot(c, x, y, Math.min(r, GAP / 2 - 0.2), colors.accent, alpha[L]);
          break;
        }
      }
    }
  }

  function makeStars() {
    stars = [];
    const n = Math.round(W / 16);
    for (let tries = 0; stars.length < n && tries < n * 30; tries++) {
      const x = rand() * W, y = rand() * H * 0.55;
      if (y > ridge(x, 0) - 8) continue;
      if (Math.hypot(x - moon.x, y - moon.y) < moon.r + 10) continue;
      const big = rand() < 0.12; // a few bright four-point sparkles
      stars.push({
        x, y, big,
        r: big ? 4 + rand() * 3 : 2 + rand() * 1.8,
        spin: rand() * Math.PI * 2,
        phase: rand() * Math.PI * 2,
        speed: 0.5 + rand() * 1.4,
      });
    }
  }

  // Classic five-point star
  function star5(c, x, y, r, rot, color, a) {
    c.globalAlpha = a;
    c.fillStyle = color;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? r * 0.45 : r;
      const ang = rot + (i * Math.PI) / 5 - Math.PI / 2;
      c.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
    }
    c.closePath();
    c.fill();
  }

  // Four-point sparkle: two thin diamonds crossed, with a dot in the middle
  function sparkle(c, x, y, r, color, a) {
    c.globalAlpha = a;
    c.fillStyle = color;
    const w = r * 0.22;
    c.beginPath();
    c.moveTo(x, y - r); c.lineTo(x + w, y); c.lineTo(x, y + r); c.lineTo(x - w, y); c.closePath();
    c.moveTo(x - r, y); c.lineTo(x, y + w); c.lineTo(x + r, y); c.lineTo(x, y - w); c.closePath();
    c.fill();
    dot(c, x, y, w * 1.3, color, a);
  }

  function frame(t = 0) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.drawImage(still, 0, 0, W, H);
    for (const s of stars) {
      const tw = reduce.matches ? 0.8 : 0.5 + 0.5 * Math.sin((t / 1000) * s.speed + s.phase);
      if (s.big) {
        sparkle(ctx, s.x, s.y, s.r * (0.75 + 0.25 * tw), colors.accent, 0.45 + 0.55 * tw);
      } else {
        star5(ctx, s.x, s.y, s.r, s.spin * 0.15, colors.accent, 0.35 + 0.65 * tw);
      }
    }
    if (!reduce.matches && visible) raf = requestAnimationFrame(frame);
  }

  function build() {
    cancelAnimationFrame(raf);
    readColors();
    W = scene.clientWidth;
    H = scene.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [canvas, still]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    seed = 7;
    moon = { x: W * (W < 600 ? 0.74 : 0.8), y: H * 0.2, r: Math.max(18, Math.min(H * 0.13, 38)) };
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.clearRect(0, 0, W, H);
    drawMoon(sctx);
    drawHills(sctx);
    makeStars();
    frame(performance.now());
  }

  // Only animate while the scene is on screen
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    cancelAnimationFrame(raf);
    if (visible && W) frame(performance.now());
  }).observe(scene);

  new ResizeObserver(build).observe(scene);
  dark.addEventListener('change', build);
  reduce.addEventListener('change', build);
})();