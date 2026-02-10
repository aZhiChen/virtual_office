/**
 * Tile Registry & Tileset / Furniture Sprite Generator
 *
 * ─── Tileset Spec ─────────────────────────────────────────
 *   Tile size : 32 × 32 px
 *   Format    : horizontal strip (width = 32 × TOTAL_TILES, height = 32)
 *   Light     : top-left → highlights on top/left edges, shadows bottom/right
 *   Outline   : 1 px dark on bottom-right of raised surfaces
 *   Palette   : warm wood / cool blue / soft green / dark stone
 *
 * ─── Tile Index Map ───────────────────────────────────────
 *  #   Constant       Layer  Description
 *  ──  ──────────     ─────  ───────────
 *   0  WOOD_A         floor  Office wood plank – light grain
 *   1  WOOD_B         floor  Office wood plank – medium grain
 *   2  WOOD_C         floor  Office wood plank – with knot
 *   3  CARPET_A       floor  Meeting room – plain weave
 *   4  CARPET_B       floor  Meeting room – diamond motif
 *   5  TILE_A         floor  Dining area – clean warm tile
 *   6  TILE_B         floor  Dining area – slightly worn
 *   7  RUBBER_A       floor  Game room – plain rubber
 *   8  RUBBER_B       floor  Game room – speckled
 *   9  GRASS_A        floor  Pet area – short grass
 *  10  GRASS_B        floor  Pet area – tall tufts
 *  11  GRASS_C        floor  Pet area – with tiny flowers
 *  12  WALL           wall   Wall face (stone-block texture)
 *  13  WALL_TOP       wall   Wall top edge (bright highlight)
 *  14  WALL_SIDE      wall   Wall side (vertical shadow)
 *  15  DOOR           floor  Door opening floor (transition)
 *  16  DIVIDER        wall   Glass room-divider strip
 *  17  FENCE_H        wall   Fence horizontal beam (transparent bg)
 *  18  FENCE_V        wall   Fence vertical beam (transparent bg)
 *  19  FENCE_POST     wall   Fence corner post (transparent bg)
 *  20  DECAL_CABLE    decal  Floor cable run
 *  21  DECAL_MAT      decal  Small entry mat
 *  22  DECAL_SCUFF    decal  Scuff / wear mark
 */

export const TILE_SIZE = 32;

/* ── Tile index constants ─────────────────────────────────── */

export const T = {
  WOOD_A: 0,
  WOOD_B: 1,
  WOOD_C: 2,
  CARPET_A: 3,
  CARPET_B: 4,
  TILE_A: 5,
  TILE_B: 6,
  RUBBER_A: 7,
  RUBBER_B: 8,
  GRASS_A: 9,
  GRASS_B: 10,
  GRASS_C: 11,
  WALL: 12,
  WALL_TOP: 13,
  WALL_SIDE: 14,
  DOOR: 15,
  DIVIDER: 16,
  FENCE_H: 17,
  FENCE_V: 18,
  FENCE_POST: 19,
  DECAL_CABLE: 20,
  DECAL_MAT: 21,
  DECAL_SCUFF: 22,
} as const;

export const TOTAL_TILES = 23;

/* ── Helpers ──────────────────────────────────────────────── */

const S = TILE_SIZE;

type RGB = [number, number, number];

function rgb(r: number, g: number, b: number): string {
  return `rgb(${r},${g},${b})`;
}

function shift(base: RGB, dr: number, dg: number, db: number): string {
  return rgb(
    Math.max(0, Math.min(255, base[0] + dr)),
    Math.max(0, Math.min(255, base[1] + dg)),
    Math.max(0, Math.min(255, base[2] + db)),
  );
}

/** Deterministic hash → [0, 1) */
function hash(a: number, b: number = 0): number {
  let h = ((a * 374761393 + b * 668265263) ^ 0x12345678) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0x100000000;
}

/* ── Tile painters ────────────────────────────────────────── */

function paintWood(ctx: CanvasRenderingContext2D, ox: number, v: number) {
  // Plain base for the office area floor
  const bases: RGB[] = [
    [139, 69, 19],   // 0 Brown
    [251, 206, 177], // 1 Apricot
  ];
  const b = bases[v] || bases[0];

  ctx.clearRect(ox, 0, S, S);
  ctx.fillStyle = rgb(...b);
  ctx.fillRect(ox, 0, S, S);
}

