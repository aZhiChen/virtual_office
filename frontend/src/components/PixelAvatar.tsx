"use client";

import { useRef, useEffect } from "react";
import { SKIN_COLORS, HAIR_COLORS, CLOTHING_COLORS } from "@/game/sprites/colors";

export interface AvatarConfig {
  skin_color: number;
  hair_style: number;
  hair_color: number;
  top_color: number;
  bottom_color: number;
  shoes_color: number;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  skin_color: 0,
  hair_style: 0,
  hair_color: 0,
  top_color: 0,
  bottom_color: 2,
  shoes_color: 9,
};

interface Props {
  config: AvatarConfig;
  size?: number;
}

export default function PixelAvatar({ config, size = 128 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 16, 24);

    const skin = SKIN_COLORS[config.skin_color] || SKIN_COLORS[0];
    const hair = HAIR_COLORS[config.hair_color] || HAIR_COLORS[0];
    const top = CLOTHING_COLORS[config.top_color] || CLOTHING_COLORS[0];
    const bottom = CLOTHING_COLORS[config.bottom_color] || CLOTHING_COLORS[2];
    const shoes = CLOTHING_COLORS[config.shoes_color] || CLOTHING_COLORS[9];

    // Head
    ctx.fillStyle = skin;
    ctx.fillRect(4, 1, 8, 7);

    // Hair
    ctx.fillStyle = hair;
    switch (config.hair_style) {
      case 1: // long
        ctx.fillRect(3, 0, 10, 4);
        ctx.fillRect(3, 4, 2, 4);
        ctx.fillRect(11, 4, 2, 4);
        break;
      case 2: // spiky
        ctx.fillRect(4, 0, 8, 2);
        ctx.fillRect(5, 0, 2, 1);
        ctx.fillRect(9, 0, 2, 1);
        ctx.fillRect(7, 0, 2, 1);
        break;
      case 3: // bald
        break;
      case 4: // side-part
        ctx.fillRect(3, 0, 10, 3);
        ctx.fillRect(3, 3, 3, 2);
        break;
      default: // 0: short
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

    // Legs
    ctx.fillStyle = bottom;
    ctx.fillRect(4, 14, 3, 6);
    ctx.fillRect(9, 14, 3, 6);

    // Shoes
    ctx.fillStyle = shoes;
    ctx.fillRect(3, 20, 4, 3);
    ctx.fillRect(9, 20, 4, 3);
  }, [config]);

  return (
    <canvas
      ref={canvasRef}
      width={16}
      height={24}
      style={{
        width: size,
        height: size * 1.5,
        imageRendering: "pixelated",
      }}
    />
  );
}
