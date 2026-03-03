/**
 * Office map definition – multi-layer.
 *
 * Layers:
 *   floor : FloorBase – every cell filled (wood, carpet, tile, grass, etc.)
 *   decal : FloorDecal – sparse decorations (cables, mats, scuff marks)
 *   wall  : Wall / divider / fence – structure tiles (collision on this layer)
 *
 * Map: 40 cols × 30 rows, each tile = 32×32 px
 */

import { T } from "./tileRegistry";

export const MAP_COLS = 40;
export const MAP_ROWS = 30;

/* ── Deterministic hash for stable tile variant selection ── */

function tileHash(x: number, y: number, salt: number = 0): number {
  return (
    ((x * 374761393 + y * 668265263 + salt * 2654435761) ^ 0x12345678) >>> 0
  );
}

/* ── Desk definitions – 10 workstations (2 rows × 5 desks) ──── */

export interface DeskDef {
  id: number;
  tileX: number;
  tileY: number;
}

export const DESKS: DeskDef[] = [
  // Row 1: 5 desks
  { id: 1, tileX: 5, tileY: 3 },
  { id: 2, tileX: 11, tileY: 3 },
  { id: 3, tileX: 17, tileY: 3 },
  { id: 4, tileX: 23, tileY: 3 },
  { id: 5, tileX: 29, tileY: 3 },
  // Row 2: 5 desks (moved down to create corridor)
  { id: 6, tileX: 5, tileY: 9 },
  { id: 7, tileX: 11, tileY: 9 },
  { id: 8, tileX: 17, tileY: 9 },
  { id: 9, tileX: 23, tileY: 9 },
  { id: 10, tileX: 29, tileY: 9 },
];

/* ── Meeting room chair definitions ───────────────────────── */

export interface ChairDef {
  id: number;
  tileX: number;
  tileY: number;
  type: "blue_chair" | "chair2";
}

export const MEETING_ROOM_CHAIRS: ChairDef[] = [
  // Row 1: 3 chairs (blue_chair, chair2, blue_chair)
  { id: 1, tileX: 6, tileY: 17, type: "blue_chair" },
  { id: 2, tileX: 9, tileY: 17, type: "chair2" },
  { id: 3, tileX: 12, tileY: 17, type: "blue_chair" },
  // Row 2: 3 chairs (chair2, blue_chair, chair2)
  { id: 4, tileX: 6, tileY: 19, type: "chair2" },
  { id: 5, tileX: 9, tileY: 19, type: "blue_chair" },
  { id: 6, tileX: 12, tileY: 19, type: "chair2" },
];

/* ── Furniture & decoration objects ───────────────────────── */

export interface FurnitureDef {
  type: string;
  tileX: number;
  tileY: number;
  widthTiles: number;
  heightTiles: number;
  scale?: number; // optional display scale (e.g. 1.2)
}

/** Plant definitions with IDs for easter egg feature (plant_id 0..5) */
export interface PlantDef {
  id: number;
  tileX: number;
  tileY: number;
  widthTiles: number;
  heightTiles: number;
}

export const PLANT_DEFS: PlantDef[] = [
  { id: 0, tileX: 2, tileY: 2, widthTiles: 1, heightTiles: 1 },
  { id: 1, tileX: 37, tileY: 2, widthTiles: 1, heightTiles: 1 },
  { id: 2, tileX: 2, tileY: 11, widthTiles: 1, heightTiles: 1 },
  { id: 3, tileX: 37, tileY: 11, widthTiles: 1, heightTiles: 1 },
  { id: 4, tileX: 19, tileY: 14, widthTiles: 1, heightTiles: 1 },
  { id: 5, tileX: 18, tileY: 19, widthTiles: 1, heightTiles: 1 },
];