function paintCarpet(ctx: CanvasRenderingContext2D, ox: number, v: number) {
  const b: RGB = [155, 182, 212];

  ctx.fillStyle = rgb(...b);
  ctx.fillRect(ox, 0, S, S);

  if (v === 0) {
    // Woven dots
    ctx.fillStyle = shift(b, -5, -5, -3);
    for (let j = 0; j < S; j += 4)
      for (let i = 0; i < S; i += 4)
        ctx.fillRect(ox + i, j, 1, 1);
    ctx.fillStyle = shift(b, 5, 5, 3);
    for (let j = 2; j < S; j += 4)
      for (let i = 2; i < S; i += 4)
        ctx.fillRect(ox + i, j, 1, 1);
  }

  if (v === 1) {
    // Diamond motif
    ctx.fillStyle = shift(b, -8, -7, -4);
    for (let j = 0; j < S; j += 8) {
      for (let i = 0; i < S; i += 8) {
        ctx.fillRect(ox + i + 3, j, 2, 1);
        ctx.fillRect(ox + i + 2, j + 1, 1, 1);
        ctx.fillRect(ox + i + 5, j + 1, 1, 1);
        ctx.fillRect(ox + i + 1, j + 2, 1, 1);
        ctx.fillRect(ox + i + 6, j + 2, 1, 1);
        ctx.fillRect(ox + i + 0, j + 3, 1, 2);
        ctx.fillRect(ox + i + 7, j + 3, 1, 2);
        ctx.fillRect(ox + i + 1, j + 5, 1, 1);
        ctx.fillRect(ox + i + 6, j + 5, 1, 1);
        ctx.fillRect(ox + i + 2, j + 6, 1, 1);
        ctx.fillRect(ox + i + 5, j + 6, 1, 1);
        ctx.fillRect(ox + i + 3, j + 7, 2, 1);
      }
    }
  }

  // Noise
  for (let n = 0; n < 10; n++) {
    ctx.fillStyle = shift(b, 4, 4, 2);
    ctx.fillRect(ox + Math.floor(hash(v, n) * S), Math.floor(hash(v, n + 50) * S), 1, 1);
  }
}

function paintWarmTile(ctx: CanvasRenderingContext2D, ox: number, v: number) {
  const b: RGB = [232, 220, 185];

  ctx.fillStyle = rgb(...b);
  ctx.fillRect(ox, 0, S, S);

  // Grout grid
  ctx.fillStyle = shift(b, -28, -26, -22);
  ctx.fillRect(ox, 15, S, 2);
  ctx.fillRect(ox + 15, 0, 2, S);

  // Quadrant tint
  const offsets = [[0, 0], [17, 0], [0, 17], [17, 17]];
  for (let q = 0; q < 4; q++) {
    const s = Math.floor(hash(v, q) * 12) - 6;
    ctx.fillStyle = shift(b, s, s, s - 2);
    ctx.fillRect(ox + offsets[q][0] + 1, offsets[q][1] + 1, 13, 13);
  }

  // Worn patch
  if (v === 1) {
    ctx.fillStyle = shift(b, -10, -8, -6);
    ctx.fillRect(ox + Math.floor(hash(v, 80) * 18) + 3, Math.floor(hash(v, 81) * 18) + 3, 5, 4);
  }

  // Top-left highlight
  ctx.fillStyle = shift(b, 10, 8, 5);
  ctx.fillRect(ox, 0, S, 1);
  ctx.fillRect(ox, 0, 1, 15);
}

function paintRubber(ctx: CanvasRenderingContext2D, ox: number, v: number) {
  const b: RGB = [158, 212, 168];

  ctx.fillStyle = rgb(...b);
  ctx.fillRect(ox, 0, S, S);

  // Grid
  ctx.fillStyle = shift(b, -8, -8, -6);
  for (let i = 8; i < S; i += 8) {
    ctx.fillRect(ox, i, S, 1);
    ctx.fillRect(ox + i, 0, 1, S);
  }

  if (v === 1) {
    for (let n = 0; n < 18; n++) {
      const d = hash(1, n) > 0.5 ? -10 : 8;
      ctx.fillStyle = shift(b, d, d, d);
      ctx.fillRect(ox + Math.floor(hash(1, n + 30) * S), Math.floor(hash(1, n + 60) * S), 1, 1);
    }
  }
}

