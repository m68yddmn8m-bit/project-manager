import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  return isValid(d) ? format(d, "MMM d, yyyy") : "—";
}

export function timeAgo(iso: string): string {
  const d = parseISO(iso);
  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : "";
}

export const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export const STATUS_COLORS: Record<string, string> = {
  todo: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  review: "bg-purple-100 text-purple-700",
  done: "bg-green-100 text-green-700",
  active: "bg-green-100 text-green-700",
  on_hold: "bg-yellow-100 text-yellow-700",
  completed: "bg-gray-100 text-gray-500",
  archived: "bg-gray-100 text-gray-400",
};

export function humanStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function actionLabel(action: string): string {
  const map: Record<string, string> = {
    created_project: "created the project",
    updated_project: "updated the project",
    created_task: "created task",
    updated_task: "updated task",
    updated_status: "moved task",
    deleted_task: "deleted task",
    created_subtask: "added subtask",
    added_comment: "commented on",
  };
  return map[action] ?? action.replace(/_/g, " ");
}
