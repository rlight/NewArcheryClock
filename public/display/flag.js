// Full-screen waving U.S. flag, shown while the national anthem plays.
// The flag is drawn flat once (official proportions: 1.9 : 1, 13 stripes, canton 7 stripes tall
// and 0.76 hoist wide, 50 stars in 9 staggered rows), then every frame it is redrawn in thin
// vertical strips, each shifted and shaded by a travelling wave so the cloth looks like it ripples.

const RED = '#B31942', WHITE = '#FFFFFF', BLUE = '#0A3161';

function drawFlat(w) {
  const h = Math.round(w / 1.9);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const stripe = h / 13;
  for (let i = 0; i < 13; i++) {
    g.fillStyle = i % 2 ? WHITE : RED;
    g.fillRect(0, Math.floor(i * stripe), w, Math.ceil(stripe) + 1);
  }
  const cw = w * 0.76 / 1.9, ch = stripe * 7;
  g.fillStyle = BLUE;
  g.fillRect(0, 0, cw, ch);
  // 50 stars: 9 rows alternating 6 and 5, on an 11 x 9 grid (spacing E = cw/12, F = ch/10)
  const E = cw / 12, F = ch / 10, r = (h * 0.0616) / 2;
  g.fillStyle = WHITE;
  for (let row = 0; row < 9; row++) {
    const n = row % 2 ? 5 : 6;
    for (let k = 0; k < n; k++) star(g, E * (2 * k + 1 + (row % 2)), F * (row + 1), r);
  }
  return c;
}

function star(g, cx, cy, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.382 : r;
    g.lineTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
  }
  g.closePath();
  g.fill();
}

export function createFlag(container) {
  const canvas = document.createElement('canvas');
  canvas.className = 'flag-canvas';
  container.appendChild(canvas);
  const g = canvas.getContext('2d');
  let flat = null, raf = 0, running = false, t0 = 0;

  function size() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(container.clientWidth * dpr);
    canvas.height = Math.round(container.clientHeight * dpr);
    // flag fills ~88 % of the width, or of the height if that limits
    const fw = Math.min(canvas.width * 0.88, canvas.height * 0.8 * 1.9);
    flat = drawFlat(Math.round(fw));
  }

  function frame(now) {
    if (!running) return;
    const t = (now - t0) / 1000;
    const W = canvas.width, H = canvas.height;
    g.fillStyle = '#05070c';
    g.fillRect(0, 0, W, H);
    const fw = flat.width, fh = flat.height;
    const x0 = (W - fw) / 2, y0 = (H - fh) / 2;
    const amp = fh * 0.065;          // wave height
    const strip = Math.max(2, Math.round(fw / 240));
    for (let x = 0; x < fw; x += strip) {
      const u = x / fw;                                  // 0 at the hoist, 1 at the fly end
      const k = u * u * 0.8 + u * 0.2;                   // pinned at the hoist, free at the fly
      const ph = u * 9 - t * 3.2;
      const dy = Math.sin(ph) * amp * k + Math.sin(ph * 0.53 + 1.3) * amp * 0.45 * k;
      const slope = Math.cos(ph) * k;                    // light and shadow from the fold angle
      const sw = Math.min(strip, fw - x);
      g.drawImage(flat, x, 0, sw, fh, x0 + x, y0 + dy, sw + 0.6, fh);
      const shade = slope * 0.4;
      if (shade > 0) g.fillStyle = `rgba(255,255,255,${(shade * 0.55).toFixed(3)})`;
      else g.fillStyle = `rgba(0,0,0,${(-shade).toFixed(3)})`;
      g.fillRect(x0 + x, y0 + dy, sw + 0.6, fh);
    }
    raf = requestAnimationFrame(frame);
  }

  const ro = new ResizeObserver(() => { if (running) size(); });
  ro.observe(container);

  return {
    start() {
      if (running) return;
      running = true; t0 = performance.now();
      size();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