function paintGrass(ctx: CanvasRenderingContext2D, ox: number, v: number) {
  const b: RGB = [138, 198, 128];

  ctx.fillStyle = rgb(...b);
  ctx.fillRect(ox, 0, S, S);

  // Patches
  for (let n = 0; n < 6; n++) {
    const d = Math.floor(hash(v, n + 40) * 16) - 8;
    ctx.fillStyle = shift(b, d - 4, d, d - 6);
    ctx.fillRect(ox + Math.floor(hash(v, n) * 26), Math.floor(hash(v, n + 20) * 26), 5, 5);
  }

  // Blades
  ctx.fillStyle = shift(b, -12, 12, -18);
  const cnt = v === 1 ? 16 : 10;
  for (let n = 0; n < cnt; n++) {
    const bx = Math.floor(hash(v, n + 100) * 30);
    const by = Math.floor(hash(v, n + 130) * 28);
    const bh = v === 1 ? 4 : 2;
    ctx.fillRect(ox + bx, by, 1, bh);
    ctx.fillRect(ox + bx + 1, by + 1, 1, Math.max(1, bh - 1));
  }

  // Flowers (variant 2)
  if (v === 2) {
    const colors: RGB[] = [[255, 200, 200], [255, 255, 150], [200, 200, 255]];
    for (let f = 0; f < 3; f++) {
      const fx = Math.floor(hash(2, f + 200) * 26) + 2;
      const fy = Math.floor(hash(2, f + 210) * 26) + 2;
      ctx.fillStyle = rgb(...colors[f]);
      ctx.fillRect(ox + fx, fy, 2, 2);
      ctx.fillStyle = rgb(255, 220, 50);
      ctx.fillRect(ox + fx, fy, 1, 1);
    }
  }

  // Dark tufts (variant 1)
  if (v === 1) {
    ctx.fillStyle = shift(b, -20, -5, -25);
    for (let n = 0; n < 5; n++)
      ctx.fillRect(ox + Math.floor(hash(1, n + 150) * 28), Math.floor(hash(1, n + 160) * 28), 2, 3);
  }
}

function paintWall(ctx: CanvasRenderingContext2D, ox: number, v: number) {
  const b: RGB = [58, 58, 92];

  ctx.fillStyle = rgb(...b);
  ctx.fillRect(ox, 0, S, S);

  if (v === 0) {
    // Stone-block mortar
    ctx.fillStyle = shift(b, 10, 10, 14);
    for (let row = 0; row < 4; row++) {
      ctx.fillRect(ox, row * 8, S, 1);
      const off = row % 2 === 0 ? 0 : 16;
      for (let c = off; c < S; c += 16) ctx.fillRect(ox + c, row * 8, 1, 8);
    }
    // Block shade
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 2; col++) {
        const bx = (row % 2 === 0 ? 0 : 16) + col * 16;
        if (bx >= S) continue;
        const d = Math.floor(hash(row, col) * 8) - 4;
        ctx.fillStyle = shift(b, d, d, d + 2);
        ctx.fillRect(ox + bx + 1, row * 8 + 1, Math.min(15, S - bx - 1), 7);
      }
    }
    ctx.fillStyle = shift(b, -14, -14, -10);
    ctx.fillRect(ox, S - 2, S, 2);
    ctx.fillStyle = shift(b, 8, 8, 10);
    ctx.fillRect(ox, 0, S, 1);
  }

  if (v === 1) {
    ctx.fillStyle = shift(b, 22, 22, 28);
    ctx.fillRect(ox, 0, S, S);
    ctx.fillStyle = shift(b, 32, 32, 38);
    ctx.fillRect(ox, 0, S, 2);
    ctx.fillStyle = shift(b, -8, -8, -6);
    ctx.fillRect(ox, S - 1, S, 1);
  }

  if (v === 2) {
    ctx.fillStyle = shift(b, -6, -6, -4);
    ctx.fillRect(ox, 0, S, S);
    ctx.fillStyle = shift(b, -16, -16, -10);
    ctx.fillRect(ox + S - 3, 0, 3, S);
    ctx.fillStyle = shift(b, 6, 6, 10);
    for (let row = 0; row < 4; row++) ctx.fillRect(ox, row * 8, S, 1);
  }
}

function paintDoor(ctx: CanvasRenderingContext2D, ox: number) {
  const b: RGB = [200, 175, 140];
  ctx.fillStyle = rgb(...b);
  ctx.fillRect(ox, 0, S, S);
  ctx.fillStyle = shift(b, -28, -28, -22);
  ctx.fillRect(ox, 0, S, 2);
  ctx.fillRect(ox, S - 2, S, 2);
  ctx.fillStyle = shift(b, 8, 6, 4);
  ctx.fillRect(ox + 2, 3, S - 4, S - 6);
  ctx.fillStyle = shift(b, -6, -6, -4);
  ctx.fillRect(ox + 10, 12, 12, 8);
}

