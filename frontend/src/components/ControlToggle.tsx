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
    <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap shrink-0">
      {/* AFK toggle */}
      <button
        className={`pixel-btn text-[10px] sm:text-xs shrink-0 ${isAfk ? "!bg-yellow-700" : ""}`}
        onClick={onToggleAfk}
      >
        {isAfk ? "AFK: ON" : "AFK: OFF"}
      </button>

      {/* Control target toggle */}
      {hasPet && (
        <button className="pixel-btn text-[10px] sm:text-xs shrink-0" onClick={onToggleControl}>
          Control: {controlTarget === "character" ? "Character" : "Pet"}
        </button>
      )}

      {/* Stand up (only when sitting) */}
      {isSitting && (
        <button className="pixel-btn text-[10px] sm:text-xs shrink-0 !bg-green-800" onClick={onStandUp}>
          Stand Up
        </button>
      )}
    </div>
  );
}
