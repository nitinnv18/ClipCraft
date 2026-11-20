# ClipCraft — Automatic Short Clips & Video Repurposing Platform

ClipCraft is an enterprise-grade automated video platform that transforms long-form YouTube videos and local video files into high-retention 9:16 vertical short clips powered by AI.

---

## 🎨 Non-Negotiable Design Rules
- **0px Border Radius**: Every UI component (`button`, `input`, `card`, `modal`, `video`, `badge`, `table`) strictly enforces `border-radius: 0px`.
- **Zero Gradients**: No gradients anywhere; strictly crisp solid colors.
- **Editorial & Utilitarian Aesthetic**: Sharp, structured, minimal design modeled after professional video editing suites.

---

## 🏗️ Architecture & Technology Stack

```text
               YouTube URL / Local Video Upload
                              │
                    POST /api/jobs
                              │
                  ┌───────────▼───────────┐
                  │      FastAPI API      │
                  └───────────┬───────────┘
                              │
                     Redis / Async Queue
                              │
                  ┌───────────▼───────────┐
                  │  Video Worker Process │
                  ├───────────────────────┤
                  │ 1. Transcript Extract │
                  │ 2. AI Moment Detect   │
                  │ 3. Boundary Optimizer │
                  │ 4. FFmpeg 9:16 Crop   │
                  │ 5. Caption Rendering  │
                  │ 6. Cloud Storage / CDN│
                  └───────────┬───────────┘
                              │
                     Results & Streaming
```

### Components:
- **Backend**: Python 3.11+ FastAPI (Pydantic v2, Motor MongoDB, Redis Queue, FFmpeg processor, Gemini / Groq AI).
- **User Panel** (`frontend/userpanel`): Next.js 16 (App Router, Port 3000), Client-side WebAssembly FFmpeg (`@ffmpeg/ffmpeg`), Tailwind CSS v4, Lucide Icons.
- **Admin Panel** (`frontend/adminpanel`): Next.js 16 (App Router, Port 3001), Analytics dashboard, user management, audit logs, system settings.
- **Database**: MongoDB (Atlas or local) with in-memory resilient fallback.
- **Queue**: Redis Queue with in-process asyncio fallback.
- **Media Engine**: Server-side FFmpeg + yt-dlp + Client-side WebAssembly FFmpeg.

---

## 🚀 Quick Start Guide

### Option A: One-Click Docker Setup (Recommended for Local Dev)

Start MongoDB, Redis, and Backend in one command:
```bash
docker compose up -d
```
- Backend Health Check: [http://localhost:8000/health](http://localhost:8000/health)
- API Docs (Swagger): [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Option B: Manual Local Setup

#### 1. Backend (FastAPI)
```bash
cd backend

# Setup environment
cp .env.example .env

# Install dependencies
pip install -r requirements.txt

# Run server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
API runs on `http://localhost:8000`.

#### 2. User Portal (Port 3000)
```bash
cd frontend/userpanel

# Setup environment
cp .env.example .env.local

# Install & Run
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

#### 3. Admin Portal (Port 3001)
```bash
cd frontend/adminpanel

# Setup environment
cp .env.example .env.local

# Install & Run
npm install
npm run dev
```
Open [http://localhost:3001](http://localhost:3001) in your browser.

Default Super Admin Login:
- **Email:** `admin@clipcraft.io`
- **Password:** Configure `SUPER_ADMIN_PASSWORD` in `backend/.env` (or default seed password on first startup).

---

## 🧪 Testing

Run backend automated tests:
```bash
cd backend
pytest -v
```

Automated continuous integration is pre-configured via GitHub Actions in `.github/workflows/ci.yml`.

---

## 📦 Deployment

- **Backend**: Pre-configured for Docker / Render via `render.yaml` and `backend/Dockerfile`.
- **Frontend**: Deploy `frontend/userpanel` and `frontend/adminpanel` directly to Vercel.