function paintDivider(ctx: CanvasRenderingContext2D, ox: number) {
  const b: RGB = [78, 78, 112];
  ctx.fillStyle = rgb(...b);
  ctx.fillRect(ox, 0, S, S);
  ctx.fillStyle = shift(b, 18, 18, 24);
  ctx.fillRect(ox + 3, 2, S - 6, S - 4);
  ctx.fillStyle = shift(b, 35, 35, 42);
  ctx.fillRect(ox + 7, 4, 2, S - 8);
  ctx.fillStyle = shift(b, -12, -12, -8);
  ctx.fillRect(ox, 0, S, 2);
  ctx.fillRect(ox, S - 2, S, 2);
  ctx.fillRect(ox, 0, 3, S);
  ctx.fillRect(ox + S - 3, 0, 3, S);
}

function paintFence(ctx: CanvasRenderingContext2D, ox: number, v: number) {
  const w: RGB = [139, 105, 20];
  ctx.clearRect(ox, 0, S, S);

  if (v === 0) {
    ctx.fillStyle = rgb(...w);
    ctx.fillRect(ox, 10, S, 5);
    ctx.fillRect(ox, 20, S, 5);
    ctx.fillStyle = shift(w, 22, 18, 10);
    ctx.fillRect(ox, 10, S, 1);
    ctx.fillRect(ox, 20, S, 1);
    ctx.fillStyle = shift(w, -18, -16, -12);
    ctx.fillRect(ox, 14, S, 1);
    ctx.fillRect(ox, 24, S, 1);
  }
  if (v === 1) {
    ctx.fillStyle = rgb(...w);
    ctx.fillRect(ox + 12, 0, 8, S);
    ctx.fillStyle = shift(w, 22, 18, 10);
    ctx.fillRect(ox + 12, 0, 1, S);
    ctx.fillStyle = shift(w, -18, -16, -12);
    ctx.fillRect(ox + 19, 0, 1, S);
  }
  if (v === 2) {
    ctx.fillStyle = rgb(...w);
    ctx.fillRect(ox + 10, 8, 12, 16);
    ctx.fillStyle = shift(w, 28, 22, 12);
    ctx.fillRect(ox + 10, 8, 12, 2);
    ctx.fillRect(ox + 10, 8, 2, 16);
    ctx.fillStyle = shift(w, -22, -18, -14);
    ctx.fillRect(ox + 10, 22, 12, 2);
    ctx.fillRect(ox + 20, 8, 2, 16);
  }
}

function paintDecalCable(ctx: CanvasRenderingContext2D, ox: number) {
  ctx.clearRect(ox, 0, S, S);
  ctx.fillStyle = "#383838";
  ctx.fillRect(ox, 14, 8, 2);
  ctx.fillRect(ox + 7, 13, 4, 2);
  ctx.fillRect(ox + 10, 14, 8, 2);
  ctx.fillRect(ox + 17, 15, 4, 2);
  ctx.fillRect(ox + 20, 14, 8, 2);
  ctx.fillRect(ox + 27, 13, 5, 2);
  ctx.fillStyle = "#555";
  ctx.fillRect(ox + 30, 12, 2, 6);
}

function paintDecalMat(ctx: CanvasRenderingContext2D, ox: number) {
  ctx.clearRect(ox, 0, S, S);
  const m: RGB = [140, 100, 80];
  ctx.fillStyle = rgb(...m);
  ctx.fillRect(ox + 4, 10, 24, 12);
  ctx.fillStyle = shift(m, -18, -16, -14);
  ctx.fillRect(ox + 4, 10, 24, 1);
  ctx.fillRect(ox + 4, 21, 24, 1);
  ctx.fillRect(ox + 4, 10, 1, 12);
  ctx.fillRect(ox + 27, 10, 1, 12);
  ctx.fillStyle = shift(m, 16, 12, 8);
  ctx.fillRect(ox + 8, 13, 16, 6);
}

function paintDecalScuff(ctx: CanvasRenderingContext2D, ox: number) {
  ctx.clearRect(ox, 0, S, S);
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = "#000";
  ctx.fillRect(ox + 8, 10, 16, 12);
  ctx.globalAlpha = 0.15;
  ctx.fillRect(ox + 12, 14, 8, 4);
  ctx.restore();
}

/* ── Public: generate full tileset canvas ─────────────────── */

