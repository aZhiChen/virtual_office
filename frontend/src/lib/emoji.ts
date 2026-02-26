/**
 * Emoji/sticker list. Add new filenames here when adding images to /public/img/emoji/
 * Images should be placed in: frontend/public/img/emoji/
 */
export const EMOJI_LIST = [
  "1.png",
  "2.png",
  "3.png",
  "4.png",
  "5.png",
  "6.png",
  "7.png",
  "8.png",
  "9.png",
  "10.png",
  "11.png",
  "12.png",
  "13.png",
  "14.png",
  "15.png",
  "16.png",
  "17.png",
  "18.png",
  "19.png",
  "20.png",
  "21.png",
  "22.png",
  "23.png",
  "24.png",
  "25.png",
  "26.png",
  "27.png",
  "28.png",
  "29.png",
  "30.png",
  "31.png",
  "32.png",
  "33.png",
  "34.png",
  "35.png",
  "36.png",
  "37.png",
  "38.png",
  "39.png",
  "40.png",
  "41.png",
  "42.png",
  "43.png",
  "44.png",
  "45.png",
] as const;

export const EMOJI_BASE_PATH = "/img/emoji";

export function getEmojiUrl(filename: string): string {
  return `${EMOJI_BASE_PATH}/${filename}`;
}

/** Format for sending emoji in chat - backend stores as plain string */
export const EMOJI_PREFIX = "[emoji:";
export const EMOJI_SUFFIX = "]";

export function formatEmojiMessage(filename: string): string {
  return `${EMOJI_PREFIX}${filename}${EMOJI_SUFFIX}`;
}

export function isEmojiMessage(message: string): boolean {
  return message.startsWith(EMOJI_PREFIX) && message.endsWith(EMOJI_SUFFIX);
}

export function parseEmojiMessage(message: string): string | null {
  if (!isEmojiMessage(message)) return null;
  return message.slice(EMOJI_PREFIX.length, -EMOJI_SUFFIX.length);
}

/** Parse mixed message (text + emoji) into segments for rendering */
export function parseMixedMessage(message: string): Array<{ type: "text"; value: string } | { type: "emoji"; filename: string }> {
  const segments: Array<{ type: "text"; value: string } | { type: "emoji"; filename: string }> = [];
  const regex = /\[emoji:([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(message)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: message.slice(lastIndex, match.index) });
    }
    segments.push({ type: "emoji", filename: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < message.length) {
    segments.push({ type: "text", value: message.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ type: "text", value: message }];
}
