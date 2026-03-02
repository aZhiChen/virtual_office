"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";

type TargetType = "system" | "personal";

interface SystemMessageItem {
  id: number;
  target_type: "system";
  user_id: number;
  display_name: string;
  message_type: string;
  streak_days: number;
  content: string;
  created_at: string | null;
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
}

interface PersonalPostItem {
  id: number;
  target_type: "personal";
  user_id: number;
  display_name: string;
  avatar_config: Record<string, number>;
  content: string | null;
  image_url: string | null;
  created_at: string | null;
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
  is_mine: boolean;
}

interface FeedData {
  system_messages: SystemMessageItem[];
  personal_posts: PersonalPostItem[];
}

interface CommentItem {
  id: number;
  target_type: TargetType;
  target_id: number;
  user_id: number;
  display_name: string;
  avatar_config: Record<string, number>;
  content: string;
  created_at: string | null;
  is_mine: boolean;
}

interface Props {
  onClose: () => void;
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const normalized = /[zZ]|[+\-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const date = new Date(normalized);
  const diff = Date.now() - date.getTime();
  const sec = Math.max(0, Math.floor(diff / 1000));
  if (sec < 10) return "刚刚";
  if (sec < 60) return `${sec}秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}小时前`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}天前`;
  return date.toLocaleString();
}

export default function AnnouncementPanel({ onClose }: Props) {
  const [feed, setFeed] = useState<FeedData>({ system_messages: [], personal_posts: [] });
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [content, setContent] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentsMap, setCommentsMap] = useState<Record<string, CommentItem[]>>({});
  const [commentInputMap, setCommentInputMap] = useState<Record<string, string>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [error, setError] = useState("");

  const makeKey = (targetType: TargetType, targetId: number) => `${targetType}:${targetId}`;

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await api.getAnnouncementFeed(30)) as FeedData;
      setFeed(data);
      setError("");
    } catch (e) {
      setError((e as Error).message || "加载公告失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    const handleRefresh = () => {
      loadFeed();
    };
    window.addEventListener("announcement:refresh", handleRefresh);
    return () => {
      window.removeEventListener("announcement:refresh", handleRefresh);
    };
  }, [loadFeed]);

  const mixedFeed = useMemo(() => {
    const toMillis = (iso: string | null) => {
      if (!iso) return 0;
      const normalized = /[zZ]|[+\-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`;
      return new Date(normalized).getTime();
    };
    const rows: Array<
      | { kind: "system"; item: SystemMessageItem; createdAt: number }
      | { kind: "personal"; item: PersonalPostItem; createdAt: number }
    > = [];
    for (const item of feed.system_messages) {
      rows.push({ kind: "system", item, createdAt: toMillis(item.created_at) });
    }
    for (const item of feed.personal_posts) {
      rows.push({ kind: "personal", item, createdAt: toMillis(item.created_at) });
    }
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows;
  }, [feed]);

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/gif"].includes(file.type)) {
      setError("仅支持 jpg / png / gif");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("图片不能超过 2MB");
      return;
    }

    const toDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setImageDataUrl(toDataUrl);
    setImageName(file.name);
    setError("");
  };

  const handlePublish = async () => {
    const text = content.trim();
    if (!text && !imageDataUrl) return;
    setPublishing(true);
    try {
      await api.createPersonalPost(text || undefined, imageDataUrl || undefined);
      setContent("");
      setImageDataUrl(null);
      setImageName("");
      await loadFeed();
    } catch (e) {
      setError((e as Error).message || "发布失败");
    } finally {
      setPublishing(false);
    }
  };

  const toggleLike = async (targetType: TargetType, targetId: number, likedByMe: boolean) => {
    try {
      if (likedByMe) {
        await api.unlikeAnnouncement(targetType, targetId);
      } else {
        await api.likeAnnouncement(targetType, targetId);
      }
      await loadFeed();
    } catch {
      /* ignore */
    }
  };

  const loadComments = async (targetType: TargetType, targetId: number) => {
    const key = makeKey(targetType, targetId);
    try {
      const data = (await api.getAnnouncementComments(targetType, targetId)) as {
        comments: CommentItem[];
      };
      setCommentsMap((prev) => ({ ...prev, [key]: data.comments }));
    } catch {
      setCommentsMap((prev) => ({ ...prev, [key]: [] }));
    }
  };

  const toggleComments = async (targetType: TargetType, targetId: number) => {
    const key = makeKey(targetType, targetId);
    const next = new Set(expandedComments);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
      await loadComments(targetType, targetId);
    }
    setExpandedComments(next);
  };

  const submitComment = async (targetType: TargetType, targetId: number) => {
    const key = makeKey(targetType, targetId);
    const text = (commentInputMap[key] || "").trim();
    if (!text) return;
    try {
      await api.createAnnouncementComment(targetType, targetId, text);
      setCommentInputMap((prev) => ({ ...prev, [key]: "" }));
      await Promise.all([loadComments(targetType, targetId), loadFeed()]);
    } catch {
      /* ignore */
    }
  };

  const deletePost = async (postId: number) => {
    try {
      await api.deletePersonalPost(postId);
      await loadFeed();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="pixel-panel flex flex-col w-[480px] max-h-[78vh]">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-600">
        <span className="text-sm font-bold">公告栏</span>
        <button onClick={onClose} className="text-red-400 hover:text-red-300 text-xs">
          [X]
        </button>
      </div>

      <div className="mb-3 p-2 rounded border border-gray-600 bg-[var(--pixel-surface)]">
        <p className="text-xs text-gray-300 mb-1">发布个人动态（最多 500 字）</p>
        <textarea
          className="pixel-input w-full text-xs min-h-[72px]"
          value={content}
          maxLength={500}
          onChange={(e) => setContent(e.target.value)}
          placeholder="分享你的进展、心情或今日目标..."
        />
        <div className="mt-2 flex items-center gap-2">
          <label className="pixel-btn text-xs cursor-pointer">
            上传图片
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />
          </label>
          <button
            className="pixel-btn text-xs"
            onClick={handlePublish}
            disabled={publishing || (!content.trim() && !imageDataUrl)}
          >
            发布
          </button>
          {imageName && <span className="text-[10px] text-gray-400 truncate">{imageName}</span>}
          {imageDataUrl && (
            <button
              className="text-[10px] text-red-400 hover:text-red-300"
              onClick={() => {
                setImageDataUrl(null);
                setImageName("");
              }}
            >
              移除图片
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-2">
        {loading && <p className="text-xs text-gray-400">加载中...</p>}
        {!loading && mixedFeed.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-10">暂无公告，快发布第一条吧。</p>
        )}

        {mixedFeed.map((row) => {
          const key =
            row.kind === "system"
              ? makeKey("system", row.item.id)
              : makeKey("personal", row.item.id);
          const comments = commentsMap[key] || [];
          const commentsOpened = expandedComments.has(key);
          const likedByMe = row.item.liked_by_me;
          const likesCount = row.item.likes_count;
          const commentsCount = row.item.comments_count;
          const created = formatRelativeTime(row.item.created_at);

          return (
            <div key={`${row.kind}-${row.item.id}`} className="rounded border border-gray-700 p-2 bg-gray-800/60">
              {row.kind === "system" ? (
                <div className="mb-1">
                  <p className="text-[10px] text-yellow-300">📣 系统消息</p>
                  <p className="text-xs text-gray-300">
                    <span className="font-bold">{row.item.display_name}</span> · {created}
                  </p>
                  <p className="text-xs text-gray-100 mt-1 whitespace-pre-wrap">{row.item.content}</p>
                </div>
              ) : (
                <div className="mb-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-cyan-300">
                        <span className="font-bold">{row.item.display_name}</span> · {created}
                      </p>
                    </div>
                    {row.item.is_mine && (
                      <button
                        className="text-[10px] text-red-400 hover:text-red-300"
                        onClick={() => deletePost(row.item.id)}
                      >
                        删除
                      </button>
                    )}
                  </div>
                  {row.item.content && (
                    <p className="text-xs text-gray-100 mt-1 whitespace-pre-wrap">{row.item.content}</p>
                  )}
                  {row.item.image_url && (
                    <button className="mt-2 block" onClick={() => setPreviewImage(row.item.image_url)}>
                      <img src={row.item.image_url} alt="post" className="max-h-40 rounded border border-gray-600" />
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 text-[10px] text-gray-300 mt-2">
                <button
                  className={`${likedByMe ? "text-pink-300" : "text-gray-300"} hover:text-pink-200`}
                  onClick={() =>
                    toggleLike(
                      row.kind === "system" ? "system" : "personal",
                      row.item.id,
                      likedByMe
                    )
                  }
                >
                  {likedByMe ? "♥ 已赞" : "♡ 点赞"} ({likesCount})
                </button>
                <button
                  className="hover:text-white"
                  onClick={() =>
                    toggleComments(row.kind === "system" ? "system" : "personal", row.item.id)
                  }
                >
                  评论 ({commentsCount})
                </button>
              </div>

              {commentsOpened && (
                <div className="mt-2 border-t border-gray-700 pt-2">
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {comments.length === 0 && (
                      <p className="text-[10px] text-gray-500">还没有评论</p>
                    )}
                    {comments.map((c) => (
                      <div key={c.id} className="text-[10px] text-gray-300">
                        <span className="text-cyan-300">{c.display_name}</span>: {c.content}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-1">
                    <input
                      className="pixel-input flex-1 text-[10px]"
                      value={commentInputMap[key] || ""}
                      onChange={(e) =>
                        setCommentInputMap((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder="写评论..."
                    />
                    <button
                      className="pixel-btn text-[10px]"
                      onClick={() =>
                        submitComment(row.kind === "system" ? "system" : "personal", row.item.id)
                      }
                    >
                      发送
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <img src={previewImage} alt="preview" className="max-w-[80vw] max-h-[80vh] rounded border border-gray-500" />
        </div>
      )}
    </div>
  );
}
