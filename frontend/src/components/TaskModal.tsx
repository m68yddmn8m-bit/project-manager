import { useEffect, useState, useRef } from "react";
import * as api from "../api";
import type { Task, Comment, User, Subtask } from "../types";
import { formatDate, humanStatus, STATUS_COLORS, PRIORITY_COLORS, timeAgo } from "../utils/format";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";

interface Props {
  projectId: number;
  taskId: number;
  users: User[];
  isEditor: boolean;
  onClose: () => void;
  onTaskUpdate: (task: Task) => void;
  onTaskDelete: (taskId: number) => void;
}

const STATUSES: Task["status"][] = ["todo", "in_progress", "review", "done"];
const PRIORITIES: Task["priority"][] = ["low", "medium", "high", "urgent"];

export default function TaskModal({ projectId, taskId, users, isEditor, onClose, onTaskUpdate, onTaskDelete }: Props) {
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentBody, setCommentBody] = useState("");
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      api.getTask(projectId, taskId),
      api.listComments(projectId, taskId),
    ]).then(([t, c]) => {
      setTask(t);
      setComments(c);
    }).finally(() => setLoading(false));
  }, [projectId, taskId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const updateField = async (data: Partial<Task>) => {
    if (!task) return;
    const updated = await api.updateTask(projectId, task.id, data);
    setTask(updated);
    onTaskUpdate(updated);
  };

  const handleAddSubtask = async () => {
    if (!task || !newSubtask.trim()) return;
    const subtask = await api.createSubtask(projectId, task.id, newSubtask);
    setTask({ ...task, subtasks: [...task.subtasks, subtask] });
    setNewSubtask("");
  };

  const handleToggleSubtask = async (subtask: Subtask) => {
    if (!task) return;
    const updated = await api.updateSubtask(projectId, task.id, subtask.id, { is_completed: !subtask.is_completed });
    setTask({ ...task, subtasks: task.subtasks.map((s) => s.id === subtask.id ? updated : s) });
  };

  const handleDeleteSubtask = async (subtaskId: number) => {
    if (!task) return;
    await api.deleteSubtask(projectId, task.id, subtaskId);
    setTask({ ...task, subtasks: task.subtasks.filter((s) => s.id !== subtaskId) });
  };

  const handleAddComment = async () => {
    if (!commentBody.trim() || !task) return;
    setSavingComment(true);
    try {
      const c = await api.createComment(projectId, task.id, commentBody);
      setComments((prev) => [...prev, c]);
      setCommentBody("");
    } finally {
      setSavingComment(false);
    }
  };

  const handleUpdateComment = async (commentId: number) => {
    if (!task) return;
    await api.updateComment(projectId, task.id, commentId, editBody);
    setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, body: editBody } : c));
    setEditingComment(null);
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!task) return;
    await api.deleteComment(projectId, task.id, commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const handleDeleteTask = async () => {
    if (!task || !confirm(`Delete task "${task.title}"?`)) return;
    await api.deleteTask(projectId, task.id);
    onTaskDelete(task.id);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-start justify-center overflow-y-auto py-8 px-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={modalRef} className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : !task ? (
          <div className="p-8 text-center text-red-400">Task not found.</div>
        ) : (
          <>
            {/* Header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-lg font-semibold text-gray-900 flex-1">{task.title}</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {isEditor ? (
                  <>
                    <select
                      value={task.status}
                      onChange={(e) => updateField({ status: e.target.value as Task["status"] })}
                      className={clsx("badge cursor-pointer border-0 outline-none", STATUS_COLORS[task.status])}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{humanStatus(s)}</option>)}
                    </select>
                    <select
                      value={task.priority}
                      onChange={(e) => updateField({ priority: e.target.value as Task["priority"] })}
                      className={clsx("badge cursor-pointer border-0 outline-none", PRIORITY_COLORS[task.priority])}
                    >
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select
                      value={task.assignee?.id ?? ""}
                      onChange={(e) => updateField({ assignee_id: e.target.value ? Number(e.target.value) : undefined })}
                      className="text-xs border border-gray-200 rounded-full px-2 py-0.5 outline-none"
                    >
                      <option value="">Unassigned</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </>
                ) : (
                  <>
                    <span className={clsx("badge", STATUS_COLORS[task.status])}>{humanStatus(task.status)}</span>
                    <span className={clsx("badge", PRIORITY_COLORS[task.priority])}>{task.priority}</span>
                    {task.assignee && <span className="text-xs text-gray-500">{task.assignee.name}</span>}
                  </>
                )}
                <span className="text-xs text-gray-400 ml-auto">Due {formatDate(task.due_date)}</span>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Description */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Description</h3>
                <p className="text-sm text-gray-500 whitespace-pre-wrap">{task.description || "No description."}</p>
              </div>

              {/* Subtasks */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Subtasks ({task.subtasks.filter((s) => s.is_completed).length}/{task.subtasks.length})
                </h3>
                <ul className="space-y-1">
                  {task.subtasks.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 group">
                      <input
                        type="checkbox"
                        checked={s.is_completed}
                        onChange={() => handleToggleSubtask(s)}
                        disabled={!isEditor}
                        className="w-4 h-4 rounded accent-blue-600"
                      />
                      <span className={clsx("text-sm flex-1", s.is_completed && "line-through text-gray-400")}>
                        {s.title}
                      </span>
                      {isEditor && (
                        <button
                          onClick={() => handleDeleteSubtask(s.id)}
                          className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {isEditor && (
                  <div className="flex gap-2 mt-2">
                    <input
                      className="input text-sm flex-1"
                      placeholder="Add subtask…"
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddSubtask(); }}
                    />
                    <button className="btn-secondary text-xs" onClick={handleAddSubtask}>Add</button>
                  </div>
                )}
              </div>

              {/* Comments */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Comments ({comments.length})</h3>
                <div className="space-y-3">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xs shrink-0">
                        {c.author.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{c.author.name}</span>
                          <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span>
                        </div>
                        {editingComment === c.id ? (
                          <div className="mt-1">
                            <textarea
                              className="input text-sm w-full"
                              rows={2}
                              value={editBody}
                              onChange={(e) => setEditBody(e.target.value)}
                              autoFocus
                            />
                            <div className="flex gap-1 mt-1">
                              <button className="btn-primary text-xs py-1" onClick={() => handleUpdateComment(c.id)}>Save</button>
                              <button className="btn-secondary text-xs py-1" onClick={() => setEditingComment(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{c.body}</p>
                        )}
                        {c.author.id === user?.id && editingComment !== c.id && (
                          <div className="flex gap-2 mt-1">
                            <button className="text-xs text-gray-400 hover:text-blue-600" onClick={() => { setEditingComment(c.id); setEditBody(c.body); }}>Edit</button>
                            <button className="text-xs text-gray-400 hover:text-red-500" onClick={() => handleDeleteComment(c.id)}>Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <textarea
                    className="input text-sm flex-1"
                    placeholder="Write a comment…"
                    rows={2}
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                  />
                  <button
                    className="btn-primary self-end"
                    onClick={handleAddComment}
                    disabled={savingComment || !commentBody.trim()}
                  >
                    {savingComment ? "…" : "Post"}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            {isEditor && (
              <div className="px-6 pb-6 flex justify-between items-center text-sm text-gray-400">
                <span>Created by {task.created_by.name} · {timeAgo(task.created_at)}</span>
                <button className="text-red-400 hover:text-red-600" onClick={handleDeleteTask}>Delete task</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
