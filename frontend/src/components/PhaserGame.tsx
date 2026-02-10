"use client";

import { useEffect, useRef } from "react";

interface PhaserGameProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerConfig: any;
}

export default function PhaserGame({ playerConfig }: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);

  useEffect(() => {
    if (gameRef.current) return;

    let destroyed = false;

    async function init() {
      const Phaser = (await import("phaser")).default;
      const { createOfficeScene } = await import("@/game/scenes/OfficeScene");

      if (destroyed || !containerRef.current) return;

      const OfficeSceneClass = createOfficeScene(Phaser);

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: 800,
        height: 600,
        pixelArt: true,
        backgroundColor: "#1a1a2e",
        physics: {
          default: "arcade",
          arcade: { gravity: { x: 0, y: 0 }, debug: false },
        },
        scene: [], // don't auto-start; we add manually below
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        input: {
          keyboard: true,
        },
      };

      const game = new Phaser.Game(config);
      gameRef.current = game;

      // Add the scene and start it with player data
      game.events.once("ready", () => {
        if (destroyed) return;
        game.scene.add("OfficeScene", OfficeSceneClass, true, playerConfig);
      });
    }

    init();

    return () => {
      destroyed = true;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: "400px" }}
    />
  );
}