export const FURNITURE: FurnitureDef[] = [
  // Meeting room – chairs (placed via MEETING_ROOM_CHAIRS array, rendered separately)
  // Meeting room – monitor on top center
  { type: "monitor", tileX: 13.5, tileY: 14, widthTiles: 2.25, heightTiles: 2.25 },
  // Office right side bulletin board monitor
  { type: "bulletin_board", tileX: 36, tileY: 7, widthTiles: 2, heightTiles: 2 },
  // Dining area – top row: microwave (left), storage1, storage2, refrigerator (right)
  { type: "microwave", tileX: 23, tileY: 14, widthTiles: 1.5, heightTiles: 1.5 },
  { type: "dinning_storage1", tileX: 33, tileY: 14, widthTiles: 2, heightTiles: 2 },
  { type: "dinning_storage2", tileX: 35, tileY: 14, widthTiles: 2, heightTiles: 2 },
  { type: "refrigerator", tileX: 37, tileY: 13.6, widthTiles: 2, heightTiles: 3 },
  // Dining area – center: desk with chairs (left, right, above, below)
  { type: "dinning_desk", tileX: 29, tileY: 17.5, widthTiles: 4, heightTiles: 2 },
  { type: "dinning_chair_1", tileX: 27, tileY: 17.5, widthTiles: 1.5, heightTiles: 1.5 },
  { type: "dinning_chair_2", tileX: 33.6, tileY: 17.5, widthTiles: 1.5, heightTiles: 1.5 },
  { type: "dinning_chair_4", tileX: 30.5, tileY: 16, widthTiles: 1.5, heightTiles: 1.5 },
  { type: "dinning_chair_3", tileX: 30.5, tileY: 19.4, widthTiles: 1.5, heightTiles: 1.5 },
  // Game room – billiard table (drawn snooker, offset to bottom-right)
  { type: "billiard", tileX: 8, tileY: 24.4, widthTiles: 6, heightTiles: 3 },
  // Game room – treadmills (left side, one above one below)
  { type: "treadmill", tileX: 1.5, tileY: 23.00, widthTiles: 2, heightTiles: 1.5, scale: 1.2 },
  { type: "treadmill", tileX: 1.5, tileY: 26, widthTiles: 2, heightTiles: 1.5, scale: 1.2 },
  // Decorative plants
  { type: "plant", tileX: 2, tileY: 2, widthTiles: 1, heightTiles: 1 },
  { type: "plant", tileX: 37, tileY: 2, widthTiles: 1, heightTiles: 1 },
  { type: "plant", tileX: 2, tileY: 11, widthTiles: 1, heightTiles: 1 },
  { type: "plant", tileX: 37, tileY: 11, widthTiles: 1, heightTiles: 1 },
  { type: "plant", tileX: 19, tileY: 14, widthTiles: 1, heightTiles: 1 },
  { type: "plant", tileX: 18, tileY: 19, widthTiles: 1, heightTiles: 1 },
  // Meeting room whiteboard
  { type: "whiteboard", tileX: 8, tileY: 14, widthTiles: 4, heightTiles: 1 },
  // Office water cooler
  { type: "water_cooler", tileX: 35, tileY: 5, widthTiles: 1, heightTiles: 1 },
];

/* ── Area labels ──────────────────────────────────────────── */

export const AREA_LABELS = [
  { text: "Office Area", tileX: 10, tileY: 1.5 },
  { text: "Meeting Room", tileX: 10, tileY: 14.5 },
  { text: "Game Room", tileX: 10, tileY: 22.5 },
  { text: "Pet Area", tileX: 30, tileY: 22.5 },
];

/* ── Pet area spawn ───────────────────────────────────────── */

export const PET_SPAWN = { tileX: 30, tileY: 25 };

/* ── Multi-layer map generation ───────────────────────────── */

export interface MapLayers {
  floor: number[][]; // every cell filled
  decal: number[][]; // -1 = empty, sparse decorations
  wall: number[][];  // -1 = empty, structural tiles
}

