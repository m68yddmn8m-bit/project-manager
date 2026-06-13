export interface User {
  id: number;
  email: string;
  name: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
}

export interface ProjectMember {
  id: number;
  user: User;
  role: "admin" | "editor" | "viewer";
  joined_at: string;
}

export type ProjectStatus = "active" | "completed" | "on_hold" | "archived";

export interface Project {
  id: number;
  name: string;
  description: string | null;
  status: ProjectStatus;
  owner_id: number;
  owner: User;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  members: ProjectMember[];
  task_count: number;
}

export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Subtask {
  id: number;
  task_id: number;
  title: string;
  is_completed: boolean;
  position: number;
  created_at: string;
}

export interface Task {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: User | null;
  created_by: User;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  subtasks: Subtask[];
  comment_count: number;
}

export interface Comment {
  id: number;
  task_id: number;
  body: string;
  author: User;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: number;
  project_id: number;
  user: User;
  action: string;
  entity_type: string;
  entity_id: number | null;
  entity_name: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface Notification {
  id: number;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export type WsEvent =
  | { event: "task_created"; data: Task }
  | { event: "task_updated"; data: Task }
  | { event: "task_deleted"; data: { id: number } }
  | { event: "subtask_created"; data: { task_id: number; subtask: Subtask } }
  | { event: "subtask_updated"; data: { task_id: number; subtask: Subtask } }
  | { event: "subtask_deleted"; data: { task_id: number; subtask_id: number } }
  | { event: "comment_added"; data: { task_id: number; comment: Comment } }
  | { event: "comment_updated"; data: { task_id: number; comment: Comment } }
  | { event: "comment_deleted"; data: { task_id: number; comment_id: number } };
