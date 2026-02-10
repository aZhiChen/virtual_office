"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const PRESETS = [
  {
    label: "Enthusiastic & Talkative",
    text: "热情开朗，喜欢和同事聊天，经常讲冷笑话，回复时语气活泼有趣。",
  },
  {
    label: "Quiet & Reserved",
    text: "内敛安静，只在被问到时才简短回答，偶尔会说一些有深度的话。",
  },
  {
    label: "Tech Geek",
    text: "技术宅，回复时喜欢用代码和术语，偶尔会发一些编程相关的梗。",
  },
  {
    label: "Foodie",
    text: "吃货一枚，一切话题都会扯到美食上，经常推荐好吃的餐厅和零食。",
  },
  {
    label: "Professional",
    text: "职场达人，回复专业且高效，偶尔会引用一些管理名言或工作方法论。",
  },
];

const EXAMPLE_QUESTIONS = [
  "Hey, how are you doing today?",
  "Want to grab some coffee?",
  "Have you finished the report?",
];

const MAX_LENGTH = 500;

export default function PersonalityPage() {
  const router = useRouter();
  const [personality, setPersonality] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testReply, setTestReply] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    api
      .getProfile()
      .then((p) => {
        if (p.personality) setPersonality(p.personality);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updatePersonality(personality);
      router.push("/office");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!personality.trim()) {
      setTestReply("Please write a personality description first.");
      return;
    }
    setTesting(true);
    setTestReply("");
    try {
      const question =
        EXAMPLE_QUESTIONS[Math.floor(Math.random() * EXAMPLE_QUESTIONS.length)];
      const res = await api.testPersonality(personality, question);
      setTestReply(`Q: "${question}"\n\nA: ${res.reply}`);
    } catch (err) {
      setTestReply(
        err instanceof Error ? err.message : "Test failed — is the LLM configured?"
      );
    } finally {
      setTesting(false);
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
      <h1 className="text-2xl mb-2 tracking-wider">Character Personality</h1>
      <p className="text-xs text-gray-400 mb-6 max-w-lg text-center">
        Describe your character&apos;s personality below. This text will be used as the
        AI prompt so your character can auto-reply when you&apos;re in AFK mode.
      </p>

      <div className="flex flex-col lg:flex-row gap-6 max-w-5xl w-full">
        {/* Left: Input area */}
        <div className="flex-1 space-y-4">
          <div className="pixel-panel">
            <label className="block text-sm mb-2 text-gray-300">
              Personality Description
            </label>
            <textarea
              className="pixel-input w-full h-40 resize-none"
              value={personality}
              onChange={(e) => {
                if (e.target.value.length <= MAX_LENGTH) setPersonality(e.target.value);
              }}
              placeholder="Describe your character's personality, speaking style, interests..."
            />
            <div className="text-right text-xs text-gray-500 mt-1">
              {personality.length}/{MAX_LENGTH}
            </div>
          </div>

          {/* Presets */}
          <div className="pixel-panel">
            <p className="text-sm text-gray-300 mb-2">Quick Presets</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  className="pixel-btn text-xs"
                  onClick={() => setPersonality(p.text)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              className="pixel-btn text-xs"
              onClick={() => router.push("/customize")}
            >
              &lt;&lt; Back
            </button>
            <button
              className="pixel-btn text-xs"
              onClick={() => {
                setPersonality("");
                router.push("/office");
              }}
            >
              Skip
            </button>
            <button
              className="pixel-btn flex-1"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save & Enter Office >>"}
            </button>
          </div>
        </div>

        {/* Right: Preview / Test */}
        <div className="w-full lg:w-80 space-y-4">
          <div className="pixel-panel">
            <p className="text-sm text-gray-300 mb-2">Test Auto-Reply</p>
            <p className="text-[10px] text-gray-500 mb-3">
              Click below to simulate a conversation. The AI will reply using your
              personality description.
            </p>
            <button
              className="pixel-btn text-xs w-full mb-3"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? "Generating..." : "Test Reply"}
            </button>

            {testReply && (
              <div className="pixel-panel !bg-[#0a0a1a] text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">
                {testReply}
              </div>
            )}
          </div>

          {/* Explanation */}
          <div className="pixel-panel text-[11px] text-gray-400 space-y-2">
            <p>
              <strong className="text-gray-300">How it works:</strong>
            </p>
            <p>
              When you turn on AFK mode in the office, other users can still
              chat with your character. The AI will read your personality
              description and reply on your behalf, matching the style you
              defined.
            </p>
            <p>
              You can always edit your personality later from the office
              settings menu.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
