import api from "./client";
import type {
  Activity,
  Comment,
  Notification,
  Project,
  Subtask,
  Task,
  User,
} from "../types";

// Auth
export const login = (email: string, password: string) =>
  api.post<{ access_token: string; user: User }>("/auth/login", { email, password }).then((r) => r.data);

export const register = (email: string, name: string, password: string, timezone = "UTC") =>
  api.post<User>("/auth/register", { email, name, password, timezone }).then((r) => r.data);

export const getMe = () => api.get<User>("/auth/me").then((r) => r.data);

export const updateMe = (data: { name?: string; timezone?: string; password?: string }) =>
  api.patch<User>("/auth/me", data).then((r) => r.data);

export const listUsers = () => api.get<User[]>("/auth/users").then((r) => r.data);

// Projects
export const listProjects = () => api.get<Project[]>("/projects").then((r) => r.data);

export const getProject = (id: number) => api.get<Project>(`/projects/${id}`).then((r) => r.data);

export const createProject = (data: { name: string; description?: string; due_date?: string }) =>
  api.post<Project>("/projects", data).then((r) => r.data);

export const updateProject = (id: number, data: Partial<{ name: string; description: string; status: string; due_date: string }>) =>
  api.patch<Project>(`/projects/${id}`, data).then((r) => r.data);

export const deleteProject = (id: number) => api.delete(`/projects/${id}`);

export const addMember = (projectId: number, userId: number, role: string) =>
  api.post(`/projects/${projectId}/members`, { user_id: userId, role });

export const removeMember = (projectId: number, userId: number) =>
  api.delete(`/projects/${projectId}/members/${userId}`);

// Tasks
export const listTasks = (projectId: number) =>
  api.get<Task[]>(`/projects/${projectId}/tasks`).then((r) => r.data);

export const getTask = (projectId: number, taskId: number) =>
  api.get<Task>(`/projects/${projectId}/tasks/${taskId}`).then((r) => r.data);

export const createTask = (projectId: number, data: Partial<Task> & { title: string }) =>
  api.post<Task>(`/projects/${projectId}/tasks`, data).then((r) => r.data);

export const updateTask = (projectId: number, taskId: number, data: Partial<Task>) =>
  api.patch<Task>(`/projects/${projectId}/tasks/${taskId}`, data).then((r) => r.data);

export const deleteTask = (projectId: number, taskId: number) =>
  api.delete(`/projects/${projectId}/tasks/${taskId}`);

// Subtasks
export const createSubtask = (projectId: number, taskId: number, title: string) =>
  api.post<Subtask>(`/projects/${projectId}/tasks/${taskId}/subtasks`, { title }).then((r) => r.data);

export const updateSubtask = (projectId: number, taskId: number, subtaskId: number, data: Partial<Subtask>) =>
  api.patch<Subtask>(`/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}`, data).then((r) => r.data);

export const deleteSubtask = (projectId: number, taskId: number, subtaskId: number) =>
  api.delete(`/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}`);

// Comments
export const listComments = (projectId: number, taskId: number) =>
  api.get<Comment[]>(`/projects/${projectId}/tasks/${taskId}/comments`).then((r) => r.data);

export const createComment = (projectId: number, taskId: number, body: string) =>
  api.post<Comment>(`/projects/${projectId}/tasks/${taskId}/comments`, { body }).then((r) => r.data);

export const updateComment = (projectId: number, taskId: number, commentId: number, body: string) =>
  api.patch<Comment>(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}`, { body }).then((r) => r.data);

export const deleteComment = (projectId: number, taskId: number, commentId: number) =>
  api.delete(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}`);

// Activity
export const listActivity = (projectId: number) =>
  api.get<Activity[]>(`/projects/${projectId}/activity`).then((r) => r.data);

// Notifications
export const listNotifications = () =>
  api.get<Notification[]>("/notifications").then((r) => r.data);

export const markNotificationRead = (id: number) => api.post(`/notifications/${id}/read`);

export const markAllNotificationsRead = () => api.post("/notifications/read-all");
