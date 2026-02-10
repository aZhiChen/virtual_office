"use client";

interface Props {
  controlTarget: "character" | "pet";
  hasPet: boolean;
  isAfk: boolean;
  isSitting: boolean;
  onToggleControl: () => void;
  onToggleAfk: () => void;
  onStandUp: () => void;
}

export default function ControlToggle({
  controlTarget,
  hasPet,
  isAfk,
  isSitting,
  onToggleControl,
  onToggleAfk,
  onStandUp,
}: Props) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* AFK toggle */}
      <button
        className={`pixel-btn text-xs ${isAfk ? "!bg-yellow-700" : ""}`}
        onClick={onToggleAfk}
      >
        {isAfk ? "AFK: ON" : "AFK: OFF"}
      </button>

      {/* Control target toggle */}
      {hasPet && (
        <button className="pixel-btn text-xs" onClick={onToggleControl}>
          Control: {controlTarget === "character" ? "Character" : "Pet"}
        </button>
      )}

      {/* Stand up (only when sitting) */}
      {isSitting && (
        <button className="pixel-btn text-xs !bg-green-800" onClick={onStandUp}>
          Stand Up
        </button>
      )}
    </div>
  );
}
