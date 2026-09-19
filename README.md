# ClipCraft — Automatic Short Clips Platform

ClipCraft is a professional, high-performance automated video utility that transforms long-form YouTube videos into high-retention 9:16 vertical short-form clips.

---

## 🎨 Non-Negotiable Design Rules
- **0px Border Radius**: Every UI component (`button`, `input`, `card`, `modal`, `video`, `badge`, `table`) strictly enforces `border-radius: 0px` (`--radius: 0px`).
- **Zero Gradients**: No `linear-gradient`, `radial-gradient`, `conic-gradient`, or gradient buttons/text anywhere. Strictly solid colors.
- **Editorial & Utilitarian Aesthetic**: Sharp, structured, minimal, and high-readability design modeled after professional video editing suites.

---

## 🏗️ Architecture & Technology Stack

```text
               YouTube URL Input
                      │
              POST /api/jobs
                      │
          ┌───────────▼───────────┐
          │     FastAPI API       │
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
          │ 6. Cloudinary Upload  │
          └───────────┬───────────┘
                      │
             Results & Streaming
```

### Components:
- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Lucide Icons.
- **Backend**: Python 3.11+ FastAPI with modular Service Provider Abstractions:
  - `BaseTranscriptProvider` / `YouTubeTranscriptProvider`
  - `BaseAIProvider` / `GeminiAIProvider`
  - `BaseVideoProcessor` / `FFmpegVideoProcessor`
  - `BaseStorageProvider` / `CloudinaryStorageProvider`
  - `BaseQueueProvider` / `RedisQueueProvider`
- **Database**: MongoDB (User, VideoJob, Clip collections with Motor).
- **Video Engine**: FFmpeg (Stream trimming, 9:16 vertical crop, burned captions, thumbnails).
- **Media Storage**: Cloudinary with local storage fallback.

---

## 🚀 Quick Start

### 1. Environment Setup
Copy the environment template:
```bash
cp .env.example backend/.env
cp .env.example frontend/.env.local
```

### 2. Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Health Check: `http://localhost:8000/health` (Returns `{"status": "ok"}`)

### 3. Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Running Tests
```bash
cd backend
pytest tests/ -v
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service health status |
| `POST` | `/api/auth/register` | Create user account |
| `POST` | `/api/auth/login` | Authenticate & get JWT token |
| `GET` | `/api/auth/me` | Current user profile |
| `POST` | `/api/jobs` | Submit new video clipping job |
| `GET` | `/api/jobs` | List user jobs |
| `GET` | `/api/jobs/{id}` | Get job details and progress |
| `GET` | `/api/jobs/{id}/clips` | Get generated clips |
| `DELETE` | `/api/jobs/{id}` | Delete job & associated media |
