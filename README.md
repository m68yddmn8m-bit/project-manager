# ProjectHub — Collaborative Project Manager

A full-stack project management app for teams. Supports projects, tasks, subtasks, comments, real-time updates, activity logs, and email notifications.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python 3.12) |
| Database | PostgreSQL 16 |
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Real-time | WebSockets (FastAPI native) |
| Auth | JWT (7-day tokens) |
| Email | SMTP (configurable — Gmail, SendGrid, etc.) |
| Hosting | Railway (backend + DB) + Vercel (frontend) |

---

## Local Development (Docker)

### Prerequisites
- Docker + Docker Compose installed

### Steps

```bash
# 1. Clone the repo
cd project-manager

# 2. Copy and configure backend env
cp backend/.env.example backend/.env
# Edit backend/.env — fill in SMTP settings if you want email (optional)

# 3. Start everything
docker compose up

# 4. Open the app
open http://localhost:5173
```

### Create the first user

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","name":"Admin","password":"password123"}'
```

Repeat for each of your 5 users with different emails.

---

## Production Deployment

### Backend → Railway

1. Create a new project at [railway.app](https://railway.app)
2. Add a **PostgreSQL** database service
3. Add a new service from your GitHub repo, pointing to the `backend/` folder
4. Set environment variables:
   ```
   DATABASE_URL      → (Railway auto-populates from the DB service)
   SECRET_KEY        → (generate: python -c "import secrets; print(secrets.token_hex(32))")
   SMTP_HOST         → smtp.gmail.com
   SMTP_PORT         → 587
   SMTP_USER         → your-email@gmail.com
   SMTP_PASSWORD     → your-app-password
   EMAILS_FROM       → your-email@gmail.com
   FRONTEND_URL      → https://your-app.vercel.app
   ```
5. Railway will build the Dockerfile and deploy automatically

### Frontend → Vercel

1. Import the repo at [vercel.com](https://vercel.com), set root to `frontend/`
2. Set build command: `npm run build`, output: `dist`
3. Add environment variable:
   ```
   VITE_API_BASE_URL=https://your-backend.railway.app
   ```
4. Update `frontend/vite.config.ts` proxy target to point to Railway URL for prod

> **Note:** After deploying, update `FRONTEND_URL` in Railway to match your Vercel URL, then redeploy the backend.

---

## Features

### Projects
- Create projects with name, description, due date
- Status tracking: Active, Completed, On Hold, Archived
- Add/remove team members with roles: **admin**, **editor**, **viewer**

### Tasks
- Kanban board with 4 columns: To Do, In Progress, Review, Done
- Assign tasks to team members
- Priority levels: Low, Medium, High, Urgent
- Due dates

### Subtasks
- Checklist-style subtasks per task
- Progress shown on task cards

### Comments
- Per-task threaded comments
- Edit/delete your own comments
- Real-time updates to other users on the same project

### Real-time Collaboration
- All task/subtask/comment changes broadcast instantly to all connected users via WebSocket
- No page refresh needed

### Notifications
- In-app bell icon with unread count
- Email notifications for:
  - Task assignment
  - Status changes (notifies assignee)
  - New comments (notifies assignee + task creator)

### Activity Log
- Full audit trail per project: who did what, when

---

## API Reference

The backend auto-generates interactive docs:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## Adding Users

Since this is a closed team tool (no public signup), register each user via the API after deploying:

```bash
curl -X POST https://your-backend.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@country.com",
    "name": "User Name",
    "password": "their-password",
    "timezone": "America/New_York"
  }'
```

Each user logs in at your Vercel URL with their email/password.