export function generateTilesetCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = S * TOTAL_TILES;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  paintWood(ctx, T.WOOD_A * S, 0);
  paintWood(ctx, T.WOOD_B * S, 1);
  paintWood(ctx, T.WOOD_C * S, 2);
  paintCarpet(ctx, T.CARPET_A * S, 0);
  paintCarpet(ctx, T.CARPET_B * S, 1);
  paintWarmTile(ctx, T.TILE_A * S, 0);
  paintWarmTile(ctx, T.TILE_B * S, 1);
  paintRubber(ctx, T.RUBBER_A * S, 0);
  paintRubber(ctx, T.RUBBER_B * S, 1);
  paintGrass(ctx, T.GRASS_A * S, 0);
  paintGrass(ctx, T.GRASS_B * S, 1);
  paintGrass(ctx, T.GRASS_C * S, 2);
  paintWall(ctx, T.WALL * S, 0);
  paintWall(ctx, T.WALL_TOP * S, 1);
  paintWall(ctx, T.WALL_SIDE * S, 2);
  paintDoor(ctx, T.DOOR * S);
  paintDivider(ctx, T.DIVIDER * S);
  paintFence(ctx, T.FENCE_H * S, 0);
  paintFence(ctx, T.FENCE_V * S, 1);
  paintFence(ctx, T.FENCE_POST * S, 2);
  paintDecalCable(ctx, T.DECAL_CABLE * S);
  paintDecalMat(ctx, T.DECAL_MAT * S);
  paintDecalScuff(ctx, T.DECAL_SCUFF * S);

  return canvas;
}

/* ── Public: desk sprite canvas (64×32) ──────────────────── */

export function generateDeskCanvas(): HTMLCanvasElement {
  const w = S * 2;
  const h = S;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const wood: RGB = [160, 130, 90];
  // Surface
  ctx.fillStyle = rgb(...wood);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = shift(wood, -20, -18, -14);
  ctx.fillRect(0, h - 2, w, 2);
  ctx.fillRect(w - 1, 0, 1, h);
  ctx.fillStyle = shift(wood, 14, 12, 8);
  ctx.fillRect(0, 0, w, 1);
  ctx.fillRect(0, 0, 1, h);
  // Grain
  ctx.fillStyle = shift(wood, -6, -8, -4);
  for (let i = 0; i < 4; i++) {
    const gy = Math.floor(hash(0, i) * 26) + 2;
    ctx.fillRect(2, gy, w - 4, 1);
  }

  // Monitor
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(4, 2, 20, 16);
  ctx.fillStyle = "#4488ff";
  ctx.fillRect(6, 4, 16, 11);
  ctx.fillStyle = "#333";
  ctx.fillRect(12, 18, 4, 4);
  ctx.fillRect(10, 22, 8, 2);
  ctx.fillStyle = "#66aaff";
  ctx.fillRect(7, 5, 6, 2);

  // Laptop
  ctx.fillStyle = "#444";
  ctx.fillRect(36, 4, 20, 14);
  ctx.fillStyle = "#5599ee";
  ctx.fillRect(38, 6, 16, 10);
  ctx.fillStyle = "#555";
  ctx.fillRect(36, 18, 20, 4);
  ctx.fillStyle = "#77bbff";
  ctx.fillRect(39, 7, 6, 2);

  // Keyboard
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(26, 20, 8, 5);
  ctx.fillStyle = "#4a4a4a";
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      ctx.fillRect(27 + c * 2, 21 + r * 1, 1, 1);

  // Mouse
  ctx.fillStyle = "#333";
  ctx.fillRect(30, 12, 3, 5);
  ctx.fillRect(31, 11, 1, 1);

  return canvas;
}

/* ── Public: furniture sprite canvas ─────────────────────── */

