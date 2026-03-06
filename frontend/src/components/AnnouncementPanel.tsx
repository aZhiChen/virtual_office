"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

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
  unreadSystem?: number;
  unreadPersonal?: number;
  onMarkReadSystem?: (latestAt: string) => void;
  onMarkReadPersonal?: (latestAt: string) => void;
  onHeaderPointerDown?: (e: React.PointerEvent) => void;
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

type TabType = "system" | "personal";

export default function AnnouncementPanel({
  onClose,
  unreadSystem = 0,
  unreadPersonal = 0,
  onMarkReadSystem,
  onMarkReadPersonal,
  onHeaderPointerDown,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("system");
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

  const sortedSystemMessages = useMemo(() => {
    const toMillis = (iso: string | null) => {
      if (!iso) return 0;
      const normalized = /[zZ]|[+\-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`;
      return new Date(normalized).getTime();
    };
    return [...feed.system_messages].sort(
      (a, b) => toMillis(b.created_at) - toMillis(a.created_at)
    );
  }, [feed.system_messages]);

  const sortedPersonalPosts = useMemo(() => {
    const toMillis = (iso: string | null) => {
      if (!iso) return 0;
      const normalized = /[zZ]|[+\-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`;
      return new Date(normalized).getTime();
    };
    return [...feed.personal_posts].sort(
      (a, b) => toMillis(b.created_at) - toMillis(a.created_at)
    );
  }, [feed.personal_posts]);

  // 3秒后标记已读：系统公告在系统 tab 停留 3 秒后清除；个人公告需点击个人 tab 并停留 3 秒以上才清除
  useEffect(() => {
    if (!onMarkReadSystem && !onMarkReadPersonal) return;

    if (activeTab === "system" && onMarkReadSystem && unreadSystem > 0) {
      const timer = setTimeout(() => {
        const latest = sortedSystemMessages[0]?.created_at;
        onMarkReadSystem(latest ? String(latest) : new Date().toISOString());
      }, 3000);
      return () => clearTimeout(timer);
    }

    if (activeTab === "personal" && onMarkReadPersonal && unreadPersonal > 0) {
      const timer = setTimeout(() => {
        const latest = sortedPersonalPosts[0]?.created_at;
        onMarkReadPersonal(latest ? String(latest) : new Date().toISOString());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [activeTab, unreadSystem, unreadPersonal, onMarkReadSystem, onMarkReadPersonal, sortedSystemMessages, sortedPersonalPosts]);

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

  const renderSystemCard = (item: SystemMessageItem) => {
    const key = makeKey("system", item.id);
    const comments = commentsMap[key] || [];
    const commentsOpened = expandedComments.has(key);
    const created = formatRelativeTime(item.created_at);
    return (
      <div key={key} className="rounded border border-gray-700 p-2 bg-gray-800/60 mb-2">
        <div className="mb-1">
          <p className="text-[10px] text-yellow-300">📣 系统消息</p>
          <p className="text-xs text-gray-300">
            <span className="font-bold">{item.display_name}</span> · {created}
          </p>
          <div className="text-xs text-gray-100 mt-1 announcement-md">
            <ReactMarkdown>{item.content}</ReactMarkdown>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-300 mt-2">
          <button
            className={`${item.liked_by_me ? "text-pink-300" : "text-gray-300"} hover:text-pink-200`}
            onClick={() => toggleLike("system", item.id, item.liked_by_me)}
          >
            {item.liked_by_me ? "♥ 已赞" : "♡ 点赞"} ({item.likes_count})
          </button>
          <button className="hover:text-white" onClick={() => toggleComments("system", item.id)}>
            评论 ({item.comments_count})
          </button>
        </div>
        {commentsOpened && (
          <div className="mt-2 border-t border-gray-700 pt-2">
            <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
              {comments.length === 0 && <p className="text-[10px] text-gray-500">还没有评论</p>}
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
                onClick={() => submitComment("system", item.id)}
              >
                发送
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPersonalCard = (item: PersonalPostItem) => {
    const key = makeKey("personal", item.id);
    const comments = commentsMap[key] || [];
    const commentsOpened = expandedComments.has(key);
    const created = formatRelativeTime(item.created_at);
    return (
      <div key={key} className="rounded border border-gray-700 p-2 bg-gray-800/60 mb-2">
        <div className="mb-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-cyan-300">
                <span className="font-bold">{item.display_name}</span> · {created}
              </p>
            </div>
            {item.is_mine && (
              <button
                className="text-[10px] text-red-400 hover:text-red-300"
                onClick={() => deletePost(item.id)}
              >
                删除
              </button>
            )}
          </div>
          {item.content && (
            <div className="text-xs text-gray-100 mt-1 announcement-md">
              <ReactMarkdown>{item.content}</ReactMarkdown>
            </div>
          )}
          {item.image_url && (
            <button className="mt-2 block" onClick={() => setPreviewImage(item.image_url)}>
              <img src={item.image_url} alt="post" className="max-h-40 rounded border border-gray-600" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-300 mt-2">
          <button
            className={`${item.liked_by_me ? "text-pink-300" : "text-gray-300"} hover:text-pink-200`}
            onClick={() => toggleLike("personal", item.id, item.liked_by_me)}
          >
            {item.liked_by_me ? "♥ 已赞" : "♡ 点赞"} ({item.likes_count})
          </button>
          <button className="hover:text-white" onClick={() => toggleComments("personal", item.id)}>
            评论 ({item.comments_count})
          </button>
        </div>
        {commentsOpened && (
          <div className="mt-2 border-t border-gray-700 pt-2">
            <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
              {comments.length === 0 && <p className="text-[10px] text-gray-500">还没有评论</p>}
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
                onClick={() => submitComment("personal", item.id)}
              >
                发送
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="pixel-panel flex flex-col w-[480px] max-h-[78vh]">
      <div
        className={`flex items-center justify-between mb-2 pb-2 border-b border-gray-600 ${onHeaderPointerDown ? "cursor-grab active:cursor-grabbing touch-none select-none" : ""}`}
        onPointerDown={onHeaderPointerDown}
      >
        <span className="text-sm font-bold">公告栏</span>
        <button
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-red-400 hover:text-red-300 text-xs"
        >
          [X]
        </button>
      </div>

      {/* 导航栏 */}
      <nav className="flex gap-1 mb-3 border-b border-gray-600 pb-2">
        <button
          className={`flex-1 pixel-btn text-xs py-1.5 relative ${
            activeTab === "system"
              ? "!bg-yellow-600 !text-yellow-200 !border-yellow-500"
              : "text-gray-400 hover:text-gray-200"
          }`}
          onClick={() => setActiveTab("system")}
        >
          📣 系统公告
          {unreadSystem > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
              {unreadSystem > 99 ? "99+" : unreadSystem}
            </span>
          )}
        </button>
        <button
          className={`flex-1 pixel-btn text-xs py-1.5 relative ${
            activeTab === "personal"
              ? "!bg-cyan-600 !text-cyan-200 !border-cyan-500"
              : "text-gray-400 hover:text-gray-200"
          }`}
          onClick={() => setActiveTab("personal")}
        >
          👤 个人公告
          {unreadPersonal > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
              {unreadPersonal > 99 ? "99+" : unreadPersonal}
            </span>
          )}
        </button>
      </nav>

      {/* 内容区 */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeTab === "system" && (
          <div className="flex-1 overflow-y-auto pr-1 space-y-0">
            {loading && <p className="text-xs text-gray-400">加载中...</p>}
            {!loading && sortedSystemMessages.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-10">暂无系统公告</p>
            )}
            {!loading && sortedSystemMessages.map((item) => renderSystemCard(item))}
          </div>
        )}

        {activeTab === "personal" && (
          <>
            <div className="mb-3 p-2 rounded border border-gray-600 bg-[var(--pixel-surface)] shrink-0">
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
            <div className="flex-1 overflow-y-auto pr-1 space-y-0">
              {loading && <p className="text-xs text-gray-400">加载中...</p>}
              {!loading && sortedPersonalPosts.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-10">暂无个人公告，快发布第一条吧。</p>
              )}
              {!loading && sortedPersonalPosts.map((item) => renderPersonalCard(item))}
            </div>
          </>
        )}
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
