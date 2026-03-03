"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import PixelAvatar, { AvatarConfig, DEFAULT_AVATAR } from "@/components/PixelAvatar";
import { SKIN_COLORS, HAIR_COLORS, CLOTHING_COLORS, PET_COLORS } from "@/game/sprites/colors";

const HAIR_STYLES = [
  { id: 0, name: "Short" },
  { id: 1, name: "Long" },
  { id: 2, name: "Spiky" },
  { id: 3, name: "Bald" },
  { id: 4, name: "Side Part" },
];

const PET_TYPES = [
  "cat1", "cat2", "cat3", "cat4",
  "dog1", "dog2",
  "lizard", "snake", "crab", "rabbit", "turtle", "bird",
];

export default function CustomizePage() {
  const router = useRouter();
  const [avatar, setAvatar] = useState<AvatarConfig>({ ...DEFAULT_AVATAR });
  const [hasPet, setHasPet] = useState(false);
  const [petType, setPetType] = useState("cat");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load existing profile
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    api
      .getProfile()
      .then((p) => {
        if (p.avatar_config && Object.keys(p.avatar_config).length > 0) {
          setAvatar({ ...DEFAULT_AVATAR, ...p.avatar_config });
        }
        setHasPet(p.has_pet);
        if (p.pet_type) setPetType(p.pet_type);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  const updateField = (field: keyof AvatarConfig, value: number) => {
    setAvatar((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateAvatar(avatar);
      await api.updatePet(hasPet, hasPet ? petType : "");
      router.push("/customize/personality");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 flex flex-col items-center">
      <h1 className="text-2xl mb-6 tracking-wider">Customize Your Character</h1>

      <div className="flex flex-col lg:flex-row gap-8 max-w-5xl w-full">
        {/* Left: Preview */}
        <div className="pixel-panel flex flex-col items-center justify-center min-w-[200px]">
          <p className="text-xs text-gray-400 mb-2">Preview</p>
          <PixelAvatar config={avatar} size={160} />
          {hasPet && (
            <div className="mt-4 flex flex-col items-center">
              <p className="text-xs text-gray-400 mb-1">Pet: {petType}</p>
              <PetPreview petType={petType} />
            </div>
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex-1 space-y-6">
          {/* Skin */}
          <Section title="Skin Tone">
            <ColorRow
              colors={SKIN_COLORS}
              selected={avatar.skin_color}
              onSelect={(i) => updateField("skin_color", i)}
            />
          </Section>

          {/* Hair style */}
          <Section title="Hair Style">
            <div className="flex flex-wrap gap-2">
              {HAIR_STYLES.map((h) => (
                <button
                  key={h.id}
                  className={`pixel-btn text-xs ${avatar.hair_style === h.id ? "!bg-[var(--pixel-accent)]" : ""}`}
                  onClick={() => updateField("hair_style", h.id)}
                >
                  {h.name}
                </button>
              ))}
            </div>
          </Section>

          {/* Hair colour */}
          <Section title="Hair Color">
            <ColorRow
              colors={HAIR_COLORS}
              selected={avatar.hair_color}
              onSelect={(i) => updateField("hair_color", i)}
            />
          </Section>

          {/* Top */}
          <Section title="Shirt Color">
            <ColorRow
              colors={CLOTHING_COLORS}
              selected={avatar.top_color}
              onSelect={(i) => updateField("top_color", i)}
            />
          </Section>

          {/* Bottom */}
          <Section title="Pants Color">
            <ColorRow
              colors={CLOTHING_COLORS}
              selected={avatar.bottom_color}
              onSelect={(i) => updateField("bottom_color", i)}
            />
          </Section>

          {/* Shoes */}
          <Section title="Shoes Color">
            <ColorRow
              colors={CLOTHING_COLORS}
              selected={avatar.shoes_color}
              onSelect={(i) => updateField("shoes_color", i)}
            />
          </Section>

          {/* Pet */}
          <Section title="Virtual Pet">
            <div className="flex items-center gap-4 mb-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasPet}
                  onChange={(e) => setHasPet(e.target.checked)}
                  className="w-4 h-4"
                />
                Adopt a pet
              </label>
            </div>
            {hasPet && (
              <div className="flex flex-wrap gap-2">
                {PET_TYPES.map((pt) => (
                  <button
                    key={pt}
                    className={`pixel-btn text-xs capitalize ${petType === pt ? "!bg-[var(--pixel-accent)]" : ""}`}
                    onClick={() => setPetType(pt)}
                    style={{
                      borderLeftColor: PET_COLORS[pt],
                      borderLeftWidth: 4,
                    }}
                  >
                    {pt}
                  </button>
                ))}
              </div>
            )}
          </Section>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button className="pixel-btn flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Next: Set Personality >>"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Helper components ---- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pixel-panel">
      <h3 className="text-sm mb-2 text-gray-300">{title}</h3>
      {children}
    </div>
  );
}

function ColorRow({
  colors,
  selected,
  onSelect,
}: {
  colors: string[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c, i) => (
        <button
          key={i}
          className="w-8 h-8 border-2 transition-all"
          style={{
            backgroundColor: c,
            borderColor: selected === i ? "#e94560" : "#555",
            transform: selected === i ? "scale(1.15)" : "scale(1)",
          }}
          onClick={() => onSelect(i)}
          title={c}
        />
      ))}
    </div>
  );
}

const IMAGE_PET_TYPES = ["cat1", "cat2", "cat3", "cat4", "dog1", "dog2", "lizard", "crab", "rabbit", "snake", "turtle", "bird"];

function PetPreview({ petType }: { petType: string }) {
  const canvasRef = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (IMAGE_PET_TYPES.includes(petType)) return; // image shown via <img> below
    const canvas = document.getElementById("pet-preview-canvas") as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 16, 16);
    const color = PET_COLORS[petType] || "#888";
    ctx.fillStyle = color;

    switch (petType) {
      default:
        ctx.fillRect(4, 4, 8, 8);
        ctx.fillStyle = "#000";
        ctx.fillRect(6, 6, 1, 1);
        ctx.fillRect(9, 6, 1, 1);
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petType]);

  void canvasRef; // suppress unused

  if (IMAGE_PET_TYPES.includes(petType)) {
    return (
      <img
        src={`/img/animals/${petType}.png`}
        alt={petType}
        width={64}
        height={64}
        style={{ imageRendering: "pixelated" }}
      />
    );
  }

  return (
    <canvas
      id="pet-preview-canvas"
      width={16}
      height={16}
      style={{ width: 64, height: 64, imageRendering: "pixelated" }}
    />
  );
}