export function generateFurnitureCanvas(
  type: string,
  widthPx: number,
  heightPx: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d")!;
  const w = widthPx;
  const h = heightPx;

  switch (type) {
    case "meeting_table": {
      const wd: RGB = [139, 94, 60];
      ctx.fillStyle = rgb(...wd);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = shift(wd, 14, 12, 8);
      ctx.fillRect(0, 0, w, 2);
      ctx.fillRect(0, 0, 2, h);
      ctx.fillStyle = shift(wd, -18, -16, -12);
      ctx.fillRect(0, h - 3, w, 3);
      ctx.fillRect(w - 2, 0, 2, h);
      ctx.fillStyle = shift(wd, -8, -8, -6);
      ctx.fillRect(Math.floor(w / 2) - 1, 4, 2, h - 8);
      ctx.fillStyle = shift(wd, -6, -6, -4);
      for (let i = 0; i < 6; i++) {
        const gy = Math.floor(hash(0, i) * (h - 4)) + 2;
        ctx.fillRect(4, gy, w - 8, 1);
      }
      // Rounded corner hint
      ctx.fillStyle = shift(wd, -24, -22, -18);
      ctx.fillRect(0, 0, 3, 3);
      ctx.fillRect(w - 3, 0, 3, 3);
      ctx.fillRect(0, h - 3, 3, 3);
      ctx.fillRect(w - 3, h - 3, 3, 3);
      break;
    }

    case "office_desk": {
      // Isometric Blue Desk
      const deskColor: RGB = [135, 206, 235]; // Sky Blue
      const sideColor: RGB = [93, 138, 168];  // Darker Blue
      const partitionColor: RGB = [224, 224, 224]; // Light Gray

      const hh = h * 0.4; // desk surface height offset

      // 1. Draw Front-Left Face
      ctx.fillStyle = rgb(...sideColor);
      ctx.beginPath();
      ctx.moveTo(0, hh + 10);
      ctx.lineTo(w * 0.5, hh + h * 0.3 + 10);
      ctx.lineTo(w * 0.5, h + 10);
      ctx.lineTo(0, h - h * 0.3 + 10);
      ctx.fill();

      // 2. Draw Front-Right Face
      ctx.fillStyle = shift(sideColor, -20, -20, -20);
      ctx.beginPath();
      ctx.moveTo(w, hh + 10);
      ctx.lineTo(w * 0.5, hh + h * 0.3 + 10);
      ctx.lineTo(w * 0.5, h + 10);
      ctx.lineTo(w, h - h * 0.3 + 10);
      ctx.fill();

      // 3. Draw Top Face (Diamond)
      ctx.fillStyle = rgb(...deskColor);
      ctx.beginPath();
      ctx.moveTo(w * 0.5, hh);
      ctx.lineTo(w, hh + h * 0.25);
      ctx.lineTo(w * 0.5, hh + h * 0.5);
      ctx.lineTo(0, hh + h * 0.25);
      ctx.closePath();
      ctx.fill();

      // 4. Back Partitions (Isometric vertical walls)
      ctx.fillStyle = rgb(...partitionColor);
      ctx.beginPath();
      ctx.moveTo(w * 0.5, hh);
      ctx.lineTo(w, hh + h * 0.25);
      ctx.lineTo(w, hh - 15);
      ctx.lineTo(w * 0.5, hh - 15 - h * 0.25);
      ctx.fill();

      ctx.fillStyle = shift(partitionColor, -20, -20, -20);
      ctx.beginPath();
      ctx.moveTo(w * 0.5, hh);
      ctx.lineTo(0, hh + h * 0.25);
      ctx.lineTo(0, hh - 15);
      ctx.lineTo(w * 0.5, hh - 15 - h * 0.25);
      ctx.fill();

      // 5. Devices in V-shape (Isometric tilted)
      ctx.fillStyle = "#333";
      // Screen 1 (left-angled)
      ctx.fillRect(w * 0.3, hh + 5, 8, 12);
      // Screen 2 (right-angled)
      ctx.fillRect(w * 0.6, hh + 5, 8, 12);

      break;
    }

    case "drawer_cabinet": {
      // Isometric Wooden Cabinet
      const woodColor: RGB = [210, 180, 140];
      const sideColor = shift(woodColor, -30, -30, -30);

      // Top
      ctx.fillStyle = rgb(...woodColor);
      ctx.beginPath();
      ctx.moveTo(w * 0.5, 0); ctx.lineTo(w, h * 0.3); ctx.lineTo(w * 0.5, h * 0.6); ctx.lineTo(0, h * 0.3);
      ctx.fill();

      // Side Left
      ctx.fillStyle = sideColor;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.3); ctx.lineTo(w * 0.5, h * 0.6); ctx.lineTo(w * 0.5, h); ctx.lineTo(0, h * 0.7);
      ctx.fill();

      // Side Right (Drawer front)
      ctx.fillStyle = shift(woodColor, -10, -10, -10);
      ctx.beginPath();
      ctx.moveTo(w, h * 0.3); ctx.lineTo(w * 0.5, h * 0.6); ctx.lineTo(w * 0.5, h); ctx.lineTo(w, h * 0.7);
      ctx.fill();

      // Drawer Lines
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        const yOff = i * (h * 0.13);
        ctx.beginPath();
        ctx.moveTo(w * 0.5, h * 0.6 + yOff); ctx.lineTo(w, h * 0.3 + yOff);
        ctx.stroke();
      }
      break;
    }

    case "office_chair": {
      // Isometric Chair
      ctx.fillStyle = "#444";
      // Wheels base
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.8, w * 0.3, h * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();

      // Seat
      ctx.fillStyle = "#555";
      ctx.beginPath();
      ctx.moveTo(w * 0.2, h * 0.5); ctx.lineTo(w * 0.8, h * 0.5); ctx.lineTo(w, h * 0.7); ctx.lineTo(w * 0.5, h * 0.8); ctx.lineTo(0, h * 0.7);
      ctx.fill();

      // Backrest
      ctx.fillStyle = "#333";
      ctx.beginPath();
      ctx.roundRect(w * 0.3, h * 0.1, w * 0.4, h * 0.4, 5);
      ctx.fill();
      break;
    }

    case "desk_barrier": {
      // Office desk barrier between workstations
      const barrierColor: RGB = [169, 169, 169]; // Dark gray
      ctx.fillStyle = rgb(...barrierColor);
      ctx.fillRect(0, 0, w, h);

      // Barrier posts
      ctx.fillStyle = shift(barrierColor, -30, -30, -30);
      ctx.fillRect(2, 2, 4, h - 4);
      ctx.fillRect(w - 6, 2, 4, h - 4);

      // Barrier top
      ctx.fillStyle = shift(barrierColor, 20, 20, 20);
      ctx.fillRect(0, 0, w, 3);

      break;
    }

    case "snacks": {
      ctx.fillStyle = "#e8c830";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#d0b020";
      ctx.fillRect(0, h - 2, w, 2);
      ctx.fillStyle = "#f0d840";
      ctx.fillRect(0, 0, w, 1);
      ctx.fillStyle = "#ff6347";
      ctx.fillRect(6, 6, 8, 10);
      ctx.fillStyle = "#90ee90";
      ctx.fillRect(18, 8, 6, 8);
      ctx.fillStyle = "#ffa500";
      ctx.fillRect(30, 6, 10, 10);
      ctx.fillStyle = "#ddd";
      ctx.fillRect(44, 6, 12, 12);
      ctx.fillStyle = "#bbb";
      ctx.fillRect(46, 8, 8, 8);
      ctx.fillStyle = "#333";
      ctx.font = "bold 7px monospace";
      ctx.fillText("Snacks", 12, h - 3);
      break;
    }

    case "ramen": {
      ctx.fillStyle = "#c87020";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#b06018";
      ctx.fillRect(0, h - 2, w, 2);
      ctx.fillStyle = "#d88030";
      ctx.fillRect(0, 0, w, 1);
      // Bowls
      ctx.fillStyle = "#fff";
      ctx.fillRect(6, 6, 14, 12);
      ctx.fillRect(8, 4, 10, 2);
      ctx.fillStyle = "#ffd700";
      ctx.fillRect(8, 8, 10, 8);
      ctx.fillStyle = "#fff";
      ctx.fillRect(34, 6, 14, 12);
      ctx.fillRect(36, 4, 10, 2);
      ctx.fillStyle = "#ffd700";
      ctx.fillRect(36, 8, 10, 8);
      // Chopsticks
      ctx.fillStyle = "#8b4513";
      ctx.fillRect(24, 4, 1, 18);
      ctx.fillRect(26, 4, 1, 18);
      ctx.fillStyle = "#333";
      ctx.font = "bold 7px monospace";
      ctx.fillText("Ramen", 12, h - 3);
      break;
    }

    case "coffee": {
      ctx.fillStyle = "#5a3e2b";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#4a2e1b";
      ctx.fillRect(0, h - 2, w, 2);
      ctx.fillStyle = "#6a4e3b";
      ctx.fillRect(0, 0, w, 1);
      // Machine
      ctx.fillStyle = "#333";
      ctx.fillRect(4, 2, 18, 20);
      ctx.fillStyle = "#666";
      ctx.fillRect(6, 4, 14, 10);
      ctx.fillStyle = "#f00";
      ctx.fillRect(12, 16, 3, 3);
      // Cups
      ctx.fillStyle = "#fff";
      ctx.fillRect(28, 10, 10, 12);
      ctx.fillStyle = "#8b5e3c";
      ctx.fillRect(30, 12, 6, 8);
      ctx.fillStyle = "#fff";
      ctx.fillRect(42, 10, 10, 12);
      ctx.fillStyle = "#8b5e3c";
      ctx.fillRect(44, 12, 6, 8);
      // Steam
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#fff";
      ctx.fillRect(32, 5, 1, 5);
      ctx.fillRect(46, 5, 1, 5);
      ctx.restore();
      ctx.fillStyle = "#ddd";
      ctx.font = "bold 7px monospace";
      ctx.fillText("Coffee", 12, h - 3);
      break;
    }

    case "billiard": {
      // Frame
      ctx.fillStyle = "#6b3e1c";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#8b5e3c";
      ctx.fillRect(0, 0, w, 4);
      ctx.fillRect(0, 0, 5, h);
      ctx.fillStyle = "#4b2e0c";
      ctx.fillRect(0, h - 5, w, 5);
      ctx.fillRect(w - 5, 0, 5, h);
      // Felt
      ctx.fillStyle = "#006400";
      ctx.fillRect(6, 5, w - 12, h - 11);
      // Center line
      ctx.fillStyle = "#007800";
      ctx.fillRect(Math.floor(w / 2) - 1, 8, 2, h - 17);
      // Pockets
      ctx.fillStyle = "#000";
      const pockets = [[8, 7], [w - 10, 7], [8, h - 9], [w - 10, h - 9], [Math.floor(w / 2) - 2, 7], [Math.floor(w / 2) - 2, h - 9]];
      for (const [px, py] of pockets) ctx.fillRect(px, py, 5, 5);
      // Balls
      const ballC = ["#fff", "#ff0", "#00f", "#f00", "#800080", "#ff8c00", "#0a0"];
      for (let i = 0; i < ballC.length; i++) {
        const bx = 20 + Math.floor(hash(0, i) * (w - 50));
        const by = 15 + Math.floor(hash(0, i + 10) * (h - 35));
        ctx.fillStyle = ballC[i];
        ctx.fillRect(bx, by, 4, 4);
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#fff";
        ctx.fillRect(bx, by, 2, 1);
        ctx.restore();
      }
      break;
    }

    case "plant": {
      // Pot
      ctx.fillStyle = "#8b4513";
      ctx.fillRect(8, 18, 16, 12);
      ctx.fillStyle = "#a0522d";
      ctx.fillRect(6, 16, 20, 3);
      ctx.fillStyle = "#6b3410";
      ctx.fillRect(8, 28, 16, 2);
      ctx.fillStyle = "#3e2723";
      ctx.fillRect(9, 18, 14, 3);
      // Leaves
      ctx.fillStyle = "#2e8b57";
      ctx.fillRect(10, 6, 12, 12);
      ctx.fillRect(6, 8, 6, 8);
      ctx.fillRect(20, 8, 6, 8);
      ctx.fillStyle = "#3cb371";
      ctx.fillRect(12, 4, 8, 4);
      ctx.fillRect(8, 10, 4, 4);
      ctx.fillRect(20, 10, 4, 4);
      ctx.fillStyle = "#4cd97a";
      ctx.fillRect(13, 5, 2, 2);
      ctx.fillRect(9, 11, 2, 2);
      ctx.fillRect(21, 11, 2, 2);
      break;
    }

    case "whiteboard": {
      ctx.fillStyle = "#c0c0c0";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#f5f5f5";
      ctx.fillRect(3, 3, w - 6, h - 6);
      ctx.fillStyle = "#333";
      ctx.fillRect(8, 8, 40, 1);
      ctx.fillRect(8, 14, 30, 1);
      ctx.fillRect(8, 20, 35, 1);
      ctx.fillStyle = "#e00";
      ctx.fillRect(60, 6, 20, 12);
      ctx.fillStyle = "#00c";
      ctx.fillRect(90, 8, 15, 8);
      ctx.fillStyle = "#999";
      ctx.fillRect(2, h - 4, w - 4, 3);
      ctx.fillStyle = "#f00";
      ctx.fillRect(10, h - 4, 6, 2);
      ctx.fillStyle = "#00f";
      ctx.fillRect(20, h - 4, 6, 2);
      ctx.fillStyle = "#0a0";
      ctx.fillRect(30, h - 4, 6, 2);
      break;
    }

    case "water_cooler": {
      ctx.fillStyle = "#ddd";
      ctx.fillRect(8, 8, 16, 18);
      ctx.fillStyle = "#87ceeb";
      ctx.fillRect(10, 2, 12, 10);
      ctx.fillStyle = "#add8e6";
      ctx.fillRect(12, 3, 4, 4);
      ctx.fillStyle = "#c0c0c0";
      ctx.fillRect(6, 18, 4, 4);
      ctx.fillRect(22, 18, 4, 4);
      ctx.fillStyle = "#0000ff";
      ctx.fillRect(7, 18, 2, 2);
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(23, 18, 2, 2);
      ctx.fillStyle = "#aaa";
      ctx.fillRect(6, 26, 20, 4);
      break;
    }

    case "dining_table": {
      const wd: RGB = [180, 140, 100];
      ctx.fillStyle = rgb(...wd);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = shift(wd, 10, 8, 6);
      ctx.fillRect(0, 0, w, 1);
      ctx.fillStyle = shift(wd, -14, -12, -10);
      ctx.fillRect(0, h - 2, w, 2);
      ctx.fillRect(w - 1, 0, 1, h);
      // Place settings
      ctx.fillStyle = "#fff";
      ctx.fillRect(4, 8, 10, 10);
      ctx.fillRect(w - 14, 8, 10, 10);
      ctx.fillStyle = "#ddd";
      ctx.fillRect(6, 10, 6, 6);
      ctx.fillRect(w - 12, 10, 6, 6);
      break;
    }

    default: {
      ctx.fillStyle = "#888";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#666";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
    }
  }

  return canvas;
}
