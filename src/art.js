// Original placeholder pictures drawn as SVG. No photos from the original site are used.

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const uri = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

function wrap(w, h, defs, body) {
  return uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"><defs><filter id="b"><feGaussianBlur stdDeviation="14"/></filter><filter id="s"><feGaussianBlur stdDeviation="3"/></filter><pattern id="w" width="9" height="13" patternUnits="userSpaceOnUse"><rect width="9" height="13" fill="none"/><rect x="1.5" y="2" width="5" height="7" fill="#ffd9a0" opacity=".32"/></pattern>${defs}</defs>${body}</svg>`);
}

function sky(id, stops) {
  const parts = stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${parts}</linearGradient>`;
}

function clouds(r, w, y0, y1, color, n = 10) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = y0 + r() * (y1 - y0);
    out += `<ellipse cx="${x | 0}" cy="${y | 0}" rx="${(60 + r() * 150) | 0}" ry="${(8 + r() * 22) | 0}" fill="${color}" opacity="${(0.3 + r() * 0.5).toFixed(2)}" filter="url(#b)"/>`;
  }
  return out;
}

function towers(r, w, base, minH, maxH, color, count, windows = true) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const bw = 26 + r() * 52;
    const x = r() * (w + 40) - 20;
    const h = minH + Math.pow(r(), 2) * (maxH - minH);
    out += `<rect x="${x | 0}" y="${(base - h) | 0}" width="${bw | 0}" height="${h | 0}" fill="${color}"/>`;
    if (windows) out += `<rect x="${x | 0}" y="${(base - h) | 0}" width="${bw | 0}" height="${h | 0}" fill="url(#w)" opacity="${(0.25 + r() * 0.6).toFixed(2)}"/>`;
  }
  return out;
}

const cache = new Map();
function memo(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

export function modeArt(kind) {
  return memo(`mode-${kind}`, () => {
    const W = 800;
    const H = 1000;
    if (kind === 'future') {
      const r = rng(11);
      return wrap(W, H, sky('g', [[0, '#babcc9'], [0.1, '#e3cebc'], [0.17, '#e7b79a'], [0.23, '#888897'], [0.3, '#4e5d6f'], [0.36, '#4c5763'], [0.6, '#2c3440'], [1, '#0b0d10']]),
        `<rect width="${W}" height="${H}" fill="url(#g)"/>${clouds(r, W, 120, 340, '#f6c4a3', 12)}${towers(r, W, 620, 70, 200, '#47505e', 30)}${towers(r, W, 720, 100, 300, '#2c3440', 16)}<rect x="350" y="170" width="120" height="560" fill="#27415f"/><rect x="350" y="170" width="120" height="560" fill="url(#w)" opacity=".5"/><polygon points="350,170 410,110 470,170" fill="#31507a"/>${towers(r, W, 860, 200, 470, '#181c22', 8)}<ellipse cx="400" cy="900" rx="520" ry="140" fill="#0a2013" opacity=".85" filter="url(#s)"/><rect y="880" width="${W}" height="120" fill="#07090b"/>`);
    }
    if (kind === 'land') {
      const r = rng(23);
      let trees = '';
      for (let i = 0; i < 90; i++) {
        trees += `<circle cx="${(r() * W) | 0}" cy="${(590 + r() * 330) | 0}" r="${(12 + r() * 26) | 0}" fill="${['#254a25', '#2f5a2c', '#1d3d20', '#3b6b34'][(r() * 4) | 0]}"/>`;
      }
      return wrap(W, H, sky('g', [[0, '#94caf8'], [0.1, '#c7e0f6'], [0.17, '#e8e5e0'], [0.23, '#edd2b5'], [0.3, '#8e7c6c'], [0.36, '#6d6b5b'], [0.6, '#3b4a33'], [1, '#0a120c']]),
        `<rect width="${W}" height="${H}" fill="url(#g)"/>${clouds(r, W, 100, 330, '#ffffff', 11)}<path d="M0 500 Q160 420 330 480 T640 460 T800 490 V640 H0Z" fill="#5a6d68"/><path d="M0 560 Q220 490 420 560 T800 540 V700 H0Z" fill="#3c5a3a"/><path d="M500 610 Q610 580 660 600 T560 660 T430 720 Q470 650 500 610Z" fill="#bfd6dd"/>${trees}<polygon points="250,690 610,640 720,740 300,790" fill="#22262b"/><rect x="310" y="780" width="370" height="150" fill="#6d5140"/><rect x="340" y="800" width="90" height="110" fill="#d9b27a" opacity=".8"/><rect x="460" y="800" width="150" height="80" fill="#26323a"/><rect y="900" width="${W}" height="100" fill="#070a08" opacity=".8"/>`);
    }
    const r = rng(37);
    return wrap(W, H, sky('g', [[0, '#727a91'], [0.1, '#7e7f8f'], [0.17, '#95898a'], [0.23, '#af9b90'], [0.3, '#ad8164'], [0.36, '#564c4d'], [0.6, '#2a2626'], [1, '#090a0c']]),
      `<rect width="${W}" height="${H}" fill="url(#g)"/>${clouds(r, W, 90, 340, '#d9b6a0', 13)}${towers(r, W, 590, 60, 180, '#2b3140', 26)}<rect x="130" y="290" width="48" height="300" fill="#1f2531"/><rect x="130" y="290" width="48" height="300" fill="url(#w)" opacity=".6"/><rect x="600" y="340" width="56" height="250" fill="#1f2531"/><rect x="600" y="340" width="56" height="250" fill="url(#w)" opacity=".6"/><rect y="590" width="${W}" height="110" fill="#222a33"/><rect y="600" width="${W}" height="8" fill="#d8a36f" opacity=".4"/>${towers(r, W, 860, 80, 230, '#20252e', 12)}<polygon points="360,640 800,560 800,600 390,680" fill="#3a3027"/><rect x="760" y="600" width="40" height="400" fill="#191612"/>`);
  });
}

export function modeArtWide(kind) {
  return memo(`mode-wide-${kind}`, () => {
    const W = 900;
    const H = 440;
    const r = rng(kind.length * 53 + 9);
    if (kind === 'future') {
      return wrap(W, H, sky('g', [[0, '#d4c1b9'], [0.18, '#9b8c91'], [0.3, '#6a6b77'], [0.43, '#696d71'], [0.55, '#737a78'], [0.67, '#676a64'], [1, '#111111']]),
        `<rect width="${W}" height="${H}" fill="url(#g)"/>${towers(r, W, 300, 30, 110, '#4d5560', 40)}${towers(r, W, 440, 80, 210, '#2f3640', 16)}<rect x="500" y="0" width="70" height="440" fill="#31507a"/><rect x="500" y="0" width="70" height="440" fill="url(#w)" opacity=".5"/>`);
    }
    if (kind === 'land') {
      let trees = '';
      for (let i = 0; i < 70; i++) trees += `<circle cx="${(r() * W) | 0}" cy="${(190 + r() * 250) | 0}" r="${(10 + r() * 22) | 0}" fill="${['#2a4a2a', '#34562e', '#1f3d22'][(r() * 3) | 0]}"/>`;
      return wrap(W, H, sky('g', [[0, '#bdd7ed'], [0.18, '#cdc7be'], [0.3, '#857c6e'], [0.43, '#686a55'], [0.55, '#82826b'], [0.67, '#6e6a53'], [1, '#111111']]),
        `<rect width="${W}" height="${H}" fill="url(#g)"/><path d="M0 130 Q220 80 460 130 T900 110 V220 H0Z" fill="#59604f"/>${trees}<polygon points="520,250 760,220 840,300 560,330" fill="#22262b"/><rect x="570" y="320" width="250" height="120" fill="#6d5140"/>`);
    }
    return wrap(W, H, sky('g', [[0, '#81746f'], [0.4, '#a89184'], [0.67, '#a08978'], [1, '#1a1716']]),
      `<rect width="${W}" height="${H}" fill="url(#g)"/>${towers(r, W, 300, 40, 150, '#3b3a44', 30)}<rect y="300" width="${W}" height="140" fill="#2a2a30"/>${towers(r, W, 440, 40, 120, '#26262c', 14)}`);
  });
}

export function skyArt() {
  return memo('sky', () => {
    const r = rng(77);
    return wrap(1000, 300, sky('g', [[0, '#5e87a6'], [1, '#86b4d0']]), `<rect width="1000" height="300" fill="url(#g)"/>${clouds(r, 1000, 40, 280, '#ffffff', 9)}`);
  });
}

export function areaArt(kind) {
  return memo(`area-${kind}`, () => {
    const W = 600;
    const H = 1000;
    const r = rng(kind.length * 97 + 5);
    if (kind === 'bangkok') {
      return wrap(W, H, sky('g', [[0, '#7a5a92'], [0.25, '#b0688f'], [0.42, '#5a5a8a'], [0.6, '#262a40'], [1, '#08090d']]),
        `<rect width="${W}" height="${H}" fill="url(#g)"/>${clouds(r, W, 180, 470, '#3b3a5f', 13)}${towers(r, W, 800, 110, 420, '#232640', 18)}<rect x="330" y="560" width="110" height="260" fill="#8d5a3e"/><rect y="800" width="${W}" height="200" fill="#07080b"/>`);
    }
    if (kind === 'eec') {
      let trees = '';
      for (let i = 0; i < 60; i++) trees += `<circle cx="${(r() * W) | 0}" cy="${(580 + r() * 330) | 0}" r="${(14 + r() * 30) | 0}" fill="${['#2f6135', '#3f7a3f', '#26502d'][(r() * 3) | 0]}"/>`;
      return wrap(W, H, sky('g', [[0, '#7fa2bf'], [0.3, '#c9dde6'], [0.45, '#7ca6b8'], [0.55, '#2f6c86'], [1, '#07090a']]),
        `<rect width="${W}" height="${H}" fill="url(#g)"/>${clouds(r, W, 180, 400, '#ffffff', 11)}<rect y="470" width="${W}" height="90" fill="#1f6c8a"/>${trees}<rect y="880" width="${W}" height="120" fill="#060807" opacity=".8"/>`);
    }
    if (kind === 'phuket') {
      let leaves = '';
      for (let i = 0; i < 28; i++) leaves += `<ellipse cx="${(280 + r() * 330) | 0}" cy="${(r() * 170) | 0}" rx="${(30 + r() * 60) | 0}" ry="${(10 + r() * 24) | 0}" fill="#31682b" transform="rotate(${(r() * 90) | 0} 400 80)"/>`;
      return wrap(W, H, sky('g', [[0, '#2d6fb0'], [0.3, '#6ea6d6'], [0.46, '#cfe2ee'], [0.5, '#1f8fa3'], [0.68, '#116b78'], [1, '#050708']]),
        `<rect width="${W}" height="${H}" fill="url(#g)"/>${clouds(r, W, 150, 400, '#ffffff', 9)}<path d="M0 500 Q130 400 300 500 Z" fill="#2c5b3a"/><path d="M0 800 Q280 700 600 830 V1000 H0Z" fill="#0e1c12"/>${leaves}`);
    }
    let temple = '';
    for (let i = 0; i < 5; i++) temple += `<polygon points="${60 + i * 90},800 ${100 + i * 90},${540 + (i % 2) * 90} ${140 + i * 90},800" fill="#7d4f35"/>`;
    return wrap(W, H, sky('g', [[0, '#8297a8'], [0.45, '#a9b6bd'], [0.62, '#5a5f60'], [1, '#08090a']]),
      `<rect width="${W}" height="${H}" fill="url(#g)"/>${clouds(r, W, 120, 460, '#c6d0d5', 9)}${temple}<rect y="800" width="${W}" height="200" fill="#121416"/>`);
  });
}

export function listingArt(seed, grid) {
  // A soft colour wash used as a neutral placeholder picture.
  return memo(`listing-${seed}`, () => {
    const cellW = 800 / grid[0].length;
    const cellH = 600 / grid.length;
    let cells = '';
    grid.forEach((row, y) => row.forEach((color, x) => {
      cells += `<rect x="${x * cellW - 40}" y="${y * cellH - 40}" width="${cellW + 80}" height="${cellH + 80}" fill="${color}"/>`;
    }));
    return wrap(800, 600, '<filter id="wash"><feGaussianBlur stdDeviation="42"/></filter>', `<rect width="800" height="600" fill="${grid[1][1]}"/><g filter="url(#wash)">${cells}</g>`);
  });
}

export function portraitArt(kind) {
  return memo(`portrait-${kind}`, () => {
    const dark = kind === 'a';
    const bg = dark ? sky('g', [[0, '#d9d9d9'], [0.6, '#7a7a7a'], [1, '#3e3e3e']]) : sky('g', [[0, '#9fb0ad'], [1, '#6f7f7c']]);
    const body = dark ? '#262626' : '#f1efe9';
    const skin = dark ? '#9a9a9a' : '#d9b49c';
    const hair = dark ? '#161616' : '#2a1d17';
    return wrap(800, 600, bg, `<rect width="800" height="600" fill="url(#g)"/><path d="M180 600 Q200 400 400 370 Q600 400 620 600Z" fill="${body}"/><rect x="360" y="280" width="80" height="110" fill="${skin}"/><ellipse cx="400" cy="210" rx="92" ry="115" fill="${skin}"/><path d="M305 190 Q320 70 410 80 Q500 90 495 190 Q480 130 400 130 Q330 130 305 190Z" fill="${hair}"/>`);
  });
}
