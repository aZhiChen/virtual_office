/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Main Phaser scene for the virtual office.
 *
 * Rendering architecture:
 *   - 3 tilemap layers: floor (depth -2), decal (depth -1), wall (depth 0)
 *   - Furniture & desks rendered as sprites with y-depth
 *   - Characters, pets, other players use dynamic y-depth sorting
 *   - Name labels pinned to very high depth (always on top)
 *
 * Collision only on the wall layer (walls + dividers).
 * Fences are visual-only – no collision.
 */

import {
  TILE_SIZE,
  T,
  generateTilesetCanvas,
  generateDeskCanvas,
  generateFurnitureCanvas,
} from "../maps/tileRegistry";

import {
  generateOfficeLayers,
  MAP_COLS,
  MAP_ROWS,
  DESKS,
  FURNITURE,
  AREA_LABELS,
  PET_SPAWN,
  MEETING_ROOM_CHAIRS,
} from "../maps/officeMap";

import { SKIN_COLORS, HAIR_COLORS, CLOTHING_COLORS, PET_COLORS } from "../sprites/colors";

/** Constant depth for name labels – always on top */
const LABEL_DEPTH = MAP_ROWS * TILE_SIZE + 200;

/* ------------------------------------------------------------------ */
/*  Factory – returns the OfficeScene class bound to the live Phaser   */
/* ------------------------------------------------------------------ */

