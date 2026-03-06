"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";

interface TaskData {
  id: number;
  content: string;
  status: string;
  created_at: string | null;
  completed_at: string | null;
}

interface NoteItemData {
  note_item_id: number;
  task: TaskData;
  sort_order: number;
}

type Tab = "note" | "pending" | "completed";

interface Props {
  onClose: () => void;
  onHeaderPointerDown?: (e: React.PointerEvent) => void;
}

export default function NotePanel({ onClose, onHeaderPointerDown }: Props) {
  const [tab, setTab] = useState<Tab>("note");
  const [noteItems, setNoteItems] = useState<NoteItemData[]>([]);
  const [pendingTasks, setPendingTasks] = useState<TaskData[]>([]);
  const [completedTasks, setCompletedTasks] = useState<TaskData[]>([]);
  const [newTaskContent, setNewTaskContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [noteItemIds, setNoteItemIds] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // Summary report state
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryContent, setSummaryContent] = useState("");
  const [summaryPublishing, setSummaryPublishing] = useState(false);
  const [summaryPublished, setSummaryPublished] = useState(false);
  const summaryTextRef = useRef<HTMLTextAreaElement>(null);

  // Track task ids currently in the note (for "already added" indicator)
  const noteTaskIds = useRef<Set<number>>(new Set());

  const loadNote = useCallback(async () => {
    try {
      const data = await api.getNote();
      setNoteItems(data.items);
      const ids = new Set<number>(data.items.map((it: NoteItemData) => it.task.id));
      noteTaskIds.current = ids;
      setNoteItemIds(ids);
    } catch {
      /* ignore */
    }
  }, []);

  const loadPending = useCallback(async () => {
    try {
      const data = await api.getPendingBox();
      setPendingTasks(data);
    } catch {
      /* ignore */
    }
  }, []);

  const loadCompleted = useCallback(async () => {
    try {
      const data = await api.getCompletedBox();
      setCompletedTasks(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadNote();
  }, [loadNote]);

  useEffect(() => {
    if (tab === "pending") loadPending();
    if (tab === "completed") loadCompleted();
  }, [tab, loadPending, loadCompleted]);

  const handleCreateTask = async () => {
    const content = newTaskContent.trim();
    if (!content) return;
    setLoading(true);
    try {
      await api.createTaskAndAdd(content);
      setNewTaskContent("");
      await loadNote();
      inputRef.current?.focus();
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTask = async (taskId: number) => {
    try {
      await api.completeTask(taskId);
      await loadNote();
    } catch {
      /* ignore */
    }
  };

  const handleClearNote = async () => {
    try {
      await api.clearNote();
      setShowClearConfirm(false);
      await loadNote();
    } catch {
      /* ignore */
    }
  };

  const handleAddFromBox = async (taskId: number) => {
    try {
      await api.addTaskToNote(taskId);
      await loadNote();
      await loadPending();
    } catch {
      /* ignore */
    }
  };

  const handleRemoveItem = async (noteItemId: number) => {
    try {
      await api.removeNoteItem(noteItemId);
      await loadNote();
    } catch {
      /* ignore */
    }
  };

  // ── Drag & drop reorder ───────────────────────────────
  const dragIdx = useRef<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);

  const handleDragStart = (idx: number) => {
    dragIdx.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    dragOverIdx.current = idx;
  };

  const handleDrop = async () => {
    if (dragIdx.current === null || dragOverIdx.current === null) return;
    if (dragIdx.current === dragOverIdx.current) return;
    const items = [...noteItems];
    const [moved] = items.splice(dragIdx.current, 1);
    items.splice(dragOverIdx.current, 0, moved);
    setNoteItems(items);
    dragIdx.current = null;
    dragOverIdx.current = null;
    try {
      await api.reorderNote(items.map((it) => it.note_item_id));
    } catch {
      await loadNote();
    }
  };

  // ── Group completed tasks by date (local time) ───────
  const toLocalIso = (dt: Date) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const groupByDate = (tasks: TaskData[]) => {
    const groups: Record<string, { display: string; iso: string; tasks: TaskData[] }> = {};
    for (const t of tasks) {
      if (!t.completed_at) continue;
      const dt = new Date(t.completed_at);
      const iso = toLocalIso(dt);
      const display = dt.toLocaleDateString();
      if (!groups[iso]) groups[iso] = { display, iso, tasks: [] };
      groups[iso].tasks.push(t);
    }
    return Object.values(groups);
  };

  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const toggleCollapse = (date: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const toggleDateSelection = (iso: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  };

  const handleGenerateSummary = async () => {
    if (selectedDates.size === 0) return;
    setSummaryLoading(true);
    setSummaryVisible(true);
    setSummaryContent("");
    setSummaryPublished(false);
    try {
      const dates = Array.from(selectedDates).sort();
      const tzOffset = new Date().getTimezoneOffset();
      const data = await api.generateTaskSummary(dates, tzOffset);
      setSummaryContent(data.summary);
    } catch {
      setSummaryContent("[生成失败，请稍后重试]");
    } finally {
      setSummaryLoading(false);
      setTimeout(() => summaryTextRef.current?.focus(), 100);
    }
  };

  const handlePublishSummary = async () => {
    if (!summaryContent.trim()) return;
    setSummaryPublishing(true);
    try {
      await api.createPersonalPost(summaryContent.trim());
      setSummaryPublished(true);
    } catch {
      /* ignore */
    } finally {
      setSummaryPublishing(false);
    }
  };

  const handleCloseSummary = () => {
    setSummaryVisible(false);
    setSummaryContent("");
    setSummaryPublished(false);
    setSelectedDates(new Set());
  };

  return (
    <div className="pixel-panel flex flex-col w-96 h-[480px] overflow-hidden">
      {/* Header - drag handle when onHeaderPointerDown provided */}
      <div
        className={`flex items-center justify-between mb-2 pb-2 border-b border-gray-600 ${onHeaderPointerDown ? "cursor-grab active:cursor-grabbing touch-none select-none" : ""}`}
        onPointerDown={onHeaderPointerDown}
      >
        <span className="text-sm font-bold">My Notes</span>
        <button
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-red-400 hover:text-red-300 text-xs"
        >
          [X]
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-2">
        {(["note", "pending", "completed"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs px-3 py-1 border-2 transition-colors ${
              tab === t
                ? "border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-white"
                : "border-gray-600 bg-[var(--pixel-surface)] text-gray-400 hover:text-white"
            }`}
          >
            {t === "note" ? "My Note" : t === "pending" ? "Pending Box" : "Completed Box"}
          </button>
        ))}
      </div>

      {/* ── Tab: Note ──────────────────────────── */}
      {tab === "note" && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Clear button */}
          <div className="flex justify-end mb-1">
            {!showClearConfirm ? (
              <button
                className="text-[10px] text-red-400 hover:text-red-300"
                onClick={() => setShowClearConfirm(true)}
                disabled={noteItems.length === 0}
              >
                Clear Note
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-yellow-400">
                  Remove all items? Tasks stay in boxes.
                </span>
                <button
                  className="text-[10px] text-red-400 hover:text-red-300 font-bold"
                  onClick={handleClearNote}
                >
                  Yes
                </button>
                <button
                  className="text-[10px] text-gray-400 hover:text-gray-300"
                  onClick={() => setShowClearConfirm(false)}
                >
                  No
                </button>
              </div>
            )}
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto space-y-1 mb-2 min-h-0 pr-1">
            {noteItems.length === 0 && (
              <p className="text-xs text-gray-500 text-center mt-6">
                No tasks yet. Add one below!
              </p>
            )}
            {noteItems.map((item, idx) => {
              const done = item.task.status === "completed";
              return (
                <div
                  key={item.note_item_id}
                  draggable={!done}
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={handleDrop}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs group ${
                    done ? "bg-gray-800 text-gray-500" : "bg-gray-700/50 hover:bg-gray-700"
                  } ${!done ? "cursor-grab active:cursor-grabbing" : ""}`}
                >
                  {/* Drag handle */}
                  {!done && (
                    <span className="text-gray-500 select-none text-[10px]">⠿</span>
                  )}
                  {/* Checkbox */}
                  <button
                    onClick={() => !done && handleCompleteTask(item.task.id)}
                    disabled={done}
                    className={`w-4 h-4 border-2 flex-shrink-0 flex items-center justify-center ${
                      done
                        ? "border-green-600 bg-green-900 text-green-400 cursor-default"
                        : "border-gray-500 hover:border-[var(--pixel-accent)] cursor-pointer"
                    }`}
                  >
                    {done && <span className="text-[10px]">✓</span>}
                  </button>
                  {/* Content */}
                  <span className={`flex-1 ${done ? "line-through" : ""}`}>
                    {item.task.content}
                  </span>
                  {/* Remove from note */}
                  <button
                    onClick={() => handleRemoveItem(item.note_item_id)}
                    className="text-gray-500 hover:text-red-400 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove from Note"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div className="flex gap-1">
            <input
              ref={inputRef}
              className="pixel-input flex-1 text-xs"
              placeholder="New task..."
              value={newTaskContent}
              onChange={(e) => setNewTaskContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateTask();
                }
              }}
              disabled={loading}
            />
            <button
              className="pixel-btn text-xs"
              onClick={handleCreateTask}
              disabled={loading || !newTaskContent.trim()}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: Pending Box ───────────────────── */}
      {tab === "pending" && (
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0 pr-1 scrollbar-thin">
          {pendingTasks.length === 0 && (
            <p className="text-xs text-gray-500 text-center mt-6">
              No pending tasks.
            </p>
          )}
          {pendingTasks.map((task) => {
            const inNote = noteItemIds.has(task.id);
            return (
              <div
                key={task.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-xs bg-gray-700/50 hover:bg-gray-700"
              >
                <span className="flex-1">{task.content}</span>
                <button
                  onClick={() => handleAddFromBox(task.id)}
                  disabled={inNote}
                  className={`text-[10px] px-2 py-0.5 border ${
                    inNote
                      ? "border-gray-600 text-gray-500 cursor-default"
                      : "border-green-600 text-green-400 hover:bg-green-900 cursor-pointer"
                  }`}
                >
                  {inNote ? "Added" : "+ Note"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tab: Completed Box ─────────────────── */}
      {tab === "completed" && (
        <div className="flex flex-col flex-1 min-h-0">
          {completedTasks.length === 0 && (
            <p className="text-xs text-gray-500 text-center mt-6">
              No completed tasks yet.
            </p>
          )}

          {/* Summary toolbar */}
          {completedTasks.length > 0 && !summaryVisible && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-500">
                {selectedDates.size > 0
                  ? `${selectedDates.size} date(s) selected`
                  : "Select dates to summarize"}
              </span>
              <button
                onClick={handleGenerateSummary}
                disabled={selectedDates.size === 0 || summaryLoading}
                className={`text-[10px] px-2 py-0.5 border transition-colors ${
                  selectedDates.size === 0
                    ? "border-gray-600 text-gray-500 cursor-not-allowed"
                    : "border-[var(--pixel-accent)] text-[var(--pixel-accent)] hover:bg-[var(--pixel-accent)] hover:text-white cursor-pointer"
                }`}
              >
                Generate Summary
              </button>
            </div>
          )}

          {/* Summary report panel */}
          {summaryVisible && (
            <div className="mb-3 border border-[var(--pixel-accent)] rounded p-3 bg-gray-800/80 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[var(--pixel-accent)]">
                  Summary — {Array.from(selectedDates).sort().join(", ")}
                </span>
                <button
                  onClick={handleCloseSummary}
                  className="text-red-400 hover:text-red-300 text-[10px]"
                >
                  [X]
                </button>
              </div>

              {summaryLoading ? (
                <div className="flex items-center justify-center py-6">
                  <span className="text-xs text-gray-400 animate-pulse">
                    Generating summary...
                  </span>
                </div>
              ) : (
                <>
                  <textarea
                    ref={summaryTextRef}
                    value={summaryContent}
                    onChange={(e) => {
                      setSummaryContent(e.target.value);
                      setSummaryPublished(false);
                    }}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-xs text-gray-200 resize-none focus:outline-none focus:border-[var(--pixel-accent)]"
                    rows={6}
                    placeholder="Summary will appear here..."
                  />
                  <div className="flex items-center justify-end gap-2 mt-2">
                    {summaryPublished && (
                      <span className="text-[10px] text-green-400">
                        Published!
                      </span>
                    )}
                    <button
                      onClick={handlePublishSummary}
                      disabled={summaryPublishing || !summaryContent.trim() || summaryPublished}
                      className={`text-xs px-3 py-1 border-2 transition-colors ${
                        summaryPublished
                          ? "border-green-600 bg-green-900 text-green-400 cursor-default"
                          : summaryPublishing || !summaryContent.trim()
                            ? "border-gray-600 text-gray-500 cursor-not-allowed"
                            : "border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-white hover:opacity-90 cursor-pointer"
                      }`}
                    >
                      {summaryPublished ? "Published" : summaryPublishing ? "Publishing..." : "Publish"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Date groups */}
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0 pr-1">
            {groupByDate(completedTasks).map((group) => (
              <div key={group.iso}>
                <div className="flex items-center gap-1 py-1">
                  <button
                    onClick={() => toggleDateSelection(group.iso)}
                    className={`w-3.5 h-3.5 border flex-shrink-0 flex items-center justify-center transition-colors ${
                      selectedDates.has(group.iso)
                        ? "border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-white"
                        : "border-gray-500 hover:border-gray-400"
                    }`}
                  >
                    {selectedDates.has(group.iso) && <span className="text-[8px]">✓</span>}
                  </button>
                  <button
                    onClick={() => toggleCollapse(group.iso)}
                    className="text-[10px] text-gray-400 hover:text-gray-300 flex items-center gap-1"
                  >
                    <span>{collapsedDates.has(group.iso) ? "▶" : "▼"}</span>
                    <span className="font-bold">{group.display}</span>
                    <span className="text-gray-500">({group.tasks.length})</span>
                  </button>
                </div>
                {!collapsedDates.has(group.iso) &&
                  group.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 px-2 py-1 rounded text-xs bg-gray-800 text-gray-500 ml-3"
                    >
                      <span className="text-green-600 text-[10px]">✓</span>
                      <span className="line-through flex-1">{task.content}</span>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
