import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import * as api from "../api";
import type { Project, Task, Activity, User, WsEvent } from "../types";
import { formatDate, humanStatus, STATUS_COLORS, PRIORITY_COLORS, actionLabel, timeAgo } from "../utils/format";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";
import { useProjectWebSocket } from "../hooks/useWebSocket";
import TaskModal from "../components/TaskModal";

const COLUMNS: Task["status"][] = ["todo", "in_progress", "review", "done"];

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const { user, token } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showNewTask, setShowNewTask] = useState<Task["status"] | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [activeTab, setActiveTab] = useState<"board" | "activity">("board");

  useEffect(() => {
    Promise.all([
      api.getProject(projectId),
      api.listTasks(projectId),
      api.listActivity(projectId),
      api.listUsers(),
    ]).then(([proj, taskList, acts, userList]) => {
      setProject(proj);
      setTasks(taskList);
      setActivity(acts);
      setUsers(userList);
    }).finally(() => setLoading(false));
  }, [projectId]);

  const handleWsMessage = useCallback((evt: WsEvent) => {
    if (evt.event === "task_created") setTasks((t) => [...t, evt.data]);
    if (evt.event === "task_updated") setTasks((t) => t.map((x) => (x.id === evt.data.id ? evt.data : x)));
    if (evt.event === "task_deleted") setTasks((t) => t.filter((x) => x.id !== evt.data.id));
    if (evt.event === "subtask_created") {
      setTasks((t) => t.map((x) => x.id === evt.data.task_id ? { ...x, subtasks: [...x.subtasks, evt.data.subtask] } : x));
    }
    if (evt.event === "subtask_updated") {
      setTasks((t) => t.map((x) => x.id === evt.data.task_id ? { ...x, subtasks: x.subtasks.map((s) => s.id === evt.data.subtask.id ? evt.data.subtask : s) } : x));
    }
    if (evt.event === "subtask_deleted") {
      setTasks((t) => t.map((x) => x.id === evt.data.task_id ? { ...x, subtasks: x.subtasks.filter((s) => s.id !== evt.data.subtask_id) } : x));
    }
    if (evt.event === "comment_added" || evt.event === "comment_updated") {
      setTasks((t) => t.map((x) => x.id === evt.data.task_id ? { ...x, comment_count: x.comment_count + (evt.event === "comment_added" ? 1 : 0) } : x));
    }
  }, []);

  useProjectWebSocket(projectId, token, handleWsMessage);

  const handleCreateTask = async (status: Task["status"]) => {
    if (!newTaskTitle.trim()) return;
    const task = await api.createTask(projectId, { title: newTaskTitle, status });
    setTasks((t) => [...t, task]);
    setNewTaskTitle("");
    setShowNewTask(null);
  };

  const handleStatusChange = async (taskId: number, status: Task["status"]) => {
    const updated = await api.updateTask(projectId, taskId, { status });
    setTasks((t) => t.map((x) => (x.id === taskId ? updated : x)));
  };

  if (loading) return <div className="text-center py-16 text-gray-400">Loading…</div>;
  if (!project) return <div className="text-center py-16 text-red-400">Project not found.</div>;

  const isEditor = project.owner_id === user?.id || project.members.some((m) => m.id === user?.id && m.role !== "viewer");

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link to="/" className="hover:text-blue-600">Projects</Link>
          <span>/</span>
          <span>{project.name}</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {project.description && <p className="text-gray-500 mt-1">{project.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className={clsx("badge", STATUS_COLORS[project.status])}>{humanStatus(project.status)}</span>
            {project.due_date && <span className="text-sm text-gray-400">Due {formatDate(project.due_date)}</span>}
          </div>
        </div>

        {/* Members */}
        <div className="flex items-center gap-1 mt-3">
          {[project.owner, ...project.members.map((m) => m.user)].map((u) => (
            <div
              key={u.id}
              title={u.name}
              className="w-7 h-7 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium ring-2 ring-white -ml-1 first:ml-0"
            >
              {u.name[0].toUpperCase()}
            </div>
          ))}
          <span className="ml-2 text-xs text-gray-400">
            {project.members.length + 1} member{project.members.length !== 0 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {(["board", "activity"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx("px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize",
              activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Board */}
      {activeTab === "board" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col).sort((a, b) => a.position - b.position);
            return (
              <div key={col} className="bg-gray-100 rounded-xl p-3 min-h-[200px]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">{humanStatus(col)}</h3>
                  <span className="text-xs text-gray-400 bg-white rounded-full px-2 py-0.5">{colTasks.length}</span>
                </div>

                <div className="space-y-2">
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      className="card p-3 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      <p className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">{task.title}</p>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className={clsx("badge", PRIORITY_COLORS[task.priority])}>{task.priority}</span>
                        {task.assignee && (
                          <span className="text-xs text-gray-400">{task.assignee.name.split(" ")[0]}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        {task.subtasks.length > 0 && (
                          <span>
                            {task.subtasks.filter((s) => s.is_completed).length}/{task.subtasks.length} subtasks
                          </span>
                        )}
                        {task.comment_count > 0 && <span>{task.comment_count} comment{task.comment_count !== 1 ? "s" : ""}</span>}
                        {task.due_date && <span>{formatDate(task.due_date)}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {isEditor && (
                  showNewTask === col ? (
                    <div className="mt-2">
                      <input
                        autoFocus
                        className="input text-sm w-full"
                        placeholder="Task title…"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreateTask(col);
                          if (e.key === "Escape") { setShowNewTask(null); setNewTaskTitle(""); }
                        }}
                      />
                      <div className="flex gap-1 mt-1">
                        <button className="btn-primary text-xs py-1" onClick={() => handleCreateTask(col)}>Add</button>
                        <button className="btn-secondary text-xs py-1" onClick={() => { setShowNewTask(null); setNewTaskTitle(""); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="mt-2 w-full text-sm text-gray-400 hover:text-gray-600 py-1.5 rounded-lg hover:bg-white transition-colors"
                      onClick={() => setShowNewTask(col)}
                    >
                      + Add task
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Activity */}
      {activeTab === "activity" && (
        <div className="max-w-2xl">
          {activity.length === 0 && <p className="text-gray-400 text-sm">No activity yet.</p>}
          <ul className="space-y-3">
            {activity.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xs shrink-0">
                  {a.user.name[0].toUpperCase()}
                </div>
                <div>
                  <span className="font-medium">{a.user.name}</span>{" "}
                  <span className="text-gray-500">{actionLabel(a.action)}</span>{" "}
                  {a.entity_name && <span className="font-medium">"{a.entity_name}"</span>}
                  {a.meta?.old_status && a.meta?.new_status && (
                    <span className="text-gray-400"> from {humanStatus(String(a.meta.old_status))} → {humanStatus(String(a.meta.new_status))}</span>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{timeAgo(a.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Task detail modal */}
      {selectedTaskId && (
        <TaskModal
          projectId={projectId}
          taskId={selectedTaskId}
          users={users}
          isEditor={isEditor}
          onClose={() => setSelectedTaskId(null)}
          onTaskUpdate={(updated) => setTasks((t) => t.map((x) => (x.id === updated.id ? updated : x)))}
          onTaskDelete={(taskId) => { setTasks((t) => t.filter((x) => x.id !== taskId)); setSelectedTaskId(null); }}
        />
      )}
    </div>
  );
}
