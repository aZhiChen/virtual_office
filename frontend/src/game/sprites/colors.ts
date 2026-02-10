/** Colour palettes for avatar customisation */

export const SKIN_COLORS = [
  "#FFDBB4",
  "#EEB07C",
  "#C68642",
  "#8D5524",
  "#6B3A1F",
];

export const HAIR_COLORS = [
  "#2C1B18",
  "#4A2912",
  "#8B4513",
  "#D2691E",
  "#FFD700",
  "#FF4500",
  "#FF69B4",
  "#E8E8E8",
];

export const CLOTHING_COLORS = [
  "#FF6B6B", // 0  red
  "#4ECDC4", // 1  teal
  "#45B7D1", // 2  blue
  "#96CEB4", // 3  sage
  "#FFEAA7", // 4  yellow
  "#DDA0DD", // 5  plum
  "#98D8C8", // 6  mint
  "#F7DC6F", // 7  gold
  "#FFFFFF", // 8  white
  "#2C3E50", // 9  dark
  "#95A5A6", // 10 grey
  "#FFB6C1", // 11 pink
];

/** Pet colours by type (used for UI border; image pets use a default) */
export const PET_COLORS: Record<string, string> = {
  cat: "#FFA500",
  dog: "#C69C6D",
  snake: "#4CAF50",
  crab: "#FF5722",
  rabbit: "#F5F5F5",
  gecko: "#8BC34A",
  lizard: "#689F38",
  turtle: "#607D8B",
  bird: "#42A5F5",
  // Image-based pets from /img/animals (except cow, horse)
  cat1: "#FFA500",
  cat2: "#DEB887",
  cat3: "#8B4513",
  cat4: "#D2691E",
  dog1: "#C69C6D",
  dog2: "#654321",
};