export function createOfficeScene(Phaser: any) {
  return class OfficeScene extends Phaser.Scene {
    /* ---- state ---- */
    private player!: any;
    private pet: any = null;
    private otherPlayers: Map<number, any> = new Map();
    private otherPets: Map<number, any> = new Map();
    private petLabels: Map<number, any> = new Map();
    private nameLabels: Map<number, any> = new Map();
    private otherPlayerNames: Map<number, string> = new Map();
    private cursors!: any;
    private wallLayer!: any;
    private furnitureGroup!: any;
    private isSitting = false;
    private controlTarget: "character" | "pet" = "character";
    private moveSpeed = 160;
    private playerConfig: any = {};
    private lastNearbyDesks: number[] = [];
    private lastNearbyUsers: number[] = [];
    private playerNameLabel!: any;
    private petNameLabel: any = null;
    private sitPromptLabel: any = null;
    private workingLabel: any = null;
    private meetingRoomChairs: Map<number, any> = new Map(); // chair id -> sprite
    private deskChairs: Map<number, any> = new Map(); // desk id -> office chair sprite (for depth)
    private lastNearbyChair: number | null = null;
    private sitPromptLabelChair: any = null;
    private currentChairId: number | null = null;
    private diningChairSprites: any[] = []; // dining chairs in FURNITURE order: chair_1, chair_2, chair_4, chair_3
    private dinningDeskSprite: any = null; // dining table – used for depth when sitting on chair 1, 2, 4
    private lastNearbyDiningChair: number | null = null;
    private sitPromptLabelDiningChair: any = null;
    private currentDiningChairIndex: number | null = null;
    private currentDeskId: number | null = null;
    private applianceLabel: any = null; // "微波炉" / "冰箱" / "储物柜" when near
    private treadmillSprites: any[] = []; // treadmill sprites from FURNITURE
    private lastNearbyTreadmill: number | null = null;
    private treadmillPromptLabel: any = null; // "我想跑步" when near
    private treadmillStatusLabel: any = null; // "<人名>在努力减肥" when on treadmill
    private isOnTreadmill = false;
    private currentTreadmillIndex: number | null = null;
    private officeAnimals: any[] = []; // 4 cows + 4 horses, random walk, collide with each other
    private officeAnimalTime = 0;
    /** Other player at desk: user_id -> desk_id (null when stood up). */
    private otherPlayerDesk: Map<number, number | null> = new Map();
    /** Other player at meeting/dining/treadmill: user_id -> { type, id } (null when stood up). */
    private otherPlayerSeat: Map<number, { type: string; id: number } | null> = new Map();
    /** "XXX在认真工作" label above other players at desk. */
    private otherWorkingLabels: Map<number, any> = new Map();
    /** "XXX在努力减肥" label above other players on treadmill. */
    private otherTreadmillLabels: Map<number, any> = new Map();
    /** "XXX在休息" label above other players on meeting/dining chairs. */
    private otherChairLabels: Map<number, any> = new Map();
    /** Stored avatar_config for other players (to generate back texture on demand). */
    private otherPlayerAvatarConfig: Map<number, any> = new Map();
    /** "<人名>正在使用，请排队或使用其他<设备名>" above player when device is occupied. */
    private deviceOccupiedLabel: any = null;
    private deviceOccupiedHideAt = 0;

    constructor() {
      super("OfficeScene");
    }

    /* ---- lifecycle ---- */

    preload() {
      this.load.image("chair", "/img/blue_chair.png");
      this.load.image("desk", "/img/desk.png");
      // Meeting room assets
      this.load.image("lamp", "/img/lamp.png");
      this.load.image("meeting_room_desk", "/img/meeting_room_desk.png");
      this.load.image("blue_chair", "/img/blue_chair.png");
      this.load.image("chair2", "/img/chair2.png");
      this.load.image("monitor", "/img/morniter.png");
      // Dining area assets
      this.load.image("microwave", "/img/microwave.png");
      this.load.image("dinning_storage1", "/img/dinning_storage1.png");
      this.load.image("dinning_storage2", "/img/dinning_storage2.png");
      this.load.image("refrigerator", "/img/refrigerator.png");
      this.load.image("dinning_desk", "/img/dinning_desk.png");
      this.load.image("dinning_chair_1", "/img/dinning_chair_1.png");
      this.load.image("dinning_chair_2", "/img/dinning_chair_2.png");
      this.load.image("dinning_chair_3", "/img/dinning_chair_3.png");
      this.load.image("dinning_chair_4", "/img/dinning_chair_4.png");
      // Game room assets
      this.load.image("treadmill", "/img/game/treadmill.png");
      // Pet options from /img/animals (except cow, horse – used as office NPCs)
      ["cat1", "cat2", "cat3", "cat4", "dog1", "dog2", "lizard"].forEach((name) => {
        this.load.image("pet_" + name, "/img/animals/" + name + ".png");
      });
      // Office area NPCs: cow and horse
      this.load.image("cow", "/img/animals/cow.png");
      this.load.image("horse", "/img/animals/horse.png");
      // Load desk floor tile from piskel
      this.load.image("desk_floor_tile", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAACUElEQVR4AeyUQUhUQRjH/+tBhAJP3QLrUiRslFsh28EIIohADwaxEB2SIBcCvYQERUFIhwyi44oH0ZMe9SgKgh7Uy6IH8aDg6sWLCopent9/YNZ5zzfvzapPRVzmt9/MNzPf959vZrcK5/xxFeCJzihk+njNRYD3vKkJUUhqihNTeXMRoKKOTUwgDDV5gi9nAcyRa/uG1+0d6P49qix9FliRMI4sr0jAVvU2nta9wMbOKu7euHckmOlIt82BzExPK2vOmf2KBDC53rxeWtXdoOXJ8unhFL6PtWI5l0Ox0MA1KX4FcRbAR9j15RXInx8fMVj4qR5mMCDHK/X1eJLJ4HFNjYI+G3ECvH89PWhpblawb6L9geCpuoUFvJl5i5F8Hs/ad3D7/y0uUZVhx6TKHIT0U587O5HNZsuslUrQaD/vWfb6ElxvuaaqQEtkPrRFCWBAryNTi4H8yzJ74wVoTD/XSQa1RyyKN+fxqLFRWfbpEzgv5rDZBHhz3bUg71oBV7g+DkntE2ETIOvOptkEpBq6NlFcTPvoHwJc+dW7DxPGI3Is38/RJkDWAek7xbJl/8H9NOLgBl7Z1w/VIBxrK31fchkjUgAXmFAEMX22Pk9vmzP9TgJYOpP3fZOwoYMbp9auUBsrgIlkJ0vnxN/ZTd/dy97IFisgcrdlkqfXWJaU3YkIYPRTfQMMWCmsgMueJCqg/kP0ox1e2o3UkYQAJjQfLMdWkhJgTRicuBJwoSugXrPcGR+UmGO3yDhxFThpcq3aGidOgA6QmL38AuJKdwAAAP//NhOr0AAAAAZJREFUAwBFhAZQwaWGTwAAAABJRU5ErkJggg==");
    }

    init(data: any) {
      this.playerConfig = data || {};
    }

    create() {
      this.furnitureGroup = this.physics.add.staticGroup();
      this.generateTileset();
      this.buildMap();
      this.generateFurnitureTextures();
      // this.placeDeskFloorTiles(); // Disabled - was causing shadow effect
      this.placeFurniture();
      this.placeDesks();
      this.placeMeetingRoomChairs();
      this.placeAreaLabels();
      this.createPlayer();
      this.createPet();
      this.createOfficeAnimals();
      this.setupCamera();
      this.setupInput();
      this.setupExternalEvents();
      // Tell the page we're ready so it can re-send presence_snapshot if we missed it (e.g. slow Phaser load).
      // Delay so renderer/textures/framebuffer are fully ready before addOtherPlayer runs (avoids renderer null).
      this.time.delayedCall(300, () => {
        window.dispatchEvent(new CustomEvent("game:ready"));
      });
    }

    update(_time: number, delta: number) {
      if (!this.player) return;
      this.handleMovement();
      // Office animals are driven by server (react:office_animals), not local wander
      this.checkProximity();
      this.updateLabels();
      this.updateDepths();
    }

    /* ---- tileset generation ---- */

    private generateTileset() {
      const canvas = generateTilesetCanvas();
      this.textures.addCanvas("tileset", canvas);
    }

    /* ---- multi-layer map ---- */

    private buildMap() {
      const layers = generateOfficeLayers();

      const map = this.make.tilemap({
        tileWidth: TILE_SIZE,
        tileHeight: TILE_SIZE,
        width: MAP_COLS,
        height: MAP_ROWS,
      });

      const ts = map.addTilesetImage(
        "tileset",
        "tileset",
        TILE_SIZE,
        TILE_SIZE,
        0,
        0,
      );

      // Floor layer (always filled)
      const floorLayer = map.createBlankLayer("floor", ts!, 0, 0, MAP_COLS, MAP_ROWS)!;
      for (let y = 0; y < MAP_ROWS; y++)
        for (let x = 0; x < MAP_COLS; x++)
          if (layers.floor[y][x] >= 0)
            floorLayer.putTileAt(layers.floor[y][x], x, y);
      floorLayer.setDepth(-2);

      // Decal layer (sparse decorations)
      const decalLayer = map.createBlankLayer("decal", ts!, 0, 0, MAP_COLS, MAP_ROWS)!;
      for (let y = 0; y < MAP_ROWS; y++)
        for (let x = 0; x < MAP_COLS; x++)
          if (layers.decal[y][x] >= 0)
            decalLayer.putTileAt(layers.decal[y][x], x, y);
      decalLayer.setDepth(-1);

      // Wall layer (structure + collision)
      this.wallLayer = map.createBlankLayer("wall", ts!, 0, 0, MAP_COLS, MAP_ROWS)!;
      for (let y = 0; y < MAP_ROWS; y++)
        for (let x = 0; x < MAP_COLS; x++)
          if (layers.wall[y][x] >= 0)
            this.wallLayer.putTileAt(layers.wall[y][x], x, y);
      this.wallLayer.setDepth(0);

      // Collision: walls + dividers only (not fences)
      this.wallLayer.setCollision([T.WALL, T.WALL_TOP, T.WALL_SIDE, T.DIVIDER]);

      this.physics.world.setBounds(
        0,
        0,
        MAP_COLS * TILE_SIZE,
        MAP_ROWS * TILE_SIZE,
      );
    }

    /* ---- furniture texture pre-generation ---- */

    private generateFurnitureTextures() {
      // Per-type furniture textures
      const seen = new Set<string>();
      // Skip direct image assets - they are loaded directly, not generated
      const directImageTypes = [
        "lamp", "meeting_room_desk", "blue_chair", "chair2", "monitor",
        "microwave", "dinning_storage1", "dinning_storage2", "refrigerator",
        "dinning_desk", "dinning_chair_1", "dinning_chair_2", "dinning_chair_3", "dinning_chair_4",
        "treadmill",
      ];
      for (const f of FURNITURE) {
        if (seen.has(f.type)) continue;
        if (directImageTypes.includes(f.type)) continue; // Skip direct image assets
        seen.add(f.type);
        const key = `tex_${f.type}`;
        if (!this.textures.exists(key)) {
          const c = generateFurnitureCanvas(
            f.type,
            f.widthTiles * TILE_SIZE,
            f.heightTiles * TILE_SIZE,
          );
          this.textures.addCanvas(key, c);
        }
      }
    }

    /* ---- furniture sprites ---- */

    private placeFurniture() {
      for (const f of FURNITURE) {
        const px = f.tileX * TILE_SIZE;
        const py = f.tileY * TILE_SIZE;
        const w = f.widthTiles * TILE_SIZE;
        const h = f.heightTiles * TILE_SIZE;
        
        // Check if this is a direct image asset (not generated texture)
        const directImageTypes = [
          "lamp", "meeting_room_desk", "blue_chair", "chair2", "monitor",
          "microwave", "dinning_storage1", "dinning_storage2", "refrigerator",
          "dinning_desk", "dinning_chair_1", "dinning_chair_2", "dinning_chair_3", "dinning_chair_4",
          "treadmill",
        ];
        const isDirectImage = directImageTypes.includes(f.type);
        const texKey = isDirectImage ? f.type : `tex_${f.type}`;
        const scale = f.scale ?? 1;
        const displayW = w * scale;
        const displayH = h * scale;
        // All furniture has collision so player and pet cannot walk through
        const sprite = this.physics.add.staticImage(px + w / 2, py + h / 2, texKey);
        sprite.setDisplaySize(displayW, displayH);
        // Set physics body to match display size for correct collision
        sprite.body.setSize(displayW, displayH);
        sprite.body.setOffset(-displayW / 2, -displayH / 2);
        sprite.refreshBody();
        this.furnitureGroup.add(sprite);
        sprite.setDepth(py + displayH);

        // Track dining desk for depth ordering when sitting on chair 1, 2, 4
        if (f.type === "dinning_desk") {
          this.dinningDeskSprite = sprite;
        }
        // Track dining chairs for sit interaction (order: chair_1, chair_2, chair_4, chair_3)
        const diningChairTypes = ["dinning_chair_1", "dinning_chair_2", "dinning_chair_4", "dinning_chair_3"];
        if (diningChairTypes.includes(f.type)) {
          sprite.setInteractive({ useHandCursor: true });
          const idx = diningChairTypes.indexOf(f.type);
          sprite.on("pointerdown", () => {
            if (this.lastNearbyDiningChair === idx && !this.isSitting) {
              this.sitOnDiningChair(idx);
            }
          });
          this.diningChairSprites[idx] = sprite;
        }
        // Track treadmill sprites for run interaction
        if (f.type === "treadmill") {
          this.treadmillSprites.push(sprite);
        }
      }
    }

    /* ---- desk floor tiles (workspace zones) ---- */

    private placeDeskFloorTiles() {
      DESKS.forEach((desk) => {
        // Create a 4x4 tile workspace zone under each desk
        // This uses the piskel desk floor tile to visually define work areas
        for (let dy = 0; dy < 4; dy++) {
          for (let dx = 0; dx < 4; dx++) {
            const tileSprite = this.add.image(
              (desk.tileX + dx) * TILE_SIZE + TILE_SIZE / 2,
              (desk.tileY + dy) * TILE_SIZE + TILE_SIZE / 2,
              "desk_floor_tile"
            );
            tileSprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
            tileSprite.setDepth(-1.5); // Between floor and decal layers
            tileSprite.setAlpha(0.7); // Slightly transparent for blend
          }
        }
      });
    }

    /* ---- desks (sprite-based) ---- */

    private placeDesks() {
      DESKS.forEach((desk) => {
        const px = desk.tileX * TILE_SIZE;
        const py = desk.tileY * TILE_SIZE;

        // 1. Desk (Atomic PNG) – full collision so player and pet cannot walk through
        const deskSprite = this.furnitureGroup.create(px + TILE_SIZE * 1.5, py + TILE_SIZE * 0.4, "desk");
        deskSprite.setDisplaySize(TILE_SIZE * 3, TILE_SIZE * 2);
        deskSprite.body.setSize(TILE_SIZE * 3, TILE_SIZE * 2);
        deskSprite.body.setOffset(-(TILE_SIZE * 3) / 2, -(TILE_SIZE * 2) / 2);
        deskSprite.refreshBody();
        // Desk is "above" the player's legs when sitting
        deskSprite.setDepth(py + TILE_SIZE * 1.4);

        // 2. Chair (Atomic PNG)
        const chairSprite = this.add.image(px + TILE_SIZE * 1.5, py + TILE_SIZE * 1.9, "chair");
        chairSprite.setDisplaySize(TILE_SIZE * 1.2, TILE_SIZE * 1.5);
        chairSprite.setDepth(py + TILE_SIZE * 1.9);
        this.deskChairs.set(desk.id, chairSprite);

        // 3. Desk ID Label
        this.add
          .text(px + TILE_SIZE * 1.5, py + TILE_SIZE * 2.9, `#${desk.id}`, {
            fontSize: "10px",
            color: "#fff",
            backgroundColor: "#00000066",
            padding: { x: 2, y: 1 }
          })
          .setOrigin(0.5)
          .setDepth(LABEL_DEPTH - 10);
      });
    }

    /* ---- meeting room chairs ---- */

    private placeMeetingRoomChairs() {
      MEETING_ROOM_CHAIRS.forEach((chair) => {
        const px = chair.tileX * TILE_SIZE;
        const py = chair.tileY * TILE_SIZE;

        const chairSprite = this.add.image(px + TILE_SIZE / 2, py + TILE_SIZE / 2, chair.type);
        chairSprite.setDisplaySize(TILE_SIZE * 1.2, TILE_SIZE * 1.5);
        // Initial depth - will be updated in updateDepths
        chairSprite.setDepth(py + TILE_SIZE * 0.5);
        
        // Make chair interactive for clicking (optional, space key also works)
        chairSprite.setInteractive({ useHandCursor: true });
        chairSprite.on('pointerdown', () => {
          if (this.lastNearbyChair === chair.id && !this.isSitting) {
            this.sitOnChair(chair.id);
          }
        });

        this.meetingRoomChairs.set(chair.id, chairSprite);
      });
    }

    /* ---- area labels ---- */

    private placeAreaLabels() {
      AREA_LABELS.forEach((a) => {
        this.add
          .text(a.tileX * TILE_SIZE, a.tileY * TILE_SIZE, a.text, {
            fontSize: "12px",
            color: "#666",
            fontFamily: "monospace",
          })
          .setOrigin(0.5)
          .setDepth(1); // above wall layer, below all sprites
      });
    }

    /* ---- y-depth sorting (called every frame) ---- */

    private isOtherOnMeetingChair(chairId: number): boolean {
      for (const [, seat] of this.otherPlayerSeat) {
        if (seat?.type === "meeting_chair" && seat.id === chairId) return true;
      }
      return false;
    }

    private isOtherOnDiningChair(index: number): boolean {
      for (const [, seat] of this.otherPlayerSeat) {
        if (seat?.type === "dining_chair" && seat.id === index) return true;
      }
      return false;
    }

    private isAnyOnDiningChairTopRow(): boolean {
      if (this.currentDiningChairIndex !== null && this.currentDiningChairIndex <= 2) return true;
      for (const [, seat] of this.otherPlayerSeat) {
        if (seat?.type === "dining_chair" && seat.id <= 2) return true;
      }
      return false;
    }

    private updateDepths() {
      if (this.isSitting) {
        if (this.currentChairId !== null) {
          const chairSprite = this.meetingRoomChairs.get(this.currentChairId);
          if (chairSprite) {
            this.player.setDepth(chairSprite.y - TILE_SIZE * 0.2);
            chairSprite.setDepth(chairSprite.y + TILE_SIZE * 0.5);
            return;
          }
        }
        if (this.currentDiningChairIndex !== null) {
          const chairSprite = this.diningChairSprites[this.currentDiningChairIndex];
          if (chairSprite) {
            const idx = this.currentDiningChairIndex;
            if (idx <= 2) {
              chairSprite.setDepth(chairSprite.y - 20);
              this.player.setDepth(chairSprite.y + 15);
              if (this.dinningDeskSprite) {
                this.dinningDeskSprite.setDepth(chairSprite.y + 80);
              }
            } else {
              this.player.setDepth(chairSprite.y - 10);
              chairSprite.setDepth(chairSprite.y + 30);
            }
            return;
          }
        }
        const desk = DESKS.find(d =>
          Math.abs(d.tileX * TILE_SIZE + TILE_SIZE * 1.5 - this.player.x) < 10 &&
          Math.abs(d.tileY * TILE_SIZE + TILE_SIZE * 1.15 - this.player.y) < 15
        );
        if (desk) {
          const py = desk.tileY * TILE_SIZE;
          this.player.setDepth(py + TILE_SIZE * 1.0);
          const chairSprite = this.deskChairs.get(desk.id);
          if (chairSprite) chairSprite.setDepth(py + TILE_SIZE * 1.3);
          return;
        }
      }

      // Apply depths for other players at seats (so furniture ordering matches)
      this.otherPlayerDesk.forEach((desk_id, uid) => {
        if (desk_id == null) return;
        const p = this.otherPlayers.get(uid);
        const desk = DESKS.find((d) => d.id === desk_id);
        if (!p || !desk) return;
        const py = desk.tileY * TILE_SIZE;
        p.setDepth(py + TILE_SIZE * 1.0);
        const chairSprite = this.deskChairs.get(desk_id);
        if (chairSprite) chairSprite.setDepth(py + TILE_SIZE * 1.3);
      });
      this.otherPlayerSeat.forEach((seat, uid) => {
        if (!seat) return;
        const p = this.otherPlayers.get(uid);
        if (!p) return;
        if (seat.type === "meeting_chair") {
          const chairSprite = this.meetingRoomChairs.get(seat.id);
          if (chairSprite) {
            p.setDepth(chairSprite.y - TILE_SIZE * 0.2);
            chairSprite.setDepth(chairSprite.y + TILE_SIZE * 0.5);
          }
        } else if (seat.type === "dining_chair") {
          const chairSprite = this.diningChairSprites[seat.id];
          if (chairSprite) {
            const idx = seat.id;
            if (idx <= 2) {
              chairSprite.setDepth(chairSprite.y - 20);
              p.setDepth(chairSprite.y + 15);
              if (this.dinningDeskSprite) {
                this.dinningDeskSprite.setDepth(chairSprite.y + 80);
              }
            } else {
              p.setDepth(chairSprite.y - 10);
              chairSprite.setDepth(chairSprite.y + 30);
            }
          }
        }
        // treadmill: use default depth below
      });

      // Default depth for office desk chairs not occupied by anyone (local at desk already returned above)
      DESKS.forEach((desk) => {
        const occupiedByOther = [...this.otherPlayerDesk.values()].some((did) => did === desk.id);
        const chairSprite = this.deskChairs.get(desk.id);
        if (chairSprite && !occupiedByOther) {
          chairSprite.setDepth(desk.tileY * TILE_SIZE + TILE_SIZE * 1.9);
        }
      });

      MEETING_ROOM_CHAIRS.forEach((chair) => {
        const chairSprite = this.meetingRoomChairs.get(chair.id);
        if (chairSprite && this.currentChairId !== chair.id && !this.isOtherOnMeetingChair(chair.id)) {
          chairSprite.setDepth(chairSprite.y + TILE_SIZE * 0.5);
        }
      });
      this.diningChairSprites.forEach((chairSprite: any, index: number) => {
        if (chairSprite && this.currentDiningChairIndex !== index && !this.isOtherOnDiningChair(index)) {
          chairSprite.setDepth(chairSprite.y + (chairSprite.displayHeight || 0) * 0.5);
        }
      });
      if (this.dinningDeskSprite && !this.isAnyOnDiningChairTopRow()) {
        this.dinningDeskSprite.setDepth(
          this.dinningDeskSprite.y + (this.dinningDeskSprite.displayHeight || 0) * 0.5
        );
      }

      // Player – depth = bottom-edge y
      this.player.setDepth(
        this.player.y + this.player.displayHeight * 0.5,
      );

      if (this.pet) {
        this.pet.setDepth(this.pet.y + this.pet.displayHeight * 0.5);
      }

      this.officeAnimals.forEach((sprite) => {
        if (sprite?.body) {
          sprite.setDepth(sprite.y + (sprite.displayHeight || 0) * 0.5);
        }
      });

      // Other players: default depth unless already set by seat logic above
      this.otherPlayers.forEach((sprite: any, uid: number) => {
        const atDesk = this.otherPlayerDesk.get(uid) != null;
        const seat = this.otherPlayerSeat.get(uid);
        const atMeetingOrDining = seat?.type === "meeting_chair" || seat?.type === "dining_chair";
        if (!atDesk && !atMeetingOrDining) {
          sprite.setDepth(sprite.y + (sprite.displayHeight || 0) * 0.5);
        }
      });
      this.otherPets.forEach((sprite: any) => {
        sprite.setDepth(sprite.y + sprite.displayHeight * 0.5);
      });
    }

    /* ---- player ---- */

    private createPlayer() {
      const cfg = this.playerConfig.avatar_config || {};
      this.generateCharacterTexture("player_self", cfg);
      this.generateCharacterBackTexture("player_self_back", cfg);

      const spawnX = 6 * TILE_SIZE;
      const spawnY = 5 * TILE_SIZE;
      this.player = this.physics.add.sprite(spawnX, spawnY, "player_self");
      this.player.setDisplaySize(28, 42);
      this.player.setCollideWorldBounds(true);
      this.player.setDepth(spawnY + 21);
      this.player.body.setSize(12, 12);
      this.player.body.setOffset(2, 12);
      this.physics.add.collider(this.player, this.wallLayer);
      this.physics.add.collider(this.player, this.furnitureGroup);

      this.playerNameLabel = this.add
        .text(spawnX, spawnY - 28, this.playerConfig.display_name || "You", {
          fontSize: "10px",
          color: "#fff",
          backgroundColor: "#00000088",
          padding: { x: 2, y: 1 },
          fontFamily: "monospace",
        })
        .setOrigin(0.5)
        .setDepth(LABEL_DEPTH);

      // Emit initial position
      window.dispatchEvent(
        new CustomEvent("game:player_moved", {
          detail: { x: spawnX, y: spawnY },
        }),
      );
    }

    private static readonly IMAGE_PET_TYPES = ["cat1", "cat2", "cat3", "cat4", "dog1", "dog2", "lizard"];
    private static readonly PET_DISPLAY = Math.round(24 * 1.5); // 31, 1.3x original
    private static readonly PET_BODY = Math.round(12 * 1.5);     // 16
    private static readonly PET_OFFSET = Math.round(2 * 1.5);   // 3

    /** 宠物类型显示名（去掉数字后缀）：cat1->猫, dog2->狗, lizard->蜥蜴 */
    private static petTypeDisplayName(petType: string): string {
      const base = petType.replace(/\d+$/, "");
      const map: Record<string, string> = {
        cat: "猫", dog: "狗", snake: "蛇", crab: "蟹", rabbit: "兔",
        gecko: "壁虎", lizard: "蜥蜴", turtle: "龟", bird: "鸟",
      };
      return map[base] || petType;
    }

    private createPet() {
      if (!this.playerConfig.has_pet || !this.playerConfig.pet_type) return;

      const petType = this.playerConfig.pet_type;
      const textureKey = OfficeScene.IMAGE_PET_TYPES.includes(petType)
        ? "pet_" + petType
        : (this.generatePetTexture("pet_own", petType), "pet_own");
      const sx = PET_SPAWN.tileX * TILE_SIZE;
      const sy = PET_SPAWN.tileY * TILE_SIZE;
      this.pet = this.physics.add.sprite(sx, sy, textureKey);
      this.pet.setDisplaySize(OfficeScene.PET_DISPLAY, OfficeScene.PET_DISPLAY);
      this.pet.setCollideWorldBounds(true);
      this.pet.setDepth(sy + OfficeScene.PET_DISPLAY * 0.5);
      this.pet.body.setSize(OfficeScene.PET_BODY, OfficeScene.PET_BODY);
      this.pet.body.setOffset(OfficeScene.PET_OFFSET, OfficeScene.PET_OFFSET);
      this.physics.add.collider(this.pet, this.wallLayer);
      this.physics.add.collider(this.pet, this.furnitureGroup);

      const ownerName = this.playerConfig.display_name || "你";
      const typeName = OfficeScene.petTypeDisplayName(petType);
      this.petNameLabel = this.add
        .text(sx, sy - OfficeScene.PET_DISPLAY * 0.6, `${ownerName}的${typeName}`, {
          fontSize: "10px",
          color: "#fff",
          backgroundColor: "#00000088",
          padding: { x: 2, y: 1 },
          fontFamily: "monospace",
        })
        .setOrigin(0.5)
        .setDepth(LABEL_DEPTH);
    }

    private static readonly OFFICE_ANIMAL_SIZE = 40; // 32 * 1.5
    private static readonly OFFICE_ANIMAL_BODY = 30;
    private static readonly OFFICE_ANIMAL_OFFSET = 9;

    /** Cows and horses in office area: random walk, collide with walls, furniture, and each other. */
    private createOfficeAnimals() {
      const officeCenterX = 20 * TILE_SIZE;
      const officeY = 6 * TILE_SIZE;
      const cows: any[] = [];
      const horses: any[] = [];
      // 4 cows at varied positions
      for (let i = 0; i < 4; i++) {
        const sx = officeCenterX + (i - 2) * TILE_SIZE * 1.5;
        const sy = officeY + (i % 2) * TILE_SIZE;
        const sprite = this.physics.add.sprite(sx, sy, "cow");
        this.setupOfficeAnimal(sprite);
        cows.push(sprite);
      }
      // 4 horses at varied positions
      for (let i = 0; i < 4; i++) {
        const sx = officeCenterX + (i - 1.5) * TILE_SIZE * 1.8;
        const sy = officeY + TILE_SIZE * 2 + (i % 2) * TILE_SIZE;
        const sprite = this.physics.add.sprite(sx, sy, "horse");
        this.setupOfficeAnimal(sprite);
        horses.push(sprite);
      }
      this.officeAnimals = [...cows, ...horses];
      // Cow/horse vs cow/horse collision
      for (let i = 0; i < this.officeAnimals.length; i++) {
        for (let j = i + 1; j < this.officeAnimals.length; j++) {
          this.physics.add.collider(this.officeAnimals[i], this.officeAnimals[j]);
        }
      }
      // Cow/horse vs player
      this.officeAnimals.forEach((animal) => {
        this.physics.add.collider(animal, this.player);
      });
      // Cow/horse vs pet
      if (this.pet) {
        this.officeAnimals.forEach((animal) => {
          this.physics.add.collider(animal, this.pet);
        });
      }
    }

    private setupOfficeAnimal(sprite: any) {
      sprite.setDisplaySize(OfficeScene.OFFICE_ANIMAL_SIZE, OfficeScene.OFFICE_ANIMAL_SIZE);
      sprite.setCollideWorldBounds(true);
      sprite.body.setSize(OfficeScene.OFFICE_ANIMAL_BODY, OfficeScene.OFFICE_ANIMAL_BODY);
      sprite.body.setOffset(OfficeScene.OFFICE_ANIMAL_OFFSET, OfficeScene.OFFICE_ANIMAL_OFFSET);
      // Cow/horse vs walls (tilemap layer)
      this.physics.add.collider(sprite, this.wallLayer);
      this.physics.add.collider(sprite, this.furnitureGroup);
      sprite.wanderVx = 0;
      sprite.wanderVy = 0;
      sprite.wanderUntil = 0;
    }

    /* ---- camera & input ---- */

    private setupCamera() {
      this.cameras.main.setBounds(
        0,
        0,
        MAP_COLS * TILE_SIZE,
        MAP_ROWS * TILE_SIZE,
      );
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    }

    private setupInput() {
      this.cursors = this.input.keyboard!.createCursorKeys();
      // Add space key for sitting
      const spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      spaceKey.on('down', () => {
        if (this.isOnTreadmill) {
          this.standOffTreadmill();
        } else if (this.isSitting) {
          if (this.currentChairId !== null) {
            this.standUpFromChair();
          } else if (this.currentDiningChairIndex !== null) {
            this.standUpFromDiningChair();
          } else if (this.currentDeskId !== null) {
            // Standing up from desk - trigger via game event to send to server
            window.dispatchEvent(new CustomEvent("game:stand_up"));
          }
        } else {
          if (this.lastNearbyTreadmill !== null) {
            this.standOnTreadmill(this.lastNearbyTreadmill);
          } else if (this.lastNearbyChair !== null) {
            this.sitOnChair(this.lastNearbyChair);
          } else if (this.lastNearbyDiningChair !== null) {
            this.sitOnDiningChair(this.lastNearbyDiningChair);
          } else if (this.lastNearbyDesks.length > 0) {
            window.dispatchEvent(
              new CustomEvent("game:sit_at_desk", { detail: { desk_id: this.lastNearbyDesks[0] } })
            );
          }
        }
      });
    }

    /* ---- movement ---- */

    private handleMovement() {
      const target =
        this.controlTarget === "pet" && this.pet ? this.pet : this.player;

      // If on treadmill and trying to move, stand off
      if (this.isOnTreadmill) {
        let vx = 0;
        let vy = 0;
        if (this.cursors.left.isDown) vx = -this.moveSpeed;
        else if (this.cursors.right.isDown) vx = this.moveSpeed;
        if (this.cursors.up.isDown) vy = -this.moveSpeed;
        else if (this.cursors.down.isDown) vy = this.moveSpeed;
        if (vx !== 0 || vy !== 0) {
          this.standOffTreadmill();
        } else {
          return;
        }
      }

      // If sitting on a chair/desk and trying to move, stand up
      if (this.isSitting && (this.currentChairId !== null || this.currentDiningChairIndex !== null || this.currentDeskId !== null)) {
        let vx = 0;
        let vy = 0;
        if (this.cursors.left.isDown) vx = -this.moveSpeed;
        else if (this.cursors.right.isDown) vx = this.moveSpeed;
        if (this.cursors.up.isDown) vy = -this.moveSpeed;
        else if (this.cursors.down.isDown) vy = this.moveSpeed;
        if (vx !== 0 || vy !== 0) {
          if (this.currentChairId !== null) this.standUpFromChair();
          else if (this.currentDiningChairIndex !== null) this.standUpFromDiningChair();
          else if (this.currentDeskId !== null) window.dispatchEvent(new CustomEvent("game:stand_up"));
        } else {
          return;
        }
      }

      if (this.isSitting || this.isOnTreadmill) return;

      target.setVelocity(0, 0);

      let vx = 0;
      let vy = 0;
      if (this.cursors.left.isDown) vx = -this.moveSpeed;
      else if (this.cursors.right.isDown) vx = this.moveSpeed;
      if (this.cursors.up.isDown) vy = -this.moveSpeed;
      else if (this.cursors.down.isDown) vy = this.moveSpeed;

      target.setVelocity(vx, vy);

      if (this.controlTarget === "character" && this.pet) {
        this.pet.setVelocity(0, 0);
      } else if (this.controlTarget === "pet" && this.player) {
        this.player.setVelocity(0, 0);
      }

      if (vx !== 0 || vy !== 0) {
        window.dispatchEvent(
          new CustomEvent("game:player_moved", {
            detail: {
              x: Math.round(target.x),
              y: Math.round(target.y),
              target: this.controlTarget,
            },
          }),
        );
      }
    }

    private static readonly WANDER_SPEED = 48;
    private static readonly WANDER_MIN_MS = 1500;
    private static readonly WANDER_MAX_MS = 4000;

    private updateOfficeAnimals(delta: number) {
      this.officeAnimalTime += delta;
      for (const sprite of this.officeAnimals) {
        if (!sprite?.body) continue;
        if (this.officeAnimalTime >= (sprite.wanderUntil ?? 0)) {
          sprite.wanderUntil = this.officeAnimalTime + OfficeScene.WANDER_MIN_MS + Math.random() * (OfficeScene.WANDER_MAX_MS - OfficeScene.WANDER_MIN_MS);
          if (Math.random() < 0.25) {
            sprite.wanderVx = 0;
            sprite.wanderVy = 0;
          } else {
            const angle = Math.random() * Math.PI * 2;
            sprite.wanderVx = Math.cos(angle) * OfficeScene.WANDER_SPEED;
            sprite.wanderVy = Math.sin(angle) * OfficeScene.WANDER_SPEED;
          }
        }
        sprite.setVelocity(sprite.wanderVx ?? 0, sprite.wanderVy ?? 0);
      }
    }

    /** Apply server-authoritative positions/velocities to office animals (cows/horses). */
    private applyOfficeAnimalsFromServer(animals: Array<{ index: number; x: number; y: number; vx?: number; vy?: number }> | undefined) {
      if (!animals?.length) return;
      for (const a of animals) {
        const sprite = this.officeAnimals[a.index];
        if (sprite?.body) {
          sprite.setPosition(a.x, a.y);
          (sprite.body as Phaser.Physics.Arcade.Body).setVelocity(a.vx ?? 0, a.vy ?? 0);
        }
      }
    }

    /* ---- proximity checks ---- */

    private checkProximity() {
      // Nearby desks
      const nearDesks: number[] = [];
      DESKS.forEach((d) => {
        const dx = d.tileX * TILE_SIZE + TILE_SIZE * 1.5;
        const dy = d.tileY * TILE_SIZE + TILE_SIZE * 1.9; // Chair position
        const dist = Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          dx,
          dy,
        );
        if (dist < TILE_SIZE * 2.5) nearDesks.push(d.id);
      });
      if (JSON.stringify(nearDesks) !== JSON.stringify(this.lastNearbyDesks)) {
        this.lastNearbyDesks = nearDesks;
        window.dispatchEvent(
          new CustomEvent("game:nearby_desks", { detail: nearDesks }),
        );
        
        // Show/hide sit prompt
        if (nearDesks.length > 0 && !this.isSitting) {
          const desk = DESKS.find(d => d.id === nearDesks[0]);
          if (desk) {
            const px = desk.tileX * TILE_SIZE + TILE_SIZE * 1.5;
            const py = desk.tileY * TILE_SIZE + TILE_SIZE * 1.9;
            if (!this.sitPromptLabel) {
              this.sitPromptLabel = this.add
                .text(px, py - 40, "按空格键坐下", {
                  fontSize: "12px",
                  color: "#fff",
                  backgroundColor: "#000000aa",
                  padding: { x: 6, y: 3 },
                  fontFamily: "monospace",
                })
                .setOrigin(0.5)
                .setDepth(LABEL_DEPTH);
            } else {
              this.sitPromptLabel.setPosition(px, py - 40);
              this.sitPromptLabel.setVisible(true);
            }
          }
        } else {
          if (this.sitPromptLabel) {
            this.sitPromptLabel.setVisible(false);
          }
        }
      }

      // Nearby meeting room chairs
      let nearbyChair: number | null = null;
      MEETING_ROOM_CHAIRS.forEach((chair) => {
        const chairSprite = this.meetingRoomChairs.get(chair.id);
        if (chairSprite) {
          const dist = Phaser.Math.Distance.Between(
            this.player.x,
            this.player.y,
            chairSprite.x,
            chairSprite.y,
          );
          if (dist < TILE_SIZE * 2) {
            nearbyChair = chair.id;
          }
        }
      });

      if (nearbyChair !== this.lastNearbyChair) {
        this.lastNearbyChair = nearbyChair;
        
        // Show/hide sit prompt for chairs (hide when chair is occupied by another player)
        const chairOccupiedByOther = nearbyChair !== null && this.isOtherOnMeetingChair(nearbyChair);
        if (nearbyChair !== null && !this.isSitting && !chairOccupiedByOther) {
          const chairSprite = this.meetingRoomChairs.get(nearbyChair);
          if (chairSprite) {
            if (!this.sitPromptLabelChair) {
              this.sitPromptLabelChair = this.add
                .text(chairSprite.x, chairSprite.y - 40, "按空格键坐下", {
                  fontSize: "12px",
                  color: "#fff",
                  backgroundColor: "#000000aa",
                  padding: { x: 6, y: 3 },
                  fontFamily: "monospace",
                })
                .setOrigin(0.5)
                .setDepth(LABEL_DEPTH);
            } else {
              this.sitPromptLabelChair.setPosition(chairSprite.x, chairSprite.y - 40);
              this.sitPromptLabelChair.setText("按空格键坐下");
              this.sitPromptLabelChair.setVisible(true);
            }
          }
        } else {
          if (this.sitPromptLabelChair) {
            this.sitPromptLabelChair.setVisible(false);
          }
        }
      }

      // Nearby appliances (microwave, refrigerator, storage) – show name above
      const applianceTypes: { type: string; label: string }[] = [
        { type: "microwave", label: "微波炉" },
        { type: "refrigerator", label: "冰箱" },
        { type: "dinning_storage1", label: "储物柜" },
        { type: "dinning_storage2", label: "储物柜" },
      ];
      let nearAppliance: { centerX: number; topY: number; label: string } | null = null;
      for (const f of FURNITURE) {
        const centerX = (f.tileX + f.widthTiles / 2) * TILE_SIZE;
        const centerY = (f.tileY + f.heightTiles / 2) * TILE_SIZE;
        const topY = f.tileY * TILE_SIZE;
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, centerX, centerY);
        if (dist < TILE_SIZE * 2) {
          const entry = applianceTypes.find((a) => a.type === f.type);
          if (entry) {
            nearAppliance = { centerX, topY, label: entry.label };
            break;
          }
        }
      }
      if (nearAppliance) {
        if (!this.applianceLabel) {
          this.applianceLabel = this.add
            .text(nearAppliance.centerX, nearAppliance.topY - 28, nearAppliance.label, {
              fontSize: "12px",
              color: "#fff",
              backgroundColor: "#000000aa",
              padding: { x: 6, y: 3 },
              fontFamily: "monospace",
            })
            .setOrigin(0.5)
            .setDepth(LABEL_DEPTH);
        } else {
          this.applianceLabel.setPosition(nearAppliance.centerX, nearAppliance.topY - 28);
          this.applianceLabel.setText(nearAppliance.label);
          this.applianceLabel.setVisible(true);
        }
      } else {
        if (this.applianceLabel) this.applianceLabel.setVisible(false);
      }

      // Nearby dining chairs – show sit prompt and track for space key
      let nearbyDiningChair: number | null = null;
      this.diningChairSprites.forEach((chairSprite: any, idx: number) => {
        if (!chairSprite) return;
        const dist = Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          chairSprite.x,
          chairSprite.y,
        );
        if (dist < TILE_SIZE * 2) {
          nearbyDiningChair = idx;
        }
      });
      if (nearbyDiningChair !== this.lastNearbyDiningChair) {
        this.lastNearbyDiningChair = nearbyDiningChair;
        const diningChairOccupiedByOther =
          nearbyDiningChair !== null && this.isOtherOnDiningChair(nearbyDiningChair);
        if (nearbyDiningChair !== null && !this.isSitting && !diningChairOccupiedByOther) {
          const chairSprite = this.diningChairSprites[nearbyDiningChair];
          if (chairSprite) {
            if (!this.sitPromptLabelDiningChair) {
              this.sitPromptLabelDiningChair = this.add
                .text(chairSprite.x, chairSprite.y - 40, "按空格键坐下", {
                  fontSize: "12px",
                  color: "#fff",
                  backgroundColor: "#000000aa",
                  padding: { x: 6, y: 3 },
                  fontFamily: "monospace",
                })
                .setOrigin(0.5)
                .setDepth(LABEL_DEPTH);
            } else {
              this.sitPromptLabelDiningChair.setPosition(chairSprite.x, chairSprite.y - 40);
              this.sitPromptLabelDiningChair.setVisible(true);
            }
          }
        } else {
          if (this.sitPromptLabelDiningChair) this.sitPromptLabelDiningChair.setVisible(false);
        }
      } else if (nearbyDiningChair !== null && this.sitPromptLabelDiningChair) {
        const chairSprite = this.diningChairSprites[nearbyDiningChair];
        if (chairSprite) this.sitPromptLabelDiningChair.setPosition(chairSprite.x, chairSprite.y - 40);
      }

      // Nearby treadmills – show "我想跑步" and track for space key
      let nearbyTreadmill: number | null = null;
      if (!this.isSitting && !this.isOnTreadmill) {
        this.treadmillSprites.forEach((treadmillSprite: any, idx: number) => {
          if (!treadmillSprite?.body?.enable) return; // skip disabled (player on it)
          const dist = Phaser.Math.Distance.Between(
            this.player.x,
            this.player.y,
            treadmillSprite.x,
            treadmillSprite.y,
          );
          if (dist < TILE_SIZE * 2) {
            nearbyTreadmill = idx;
          }
        });
      }
      if (nearbyTreadmill !== this.lastNearbyTreadmill) {
        this.lastNearbyTreadmill = nearbyTreadmill;
        if (nearbyTreadmill !== null) {
          const treadmillSprite = this.treadmillSprites[nearbyTreadmill];
          if (treadmillSprite) {
            if (!this.treadmillPromptLabel) {
              this.treadmillPromptLabel = this.add
                .text(treadmillSprite.x, treadmillSprite.y - 40, "我想跑步\n按空格键", {
                  fontSize: "12px",
                  color: "#fff",
                  backgroundColor: "#000000aa",
                  padding: { x: 6, y: 3 },
                  fontFamily: "monospace",
                })
                .setOrigin(0.5)
                .setDepth(LABEL_DEPTH);
            } else {
              this.treadmillPromptLabel.setPosition(treadmillSprite.x, treadmillSprite.y - 40);
              this.treadmillPromptLabel.setText("我想跑步\n按空格键");
              this.treadmillPromptLabel.setVisible(true);
            }
          }
        } else {
          if (this.treadmillPromptLabel) this.treadmillPromptLabel.setVisible(false);
        }
      } else if (nearbyTreadmill !== null && this.treadmillPromptLabel) {
        const treadmillSprite = this.treadmillSprites[nearbyTreadmill];
        if (treadmillSprite) this.treadmillPromptLabel.setPosition(treadmillSprite.x, treadmillSprite.y - 40);
      }

      // Nearby users
      const nearUsers: number[] = [];
      this.otherPlayers.forEach((sprite: any, uid: number) => {
        const dist = Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          sprite.x,
          sprite.y,
        );
        if (dist < TILE_SIZE * 3) nearUsers.push(uid);
      });
      if (JSON.stringify(nearUsers) !== JSON.stringify(this.lastNearbyUsers)) {
        this.lastNearbyUsers = nearUsers;
        window.dispatchEvent(
          new CustomEvent("game:nearby_users", { detail: nearUsers }),
        );
      }
    }

    /* ---- chair sitting functionality ---- */

    private sitOnChair(chairId: number) {
      const chair = MEETING_ROOM_CHAIRS.find(c => c.id === chairId);
      if (!chair) return;
      if (this.isOtherOnMeetingChair(chairId)) return;

      const chairSprite = this.meetingRoomChairs.get(chairId);
      if (!chairSprite) return;

      // Position player on the chair
      this.player.setPosition(chairSprite.x, chairSprite.y);
      this.player.setVelocity(0, 0);
      this.isSitting = true;
      this.currentChairId = chairId;

      // Switch to back view texture (no eyes)
      this.player.setTexture("player_self_back");

      window.dispatchEvent(new CustomEvent("game:seat", { detail: { seat_type: "meeting_chair", seat_id: chairId } }));

      // Hide sit prompt
      if (this.sitPromptLabelChair) {
        this.sitPromptLabelChair.setVisible(false);
      }

      // Don't show additional text when sitting - only show name label
      if (this.workingLabel) {
        this.workingLabel.setVisible(false);
      }
    }

    private standUpFromChair() {
      if (!this.isSitting || this.currentChairId === null) return;

      this.isSitting = false;
      this.currentChairId = null;

      this.player.setTexture("player_self");
      window.dispatchEvent(new CustomEvent("game:stand_up"));

      if (this.lastNearbyChair !== null && this.sitPromptLabelChair) {
        const chairSprite = this.meetingRoomChairs.get(this.lastNearbyChair);
        if (chairSprite) {
          this.sitPromptLabelChair.setPosition(chairSprite.x, chairSprite.y - 40);
          this.sitPromptLabelChair.setVisible(true);
        }
      }
    }

    private sitOnDiningChair(index: number) {
      if (this.isOtherOnDiningChair(index)) return;
      const chairSprite = this.diningChairSprites[index];
      if (!chairSprite) return;

      // Chair 3 (below table): sit slightly higher so feet align; chair will cover person
      const sitY = index === 3 ? chairSprite.y - 12 : chairSprite.y;
      this.player.setPosition(chairSprite.x, sitY);
      this.player.setVelocity(0, 0);
      this.isSitting = true;
      this.currentDiningChairIndex = index;
      this.player.setTexture("player_self_back");

      window.dispatchEvent(new CustomEvent("game:seat", { detail: { seat_type: "dining_chair", seat_id: index } }));

      if (this.sitPromptLabelDiningChair) this.sitPromptLabelDiningChair.setVisible(false);
      if (this.workingLabel) this.workingLabel.setVisible(false);
    }

    private standUpFromDiningChair() {
      if (!this.isSitting || this.currentDiningChairIndex === null) return;

      this.isSitting = false;
      this.currentDiningChairIndex = null;
      this.player.setTexture("player_self");
      window.dispatchEvent(new CustomEvent("game:stand_up"));

      if (this.lastNearbyDiningChair !== null && this.sitPromptLabelDiningChair) {
        const chairSprite = this.diningChairSprites[this.lastNearbyDiningChair];
        if (chairSprite) {
          this.sitPromptLabelDiningChair.setPosition(chairSprite.x, chairSprite.y - 40);
          this.sitPromptLabelDiningChair.setVisible(true);
        }
      }
    }

    private standOnTreadmill(index: number) {
      const treadmillSprite = this.treadmillSprites[index];
      if (!treadmillSprite) return;

      // Disable treadmill collision so player can overlap while standing on it
      treadmillSprite.body.enable = false;
      this.player.setPosition(treadmillSprite.x + TILE_SIZE * 0.4, treadmillSprite.y);
      this.player.setVelocity(0, 0);
      this.isOnTreadmill = true;
      this.currentTreadmillIndex = index;

      window.dispatchEvent(new CustomEvent("game:seat", { detail: { seat_type: "treadmill", seat_id: index } }));

      if (this.treadmillPromptLabel) this.treadmillPromptLabel.setVisible(false);
      // Show "<人名>在努力减肥" above player
      const playerName = this.playerConfig.display_name || "你";
      if (!this.treadmillStatusLabel) {
        this.treadmillStatusLabel = this.add
          .text(this.player.x, this.player.y - 35, `${playerName}在努力减肥`, {
            fontSize: "11px",
            color: "#fff",
            backgroundColor: "#000000aa",
            padding: { x: 6, y: 3 },
            fontFamily: "monospace",
          })
          .setOrigin(0.5)
          .setDepth(LABEL_DEPTH);
      } else {
        this.treadmillStatusLabel.setText(`${playerName}在努力减肥`);
        this.treadmillStatusLabel.setVisible(true);
      }
    }

    private standOffTreadmill() {
      if (!this.isOnTreadmill || this.currentTreadmillIndex === null) return;

      const treadmillSprite = this.treadmillSprites[this.currentTreadmillIndex];
      if (treadmillSprite?.body) {
        treadmillSprite.body.enable = true;
        // Position player slightly to the left of treadmill
        this.player.setPosition(treadmillSprite.x - TILE_SIZE * 1.2, treadmillSprite.y);
      }

      this.isOnTreadmill = false;
      this.currentTreadmillIndex = null;
      window.dispatchEvent(new CustomEvent("game:stand_up"));

      if (this.treadmillStatusLabel) this.treadmillStatusLabel.setVisible(false);

      if (this.lastNearbyTreadmill !== null && this.treadmillPromptLabel) {
        const nearbySprite = this.treadmillSprites[this.lastNearbyTreadmill];
        if (nearbySprite) {
          this.treadmillPromptLabel.setPosition(nearbySprite.x, nearbySprite.y - 40);
          this.treadmillPromptLabel.setVisible(true);
        }
      }
    }

    private updateLabels() {
      if (this.playerNameLabel) {
        this.playerNameLabel.setPosition(this.player.x, this.player.y - 28);
      }
      if (this.petNameLabel && this.pet) {
        this.petNameLabel.setPosition(
          this.pet.x,
          this.pet.y - OfficeScene.PET_DISPLAY * 0.6
        );
      }
      // Don't show additional text when sitting - only show name label
      // Update working label position when sitting at desk (for desk sitting only)
      if (this.isSitting && this.workingLabel && this.currentChairId === null) {
        // Sitting at desk (not meeting room chair)
        this.workingLabel.setPosition(this.player.x, this.player.y - 35);
      }
      // Update treadmill status label position when on treadmill
      if (this.isOnTreadmill && this.treadmillStatusLabel) {
        this.treadmillStatusLabel.setPosition(this.player.x, this.player.y - 35);
      }
      this.nameLabels.forEach((label: any, uid: number) => {
        const sprite = this.otherPlayers.get(uid);
        if (sprite) label.setPosition(sprite.x, sprite.y - 28);
      });
      this.otherWorkingLabels.forEach((label: any, uid: number) => {
        if (!label.visible) return;
        const sprite = this.otherPlayers.get(uid);
        if (sprite) label.setPosition(sprite.x, sprite.y - 35);
      });
      this.otherTreadmillLabels.forEach((label: any, uid: number) => {
        if (!label.visible) return;
        const sprite = this.otherPlayers.get(uid);
        if (sprite) label.setPosition(sprite.x, sprite.y - 35);
      });
      this.otherChairLabels.forEach((label: any, uid: number) => {
        if (!label.visible) return;
        const sprite = this.otherPlayers.get(uid);
        if (sprite) label.setPosition(sprite.x, sprite.y - 35);
      });
      if (this.deviceOccupiedLabel?.visible) {
        this.deviceOccupiedLabel.setPosition(this.player.x, this.player.y - 48);
        if (this.time.now >= this.deviceOccupiedHideAt) {
          this.deviceOccupiedLabel.setVisible(false);
        }
      }
      this.petLabels.forEach((label: any, uid: number) => {
        const pet = this.otherPets.get(uid);
        if (pet) label.setPosition(pet.x, pet.y - OfficeScene.PET_DISPLAY * 0.6);
      });
    }

    /* ---- external event bridge ---- */

    private setupExternalEvents() {
      window.addEventListener("react:control_target", ((e: CustomEvent) => {
        this.controlTarget = e.detail;
        if (this.controlTarget === "pet" && this.pet) {
          this.cameras.main.startFollow(this.pet, true, 0.1, 0.1);
        } else {
          this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        }
      }) as EventListener);

      window.addEventListener("react:user_joined", ((e: CustomEvent) => {
        this.addOtherPlayer(e.detail);
      }) as EventListener);

      window.addEventListener("react:user_left", ((e: CustomEvent) => {
        this.removeOtherPlayer(e.detail.user_id);
      }) as EventListener);

      window.addEventListener("react:entity_moved", ((e: CustomEvent) => {
        const { user_id, target, position } = e.detail;
        if (target === "pet") {
          const pet = this.otherPets.get(user_id);
          if (pet) {
            pet.setPosition(position.x, position.y);
            (pet.body as Phaser.Physics.Arcade.Body)?.setVelocity(0, 0);
          }
        } else {
          // Don't move character if they're at a desk or in a seat (desk/chair/treadmill)
          if (this.otherPlayerDesk.get(user_id) != null || this.otherPlayerSeat.get(user_id) != null) return;
          const p = this.otherPlayers.get(user_id);
          if (p) {
            p.setPosition(position.x, position.y);
            (p.body as Phaser.Physics.Arcade.Body)?.setVelocity(0, 0);
          }
        }
      }) as EventListener);

      window.addEventListener("react:sit_at_desk", ((e: CustomEvent) => {
        const desk = DESKS.find((d) => d.id === e.detail.desk_id);
        if (desk) {
          const px = desk.tileX * TILE_SIZE + TILE_SIZE * 1.5;
          // Position player between desk and chair (desk at 0.4, chair at 1.9, player at ~1.15)
          const py = desk.tileY * TILE_SIZE + TILE_SIZE * 1.15;
          this.player.setPosition(px, py);
          this.player.setVelocity(0, 0);
          this.isSitting = true;
          this.currentDeskId = e.detail.desk_id;
          // Switch to back view texture (no eyes)
          this.player.setTexture("player_self_back");
          // Hide sit prompt
          if (this.sitPromptLabel) {
            this.sitPromptLabel.setVisible(false);
          }
          // Show "正在工作" label
          const playerName = this.playerConfig.display_name || "你";
          if (!this.workingLabel) {
            this.workingLabel = this.add
              .text(px, py - 35, `${playerName}在认真工作`, {
                fontSize: "11px",
                color: "#fff",
                backgroundColor: "#000000aa",
                padding: { x: 6, y: 3 },
                fontFamily: "monospace",
              })
              .setOrigin(0.5)
              .setDepth(LABEL_DEPTH);
          } else {
            this.workingLabel.setText(`${playerName}在认真工作`);
            this.workingLabel.setPosition(px, py - 35);
            this.workingLabel.setVisible(true);
          }
        }
      }) as EventListener);

      window.addEventListener("react:stand_up", (() => {
        this.isSitting = false;
        this.currentDeskId = null;
        // Switch back to front view texture
        this.player.setTexture("player_self");
        // Hide working label
        if (this.workingLabel) {
          this.workingLabel.setVisible(false);
        }
        // Show sit prompt again if near a desk
        if (this.lastNearbyDesks.length > 0 && this.sitPromptLabel) {
          const desk = DESKS.find(d => d.id === this.lastNearbyDesks[0]);
          if (desk) {
            const px = desk.tileX * TILE_SIZE + TILE_SIZE * 1.5;
            const py = desk.tileY * TILE_SIZE + TILE_SIZE * 1.9;
            this.sitPromptLabel.setPosition(px, py - 40);
            this.sitPromptLabel.setVisible(true);
          }
        }
      }) as EventListener);

      window.addEventListener("react:seat_state", ((e: CustomEvent) => {
        const { user_id, action, seat_type, seat_id } = e.detail;
        if (user_id === this.playerConfig.id) return;
        const seat = action === "sit" ? { type: seat_type, id: seat_id } : null;
        
        // If another player just sat on the seat we're optimistically sitting on, stand up
        if (seat && seat.type === "meeting_chair" && this.currentChairId === seat.id) {
          this.standUpFromChair();
        } else if (seat && seat.type === "dining_chair" && this.currentDiningChairIndex === seat.id) {
          this.standUpFromDiningChair();
        } else if (seat && seat.type === "desk" && this.currentDeskId === seat.id) {
          // Someone else just sat at the desk we're at, stand up
          window.dispatchEvent(new CustomEvent("react:stand_up"));
        }
        
        // Update desk tracking for depth management (still needed for desk-specific depth logic)
        if (seat && seat.type === "desk") {
          this.otherPlayerDesk.set(user_id, seat.id);
        } else {
          this.otherPlayerDesk.set(user_id, null);
        }
        
        this.applyOtherPlayerSeat(user_id, seat);
      }) as EventListener);

      window.addEventListener("react:device_occupied", ((e: CustomEvent) => {
        const { device_type, device_id, occupant_name, device_name } = e.detail;
        if (device_type === "desk" && this.currentDeskId === device_id) {
          window.dispatchEvent(new CustomEvent("react:stand_up"));
        } else if (device_type === "meeting_chair" && this.currentChairId === device_id) {
          this.standUpFromChair();
        } else if (device_type === "dining_chair" && this.currentDiningChairIndex === device_id) {
          this.standUpFromDiningChair();
        } else if (device_type === "treadmill" && this.currentTreadmillIndex === device_id) {
          this.standOffTreadmill();
        }
        const msg = `${occupant_name || "有人"}正在使用，\n请排队或使用其他${device_name || "设备"}`;
        if (!this.deviceOccupiedLabel) {
          this.deviceOccupiedLabel = this.add
            .text(this.player.x, this.player.y - 48, msg, {
              fontSize: "20px",
              color: "#fff",
              backgroundColor: "#b45309cc",
              padding: { x: 8, y: 8 },
              fontFamily: "monospace",
            })
            .setOrigin(0.5)
            .setDepth(LABEL_DEPTH);
        } else {
          this.deviceOccupiedLabel.setText(msg);
          this.deviceOccupiedLabel.setPosition(this.player.x, this.player.y - 48);
        }
        this.deviceOccupiedLabel.setVisible(true);
        this.deviceOccupiedHideAt = this.time.now + 4000;
      }) as EventListener);

      window.addEventListener("react:presence_snapshot", ((e: CustomEvent) => {
        const users = e.detail.users || {};
        Object.keys(users).forEach((uid) => {
          const u = users[uid];
          this.addOtherPlayer({
            user_id: parseInt(uid),
            profile: u.profile,
            position: u.position,
            pet_position: u.pet_position,
          });
          if (u.seat) this.applyOtherPlayerSeat(parseInt(uid), u.seat);
        });
        this.applyOfficeAnimalsFromServer(e.detail.animals);
      }) as EventListener);

      window.addEventListener("react:office_animals", ((e: CustomEvent) => {
        this.applyOfficeAnimalsFromServer(e.detail?.animals);
      }) as EventListener);

      window.addEventListener("react:afk_changed", ((e: CustomEvent) => {
        const { user_id, is_afk } = e.detail;
        const label = this.nameLabels.get(user_id);
        if (!label) return;
        const baseName = this.otherPlayerNames.get(user_id) || `User ${user_id}`;
        label.setText(is_afk ? `${baseName} [AFK]` : baseName);
        label.setColor(is_afk ? "#ffa" : "#fff");
      }) as EventListener);
    }

    /* ---- other player management ---- */

    private addOtherPlayer(data: any) {
      const uid = data.user_id;
      if (this.otherPlayers.has(uid)) return;
      
      // Ensure scene is fully initialized with renderer and WebGL context ready
      if (!this.textures || !this.textures.game || !this.textures.game.renderer || !this.sys.game.renderer) {
        console.warn(`Scene not ready, deferring player addition for user ${uid}`);
        this.time.delayedCall(100, () => this.addOtherPlayer(data));
        return;
      }

      const cfg = data.profile?.avatar_config || {};
      this.otherPlayerAvatarConfig.set(uid, cfg);
      const texKey = `player_${uid}`;
      this.generateCharacterTexture(texKey, cfg);
      this.generateCharacterBackTexture(`${texKey}_back`, cfg);

      const pos = data.position || { x: 400, y: 300 };
      const sprite = this.physics.add.sprite(pos.x, pos.y, texKey);
      sprite.setDisplaySize(28, 42);
      sprite.setDepth(pos.y + 21);
      (sprite.body as Phaser.Physics.Arcade.Body).setImmovable(true);
      this.otherPlayers.set(uid, sprite);
      // Other player vs office animals (cows/horses)
      this.officeAnimals.forEach((animal) => {
        this.physics.add.collider(animal, sprite);
      });

      // Name label (store base name for later AFK updates)
      const name =
        data.profile?.display_name || data.profile?.username || `User ${uid}`;
      this.otherPlayerNames.set(uid, name);
      const afk = data.profile?.is_afk;
      const label = this.add
        .text(pos.x, pos.y - 28, afk ? `${name} [AFK]` : name, {
          fontSize: "10px",
          color: afk ? "#ffa" : "#fff",
          backgroundColor: "#00000088",
          padding: { x: 2, y: 1 },
          fontFamily: "monospace",
        })
        .setOrigin(0.5)
        .setDepth(LABEL_DEPTH);
      this.nameLabels.set(uid, label);

      // Pet
      if (
        data.profile?.has_pet &&
        data.profile?.pet_type &&
        data.pet_position
      ) {
        const petType = data.profile.pet_type;
        const textureKey = OfficeScene.IMAGE_PET_TYPES.includes(petType)
          ? "pet_" + petType
          : (this.generatePetTexture(`pet_${uid}`, petType), `pet_${uid}`);
        const petSprite = this.physics.add.sprite(
          data.pet_position.x,
          data.pet_position.y,
          textureKey,
        );
        petSprite.setDisplaySize(OfficeScene.PET_DISPLAY, OfficeScene.PET_DISPLAY);
        petSprite.setDepth(data.pet_position.y + OfficeScene.PET_DISPLAY * 0.5);
        (petSprite.body as Phaser.Physics.Arcade.Body).setImmovable(true);
        this.otherPets.set(uid, petSprite);
        // Pet label: "<人名>的<宠物类型（无后缀）>"
        const ownerName =
          data.profile?.display_name || data.profile?.username || `User ${uid}`;
        const typeName = OfficeScene.petTypeDisplayName(petType);
        const petLabel = this.add
          .text(
            data.pet_position.x,
            data.pet_position.y - OfficeScene.PET_DISPLAY * 0.6,
            `${ownerName}的${typeName}`,
            {
              fontSize: "10px",
              color: "#fff",
              backgroundColor: "#00000088",
              padding: { x: 2, y: 1 },
              fontFamily: "monospace",
            }
          )
          .setOrigin(0.5)
          .setDepth(LABEL_DEPTH);
        this.petLabels.set(uid, petLabel);
        // Other player's pet vs office animals
        this.officeAnimals.forEach((animal) => {
          this.physics.add.collider(animal, petSprite);
        });
      }
    }

    private hideOtherStatusLabels(user_id: number) {
      const w = this.otherWorkingLabels.get(user_id);
      if (w) w.setVisible(false);
      const t = this.otherTreadmillLabels.get(user_id);
      if (t) t.setVisible(false);
      const c = this.otherChairLabels.get(user_id);
      if (c) c.setVisible(false);
    }

    /** Apply seat state for another player (desk is handled by react:desk_state). */
    private applyOtherPlayerSeat(
      user_id: number,
      seat: { type: string; id: number } | null,
    ) {
      const p = this.otherPlayers.get(user_id);
      if (!p) return;
      const texKey = `player_${user_id}`;
      const name = this.otherPlayerNames.get(user_id) || `User ${user_id}`;
      this.otherPlayerSeat.set(user_id, seat);
      this.hideOtherStatusLabels(user_id);
      if (!seat) {
        if (this.textures.exists(texKey)) p.setTexture(texKey);
        return;
      }
      let x = 0;
      let y = 0;
      if (seat.type === "desk") {
        const desk = DESKS.find((d) => d.id === seat.id);
        if (!desk) return;
        x = desk.tileX * TILE_SIZE + TILE_SIZE * 1.5;
        y = desk.tileY * TILE_SIZE + TILE_SIZE * 1.15;
        // Show "XXX在认真工作" label for other players at desk
        let workLab = this.otherWorkingLabels.get(user_id);
        if (!workLab) {
          workLab = this.add
            .text(x, y - 35, `${name}在认真工作`, {
              fontSize: "11px",
              color: "#fff",
              backgroundColor: "#000000aa",
              padding: { x: 6, y: 3 },
              fontFamily: "monospace",
            })
            .setOrigin(0.5)
            .setDepth(LABEL_DEPTH + 1);
          this.otherWorkingLabels.set(user_id, workLab);
        } else {
          workLab.setText(`${name}在认真工作`);
          workLab.setPosition(x, y - 35);
        }
        workLab.setVisible(true);
      } else if (seat.type === "meeting_chair") {
        const chairSprite = this.meetingRoomChairs.get(seat.id);
        if (!chairSprite) return;
        x = chairSprite.x;
        y = chairSprite.y;
        // Show "XXX在休息" label for other players (visible on all clients)
        let chairLab = this.otherChairLabels.get(user_id);
        if (!chairLab) {
          chairLab = this.add
            .text(x, y - 35, `${name}在开会`, {
              fontSize: "11px",
              color: "#fff",
              backgroundColor: "#000000aa",
              padding: { x: 6, y: 3 },
              fontFamily: "monospace",
            })
            .setOrigin(0.5)
            .setDepth(LABEL_DEPTH);
          this.otherChairLabels.set(user_id, chairLab);
        } else {
          chairLab.setText(`${name}在开会`);
          chairLab.setPosition(x, y - 35);
        }
        chairLab.setVisible(true);
      } else if (seat.type === "dining_chair") {
        const chairSprite = this.diningChairSprites[seat.id];
        if (!chairSprite) return;
        x = chairSprite.x;
        y = seat.id === 3 ? chairSprite.y - 12 : chairSprite.y;
        // Show "XXX在休息" label for other players (visible on all clients)
        let chairLab = this.otherChairLabels.get(user_id);
        if (!chairLab) {
          chairLab = this.add
            .text(x, y - 35, `${name}在休息`, {
              fontSize: "11px",
              color: "#fff",
              backgroundColor: "#000000aa",
              padding: { x: 6, y: 3 },
              fontFamily: "monospace",
            })
            .setOrigin(0.5)
            .setDepth(LABEL_DEPTH);
          this.otherChairLabels.set(user_id, chairLab);
        } else {
          chairLab.setText(`${name}在休息`);
          chairLab.setPosition(x, y - 35);
        }
        chairLab.setVisible(true);
      } else if (seat.type === "treadmill") {
        const treadmillSprite = this.treadmillSprites[seat.id];
        if (!treadmillSprite) return;
        x = treadmillSprite.x + TILE_SIZE * 0.4;
        y = treadmillSprite.y;
        let lab = this.otherTreadmillLabels.get(user_id);
        if (!lab) {
          lab = this.add
            .text(x, y - 35, `${name}在努力减肥`, {
              fontSize: "11px",
              color: "#fff",
              backgroundColor: "#000000aa",
              padding: { x: 6, y: 3 },
              fontFamily: "monospace",
            })
            .setOrigin(0.5)
            .setDepth(LABEL_DEPTH);
          this.otherTreadmillLabels.set(user_id, lab);
        } else {
          lab.setText(`${name}在努力减肥`);
          lab.setPosition(x, y - 35);
        }
        lab.setVisible(true);
      } else {
        return;
      }
      p.setPosition(x, y);
      (p.body as Phaser.Physics.Arcade.Body)?.setVelocity(0, 0);
      // Ensure back texture exists (for sitting pose on all clients)
      const backKey = `${texKey}_back`;
      if (!this.textures.exists(backKey)) {
        const cfg = this.otherPlayerAvatarConfig.get(user_id) || {};
        this.generateCharacterBackTexture(backKey, cfg);
      }
      if (this.textures.exists(backKey)) p.setTexture(backKey);
    }

    private removeOtherPlayer(uid: number) {
      const sprite = this.otherPlayers.get(uid);
      if (sprite) {
        sprite.destroy();
        this.otherPlayers.delete(uid);
      }
      const label = this.nameLabels.get(uid);
      if (label) {
        label.destroy();
        this.nameLabels.delete(uid);
      }
      this.otherPlayerNames.delete(uid);
      this.otherPlayerDesk.delete(uid);
      this.otherPlayerSeat.delete(uid);
      const wLab = this.otherWorkingLabels.get(uid);
      if (wLab) {
        wLab.destroy();
        this.otherWorkingLabels.delete(uid);
      }
      const tLab = this.otherTreadmillLabels.get(uid);
      if (tLab) {
        tLab.destroy();
        this.otherTreadmillLabels.delete(uid);
      }
      const cLab = this.otherChairLabels.get(uid);
      if (cLab) {
        cLab.destroy();
        this.otherChairLabels.delete(uid);
      }
      this.otherPlayerAvatarConfig.delete(uid);
      const pet = this.otherPets.get(uid);
      if (pet) {
        pet.destroy();
        this.otherPets.delete(uid);
      }
      const petLabel = this.petLabels.get(uid);
      if (petLabel) {
        petLabel.destroy();
        this.petLabels.delete(uid);
      }
    }

    /* ---- texture generators (character & pet) ---- */

    private generateCharacterTexture(key: string, cfg: any) {
      if (this.textures.exists(key)) return;
      
      // Ensure renderer is ready before generating textures
      if (!this.textures || !this.textures.game || !this.textures.game.renderer || !this.sys.game.renderer) {
        console.warn(`Renderer not ready for texture generation: ${key}`);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 30; // Increased from 24 to 27 to accommodate longer legs
      const ctx = canvas.getContext("2d")!;

      const skin = SKIN_COLORS[cfg?.skin_color ?? 0] || SKIN_COLORS[0];
      const hair = HAIR_COLORS[cfg?.hair_color ?? 0] || HAIR_COLORS[0];
      const top = CLOTHING_COLORS[cfg?.top_color ?? 0] || CLOTHING_COLORS[0];
      const bottom =
        CLOTHING_COLORS[cfg?.bottom_color ?? 2] || CLOTHING_COLORS[2];
      const shoes =
        CLOTHING_COLORS[cfg?.shoes_color ?? 9] || CLOTHING_COLORS[9];

      // Head
      ctx.fillStyle = skin;
      ctx.fillRect(4, 1, 8, 7);

      // Hair
      ctx.fillStyle = hair;
      const style = cfg?.hair_style ?? 0;
      switch (style) {
        case 1:
          ctx.fillRect(3, 0, 10, 4);
          ctx.fillRect(3, 4, 2, 4);
          ctx.fillRect(11, 4, 2, 4);
          break;
        case 2:
          ctx.fillRect(4, 0, 8, 2);
          ctx.fillRect(5, 0, 2, 1);
          ctx.fillRect(9, 0, 2, 1);
          ctx.fillRect(7, 0, 2, 1);
          break;
        case 3:
          break;
        case 4:
          ctx.fillRect(3, 0, 10, 3);
          ctx.fillRect(3, 3, 3, 2);
          break;
        default:
          ctx.fillRect(4, 0, 8, 3);
          break;
      }

      // Eyes
      ctx.fillStyle = "#000";
      ctx.fillRect(6, 4, 1, 1);
      ctx.fillRect(9, 4, 1, 1);

      // Mouth
      ctx.fillStyle = "#c0756b";
      ctx.fillRect(7, 6, 2, 1);

      // Body
      ctx.fillStyle = top;
      ctx.fillRect(3, 8, 10, 6);
      ctx.fillRect(1, 9, 2, 4);
      ctx.fillRect(13, 9, 2, 4);

      // Hands
      ctx.fillStyle = skin;
      ctx.fillRect(1, 13, 2, 1);
      ctx.fillRect(13, 13, 2, 1);

      // Legs (height increased by 3 pixels: 6 -> 9)
      ctx.fillStyle = bottom;
      ctx.fillRect(4, 14, 3, 12);
      ctx.fillRect(9, 14, 3, 12);

      // Shoes (moved down to accommodate longer legs)
      ctx.fillStyle = shoes;
      ctx.fillRect(3, 23, 4, 3);
      ctx.fillRect(9, 23, 4, 3);

      this.textures.addCanvas(key, canvas);
    }

    private generateCharacterBackTexture(key: string, cfg: any) {
      if (this.textures.exists(key)) return;
      
      // Ensure renderer is ready before generating textures
      if (!this.textures || !this.textures.game || !this.textures.game.renderer || !this.sys.game.renderer) {
        console.warn(`Renderer not ready for back texture generation: ${key}`);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 27; // Increased from 24 to 27 to accommodate longer legs
      const ctx = canvas.getContext("2d")!;

      const skin = SKIN_COLORS[cfg?.skin_color ?? 0] || SKIN_COLORS[0];
      const hair = HAIR_COLORS[cfg?.hair_color ?? 0] || HAIR_COLORS[0];
      const top = CLOTHING_COLORS[cfg?.top_color ?? 0] || CLOTHING_COLORS[0];
      const bottom =
        CLOTHING_COLORS[cfg?.bottom_color ?? 2] || CLOTHING_COLORS[2];
      const shoes =
        CLOTHING_COLORS[cfg?.shoes_color ?? 9] || CLOTHING_COLORS[9];

      // Head (back view - no eyes/mouth)
      ctx.fillStyle = skin;
      ctx.fillRect(4, 1, 8, 7);

      // Hair (back view - show more hair on back)
      ctx.fillStyle = hair;
      const style = cfg?.hair_style ?? 0;
      switch (style) {
        case 1:
          // Long hair - show more on back
          ctx.fillRect(3, 0, 10, 5);
          ctx.fillRect(2, 2, 2, 4);
          ctx.fillRect(12, 2, 2, 4);
          break;
        case 2:
          // Short hair - simple back view
          ctx.fillRect(4, 0, 8, 3);
          break;
        case 3:
          // Bald - no hair
          break;
        case 4:
          // Medium hair
          ctx.fillRect(3, 0, 10, 4);
          ctx.fillRect(2, 2, 2, 3);
          break;
        default:
          // Default - show hair on back
          ctx.fillRect(4, 0, 8, 4);
          break;
      }

      // No eyes or mouth for back view

      // Body (same as front)
      ctx.fillStyle = top;
      ctx.fillRect(3, 8, 10, 6);
      ctx.fillRect(1, 9, 2, 4);
      ctx.fillRect(13, 9, 2, 4);

      // Hands
      ctx.fillStyle = skin;
      ctx.fillRect(1, 13, 2, 1);
      ctx.fillRect(13, 13, 2, 1);

      // Legs (height increased by 3 pixels: 6 -> 9)
      ctx.fillStyle = bottom;
      ctx.fillRect(4, 14, 3, 9);
      ctx.fillRect(9, 14, 3, 9);

      // Shoes (moved down to accommodate longer legs)
      ctx.fillStyle = shoes;
      ctx.fillRect(3, 23, 4, 3);
      ctx.fillRect(9, 23, 4, 3);

      this.textures.addCanvas(key, canvas);
    }

    private generatePetTexture(key: string, petType: string) {
      if (this.textures.exists(key)) return;
      if (OfficeScene.IMAGE_PET_TYPES.includes(petType)) return; // use preloaded image texture
      
      // Ensure renderer is ready before generating textures
      if (!this.textures || !this.textures.game || !this.textures.game.renderer || !this.sys.game.renderer) {
        console.warn(`Renderer not ready for pet texture generation: ${key}`);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext("2d")!;
      const color = PET_COLORS[petType] || "#888";

      ctx.fillStyle = color;

      switch (petType) {
        case "cat":
          ctx.fillRect(4, 6, 8, 6);
          ctx.fillRect(5, 2, 6, 5);
          ctx.fillRect(5, 0, 2, 3);
          ctx.fillRect(9, 0, 2, 3);
          ctx.fillRect(12, 5, 3, 2);
          ctx.fillRect(14, 3, 2, 2);
          ctx.fillStyle = "#000";
          ctx.fillRect(6, 4, 1, 1);
          ctx.fillRect(9, 4, 1, 1);
          ctx.fillStyle = color;
          ctx.fillRect(5, 12, 2, 4);
          ctx.fillRect(9, 12, 2, 4);
          break;

        case "dog":
          ctx.fillRect(4, 6, 8, 6);
          ctx.fillRect(5, 2, 6, 5);
          ctx.fillRect(4, 2, 2, 5);
          ctx.fillRect(10, 2, 2, 5);
          ctx.fillRect(12, 6, 3, 2);
          ctx.fillStyle = "#000";
          ctx.fillRect(6, 4, 1, 1);
          ctx.fillRect(9, 4, 1, 1);
          ctx.fillStyle = "#333";
          ctx.fillRect(7, 5, 2, 1);
          ctx.fillStyle = color;
          ctx.fillRect(5, 12, 2, 4);
          ctx.fillRect(9, 12, 2, 4);
          break;

        case "snake":
          ctx.fillRect(2, 8, 12, 3);
          ctx.fillRect(1, 6, 4, 3);
          ctx.fillRect(12, 6, 3, 4);
          ctx.fillRect(14, 4, 2, 3);
          ctx.fillStyle = "#000";
          ctx.fillRect(2, 7, 1, 1);
          ctx.fillStyle = "#f00";
          ctx.fillRect(1, 9, 2, 1);
          break;

        case "crab":
          ctx.fillRect(4, 6, 8, 6);
          ctx.fillRect(1, 4, 3, 4);
          ctx.fillRect(12, 4, 3, 4);
          ctx.fillRect(0, 4, 2, 2);
          ctx.fillRect(14, 4, 2, 2);
          ctx.fillStyle = "#000";
          ctx.fillRect(6, 7, 1, 1);
          ctx.fillRect(9, 7, 1, 1);
          ctx.fillStyle = color;
          ctx.fillRect(5, 12, 2, 3);
          ctx.fillRect(9, 12, 2, 3);
          break;

        case "rabbit":
          ctx.fillRect(5, 6, 6, 6);
          ctx.fillRect(6, 3, 4, 4);
          ctx.fillRect(6, 0, 2, 4);
          ctx.fillRect(8, 0, 2, 4);
          ctx.fillStyle = "#FFB6C1";
          ctx.fillRect(6.5, 1, 1, 2);
          ctx.fillRect(8.5, 1, 1, 2);
          ctx.fillStyle = "#000";
          ctx.fillRect(7, 5, 1, 1);
          ctx.fillRect(9, 5, 1, 1);
          ctx.fillStyle = color;
          ctx.fillRect(5, 12, 2, 3);
          ctx.fillRect(9, 12, 2, 3);
          ctx.fillRect(7, 11, 3, 3);
          break;

        case "gecko":
        case "lizard":
          ctx.fillRect(3, 7, 10, 4);
          ctx.fillRect(4, 5, 5, 3);
          ctx.fillRect(12, 8, 4, 2);
          ctx.fillStyle = "#000";
          ctx.fillRect(5, 6, 1, 1);
          ctx.fillRect(7, 6, 1, 1);
          ctx.fillStyle = color;
          ctx.fillRect(3, 11, 2, 3);
          ctx.fillRect(9, 11, 2, 3);
          break;

        case "turtle":
          ctx.fillStyle = "#4CAF50";
          ctx.fillRect(4, 5, 8, 8);
          ctx.fillStyle = color;
          ctx.fillRect(3, 6, 10, 6);
          ctx.fillRect(2, 7, 3, 3);
          ctx.fillStyle = "#000";
          ctx.fillRect(3, 8, 1, 1);
          ctx.fillStyle = color;
          ctx.fillRect(4, 12, 2, 3);
          ctx.fillRect(10, 12, 2, 3);
          break;

        case "bird":
          ctx.fillRect(5, 4, 6, 6);
          ctx.fillRect(10, 6, 4, 3);
          ctx.fillStyle = "#FF9800";
          ctx.fillRect(13, 7, 3, 1);
          ctx.fillStyle = "#000";
          ctx.fillRect(7, 5, 1, 1);
          ctx.fillStyle = color;
          ctx.fillRect(3, 3, 3, 4);
          ctx.fillRect(6, 10, 2, 3);
          ctx.fillRect(9, 10, 2, 3);
          break;

        default:
          ctx.fillRect(4, 4, 8, 8);
          break;
      }

      this.textures.addCanvas(key, canvas);
    }
  };
}