export function generateOfficeLayers(): MapLayers {
  const floor: number[][] = [];
  const decal: number[][] = [];
  const wall: number[][] = [];

  // Tile variant pools per area (weighted by repeat entries)
  const officeFloors = [T.WOOD_A, T.WOOD_B, T.WOOD_C];
  const meetingFloors = [T.CARPET_A, T.CARPET_A, T.CARPET_B];
  const diningFloors = [T.TILE_A, T.TILE_A, T.TILE_B];
  const gameFloors = [T.RUBBER_A, T.RUBBER_A, T.RUBBER_B];
  const petFloors = [T.GRASS_A, T.GRASS_B, T.GRASS_C];

  for (let y = 0; y < MAP_ROWS; y++) {
    floor[y] = [];
    decal[y] = [];
    wall[y] = [];

    for (let x = 0; x < MAP_COLS; x++) {
      const h = tileHash(x, y);
      decal[y][x] = -1;
      wall[y][x] = -1;

      /* ── classify position ─────────────────────────── */
      const isPerimeter =
        x === 0 || x === MAP_COLS - 1 || y === 0 || y === MAP_ROWS - 1;

      const isHDiv13 = y === 13 && x >= 1 && x <= MAP_COLS - 2;
      const isVDiv20 = x === 20 && y >= 14 && y <= 28;
      const isHDiv21 = y === 21 && x >= 1 && x <= MAP_COLS - 2;

      // Door moved to top right (x === 17 for meeting room entrance)
      const isDoorH13 = isHDiv13 && x === 17;
      const isDoorV20 = isVDiv20 && (y === 16 || y === 24);
      const isDoorH21 = isHDiv21 && (x === 10 || x === 27);

      const isOffice = y >= 1 && y <= 12 && x >= 1 && x <= MAP_COLS - 2;
      const isMeeting = y >= 14 && y <= 20 && x >= 1 && x <= 19;
      const isDining = y >= 14 && y <= 20 && x >= 21 && x <= 38;
      const isGame = y >= 22 && y <= 28 && x >= 1 && x <= 19;
      const isPet = y >= 22 && y <= 28 && x >= 21 && x <= 38;

      /* ── floor layer (always filled) ───────────────── */
      if (isOffice || isHDiv13 || isVDiv20 || isHDiv21) {
        // Brown and Apricot checkerboard pattern
        const isApricot = (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0;
        floor[y][x] = isApricot ? T.WOOD_B : T.WOOD_A;
      } else if (isMeeting) {
        floor[y][x] = meetingFloors[h % meetingFloors.length];
      } else if (isDining) {
        floor[y][x] = diningFloors[h % diningFloors.length];
      } else if (isGame) {
        floor[y][x] = gameFloors[h % gameFloors.length];
      } else if (isPet) {
        floor[y][x] = petFloors[h % petFloors.length];
      } else {
        // Under perimeter walls
        floor[y][x] = officeFloors[h % officeFloors.length];
      }

      /* ── wall layer ────────────────────────────────── */
      if (isPerimeter) {
        if (y === 0) wall[y][x] = T.WALL_TOP;
        else if (y === MAP_ROWS - 1) wall[y][x] = T.WALL;
        else if (x === 0 || x === MAP_COLS - 1) wall[y][x] = T.WALL_SIDE;
        else wall[y][x] = T.WALL;
      }

      // Horizontal divider row 13
      if (isHDiv13 && !isDoorH13) {
        wall[y][x] = T.DIVIDER;
      }

      // Vertical divider col 20
      if (isVDiv20 && !isDoorV20) {
        wall[y][x] = T.DIVIDER;
      }

      // Horizontal divider row 21
      if (isHDiv21 && !isDoorH21 && x !== 20) {
        wall[y][x] = T.DIVIDER;
      }

      // Door openings → special floor tile, no wall tile
      if (isDoorH13 || isDoorV20 || isDoorH21) {
        floor[y][x] = T.DOOR;
        wall[y][x] = -1;
      }

      // Fence in pet area (transparent bg, sits on wall layer)
      if (isPet) {
        const isFenceH = (y === 23 || y === 27) && x >= 23 && x <= 36;
        const isFenceV = (x === 23 || x === 36) && y >= 23 && y <= 27;
        if (isFenceH && isFenceV) wall[y][x] = T.FENCE_POST;
        else if (isFenceH) wall[y][x] = T.FENCE_H;
        else if (isFenceV) wall[y][x] = T.FENCE_V;
      }
    }
  }

  /* ── decal layer: sparse decorations ──────────────────── */

  // Mats near door openings
  const matPositions: [number, number][] = [
    // Meeting room door (moved to top right, x=17, y=13)
    [17, 12], [17, 14],
    // Other doors
    [19, 16], [21, 16], [10, 20], [27, 20],
    [10, 22], [27, 22], [19, 24], [21, 24],
  ];
  for (const [mx, my] of matPositions) {
    if (mx >= 0 && mx < MAP_COLS && my >= 0 && my < MAP_ROWS) {
      decal[my][mx] = T.DECAL_MAT;
    }
  }

  // Cables near desks
  for (const desk of DESKS) {
    if (desk.tileY + 1 < MAP_ROWS && desk.tileY + 1 <= 12) {
      decal[desk.tileY + 1][desk.tileX] = T.DECAL_CABLE;
    }
  }

  // Random scuff marks in the office area
  for (let i = 0; i < 8; i++) {
    const sx = 2 + (tileHash(i, 0, 999) % (MAP_COLS - 4));
    const sy = 2 + (tileHash(i, 1, 999) % 10);
    if (decal[sy][sx] === -1 && wall[sy][sx] === -1) {
      decal[sy][sx] = T.DECAL_SCUFF;
    }
  }

  return { floor, decal, wall };
}
