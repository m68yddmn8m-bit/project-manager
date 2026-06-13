import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "../api";
import type { Project } from "../types";
import { formatDate, humanStatus, STATUS_COLORS } from "../utils/format";
import clsx from "clsx";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", due_date: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.listProjects().then(setProjects).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const project = await api.createProject({
        name: form.name,
        description: form.description || undefined,
        due_date: form.due_date || undefined,
      });
      setProjects((prev) => [project, ...prev]);
      setForm({ name: "", description: "", due_date: "" });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-16 text-gray-400">Loading…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + New project
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">New Project</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                className="input"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due date</label>
              <input
                type="date"
                className="input"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Creating…" : "Create project"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {projects.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">No projects yet.</p>
          <p className="text-sm mt-1">Create your first project to get started.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <Link key={p.id} to={`/projects/${p.id}`} className="card p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-2">
              <h2 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                {p.name}
              </h2>
              <span className={clsx("badge ml-2 shrink-0", STATUS_COLORS[p.status])}>
                {humanStatus(p.status)}
              </span>
            </div>
            {p.description && (
              <p className="text-sm text-gray-500 line-clamp-2 mb-3">{p.description}</p>
            )}
            <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-2 border-t border-gray-100">
              <span>{p.task_count} task{p.task_count !== 1 ? "s" : ""}</span>
              <span>{p.members.length + 1} member{p.members.length !== 0 ? "s" : ""}</span>
              {p.due_date && <span>Due {formatDate(p.due_date)}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
