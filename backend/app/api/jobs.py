import os
import uuid
import anyio
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request, UploadFile, File, Form, Query, status
from app.core.config import settings
from app.models.user import UserResponse
from app.models.job import JobCreateRequest, JobResponse, JobStatus, JobStage, JobSettings
from app.models.clip import ClipResponse
from app.api.auth import get_current_user
from app.services.job_service import job_service
from app.db.memory_store import memory_store
from app.db.mongodb import get_database
from app.core.utils import utc_now
from app.core.logging import logger
from app.middleware.rate_limit import limiter, get_real_client_ip, JOB_CREATE_LIMIT, CLIENT_SYNC_LIMIT

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(JOB_CREATE_LIMIT)
async def create_job(
    req: JobCreateRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    current_user: UserResponse = Depends(get_current_user)
):
    try:
        client_ip = get_real_client_ip(request)
        job_doc = await job_service.create_job(
            req,
            current_user.id,
            background_tasks_handler=background_tasks,
            client_ip=client_ip
        )
        return JobResponse(**job_doc)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/upload", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(JOB_CREATE_LIMIT)
async def upload_video_and_create_job(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    clipCount: int = Form(5),
    minDuration: int = Form(30),
    maxDuration: int = Form(60),
    format: str = Form("9:16"),
    captions: bool = Form(True),
    saveToCloud: bool = Form(False),
    current_user: UserResponse = Depends(get_current_user)
):
    filename = file.filename or "uploaded_video.mp4"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"]:
        raise HTTPException(status_code=400, detail="Unsupported video format. Please upload MP4, MOV, or WEBM.")

    # Save uploaded video file with maximum size enforcement (500MB)
    upload_dir = os.path.join(settings.TEMP_STORAGE_DIR, "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    temp_file_id = uuid.uuid4().hex[:12]
    saved_file_path = os.path.join(upload_dir, f"video_{temp_file_id}{ext}")

    MAX_UPLOAD_SIZE = 500 * 1024 * 1024  # 500 MB limit
    CHUNK_SIZE = 1024 * 1024             # 1 MB
    total_bytes = 0

    try:
        async with await anyio.open_file(saved_file_path, "wb") as buffer:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="Uploaded video exceeds the maximum permissible limit of 500MB."
                    )
                await buffer.write(chunk)
    except HTTPException:
        if os.path.exists(saved_file_path):
            try:
                os.remove(saved_file_path)
            except Exception:
                pass
        raise
    except Exception as e:
        if os.path.exists(saved_file_path):
            try:
                os.remove(saved_file_path)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")
    finally:
        await file.close()

    try:
        client_ip = get_real_client_ip(request)
        job_doc = await job_service.create_upload_job(
            file_path=saved_file_path,
            filename=filename,
            user_id=current_user.id,
            clip_count=clipCount,
            min_duration=minDuration,
            max_duration=maxDuration,
            format_ratio=format,
            captions=captions,
            save_to_cloud=saveToCloud,
            background_tasks_handler=background_tasks,
            client_ip=client_ip
        )
        return JobResponse(**job_doc)
    except Exception as e:
        if os.path.exists(saved_file_path):
            os.remove(saved_file_path)
        raise HTTPException(status_code=400, detail=str(e))


class ClientPlanRequest(BaseModel):
    duration: float = Field(ge=5.0)
    title: Optional[str] = "Video"
    clipCount: int = Field(default=5, ge=1, le=10)
    minDuration: int = Field(default=30, ge=15, le=180)
    maxDuration: int = Field(default=60, ge=20, le=300)

    @model_validator(mode="after")
    def validate_durations(self) -> "ClientPlanRequest":
        if self.minDuration > self.maxDuration:
            self.maxDuration = self.minDuration + 15
        return self


@router.post("/plan")
@limiter.limit(JOB_CREATE_LIMIT)
async def generate_clipping_plan(
    req: ClientPlanRequest,
    request: Request,
    current_user: UserResponse = Depends(get_current_user)
):
    """AI moment detection for client-side rendering with Groq Llama 3.3 support."""
    from app.providers.ai.groq_provider import GroqProvider
    from app.services.ranking_engine import ClipRankingEngine
    
    groq_provider = GroqProvider()
    candidates = await groq_provider.detect_clips(
        transcript_segments=[],
        video_duration=req.duration,
        title=req.title,
        target_clip_count=req.clipCount,
        min_duration=req.minDuration,
        max_duration=req.maxDuration
    )
    ranked = ClipRankingEngine.filter_and_rank_clips(
        candidates=candidates,
        target_count=req.clipCount,
        min_duration=req.minDuration,
        max_duration=req.maxDuration
    )
    
    formatted_clips = []
    for idx, c in enumerate(ranked):
        clip_dict = c.model_dump() if hasattr(c, "model_dump") else c.dict()
        clip_dict["id"] = getattr(c, "id", None) or f"clip_{idx + 1}"
        dur = max(1.0, c.end - c.start)
        hook_text = getattr(c, "hook", "") or getattr(c, "title", "Watch what happens next")
        words = hook_text.split()
        chunk_size = 4
        chunks = [" ".join(words[i:i+chunk_size]) for i in range(0, len(words), chunk_size)] or [hook_text]
        step = dur / len(chunks)
        clip_dict["subtitles"] = [
            {"start": round(idx * step, 2), "end": round((idx + 1) * step, 2), "text": chunk}
            for idx, chunk in enumerate(chunks)
        ]
        formatted_clips.append(clip_dict)

    return {
        "clips": formatted_clips,
        "videoDuration": req.duration
    }


@router.post("/plan-audio")
@limiter.limit(JOB_CREATE_LIMIT)
async def generate_clipping_plan_with_audio(
    request: Request,
    file: Optional[UploadFile] = File(None),
    title: str = Form("Video"),
    duration: float = Form(60.0),
    clipCount: int = Form(5),
    minDuration: int = Form(30),
    maxDuration: int = Form(60),
    language: Optional[str] = Form("auto"),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Ultra-fast Groq Whisper speech transcription + Llama viral moments with multilingual support.
    Transcribes spoken dialogue in 1 second and extracts genuine viral captions.
    """
    from app.providers.ai.groq_provider import GroqProvider
    from app.services.ranking_engine import ClipRankingEngine

    groq_provider = GroqProvider()
    segments = []

    if duration <= 0 or duration > 86400:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Video duration must be between 1 second and 24 hours."
        )

    if minDuration > maxDuration:
        maxDuration = minDuration + 15

    if file and file.filename:
        try:
            # Enforce max 25MB audio limit via chunked streaming to prevent memory exhaustion DoS
            MAX_AUDIO_SIZE = 25 * 1024 * 1024
            CHUNK_SIZE = 1024 * 1024  # 1 MB chunks
            audio_buffer = bytearray()
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                audio_buffer.extend(chunk)
                if len(audio_buffer) > MAX_AUDIO_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="Audio file exceeds 25MB limit."
                    )
            audio_bytes = bytes(audio_buffer)
            if len(audio_bytes) > 0:
                logger.info(f"Transcribing {len(audio_bytes)} bytes audio with Groq Whisper in language={language}...")
                segments = await groq_provider.transcribe_audio_bytes(audio_bytes, file.filename, language=language)
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Audio read/transcribe notice: {e}")
        finally:
            await file.close()

    candidates = await groq_provider.detect_clips(
        transcript_segments=segments,
        video_duration=duration,
        title=title,
        target_clip_count=clipCount,
        min_duration=minDuration,
        max_duration=maxDuration,
        language=language
    )

    ranked = ClipRankingEngine.filter_and_rank_clips(
        candidates=candidates,
        target_count=clipCount,
        min_duration=minDuration,
        max_duration=maxDuration
    )

    formatted_clips = []
    for idx, c in enumerate(ranked):
        clip_dict = c.model_dump() if hasattr(c, "model_dump") else c.dict()
        clip_dict["id"] = getattr(c, "id", None) or f"clip_{idx + 1}"
        dur = max(1.0, c.end - c.start)
        clip_subs = []

        # Extract genuine voice-synced transcript segments falling into this clip's time range
        for s in segments:
            s_start = s.get("start")
            s_end = s.get("end")
            s_start_val = float(s_start) if s_start is not None else 0.0
            s_end_val = float(s_end) if s_end is not None else s_start_val + 1.0
            if s_end_val >= c.start and s_start_val <= c.end:
                rel_start = max(0.0, round(s_start_val - c.start, 2))
                rel_end = min(dur, max(rel_start + 0.4, round(s_end_val - c.start, 2)))
                text = s.get("text", "").strip()
                if text:
                    clip_subs.append({
                        "start": rel_start,
                        "end": rel_end,
                        "text": text
                    })

        # Fallback if no specific spoken dialogue matched this slice
        if not clip_subs:
            hook_text = getattr(c, "hook", "") or getattr(c, "title", "Watch what happens next")
            words = hook_text.split()
            chunk_size = 4
            chunks = [" ".join(words[i:i+chunk_size]) for i in range(0, len(words), chunk_size)] or [hook_text]
            step = dur / len(chunks)
            for idx, chunk in enumerate(chunks):
                clip_subs.append({
                    "start": round(idx * step, 2),
                    "end": round((idx + 1) * step, 2),
                    "text": chunk
                })

        clip_dict["subtitles"] = clip_subs
        formatted_clips.append(clip_dict)

    return {
        "clips": formatted_clips,
        "videoDuration": duration,
        "transcriptCount": len(segments),
        "hasRealSpeech": len(segments) > 0
    }


class ClientClipSyncItem(BaseModel):
    id: str
    title: str
    hook: Optional[str] = "Watch what happens next!"
    score: int = 90
    start: float
    end: float
    duration: float
    thumbnailUrl: Optional[str] = None
    blobUrl: Optional[str] = None


class ClientJobSyncRequest(BaseModel):
    id: Optional[str] = None
    title: str
    duration: float
    clipCount: int
    format: Optional[str] = "9:16"
    status: Optional[str] = "completed"
    progress: Optional[int] = 100
    userId: Optional[str] = None
    userEmail: Optional[str] = None
    error: Optional[str] = None
    clips: List[ClientClipSyncItem] = []


@router.post("/client-sync", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(CLIENT_SYNC_LIMIT)
async def sync_client_job(
    request: Request,
    req: ClientJobSyncRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """Synchronize on-device rendered job & clips with backend & admin panels."""
    job_id = req.id or f"job_{uuid.uuid4().hex[:12]}"
    now = utc_now()

    # Guaranteed user resolution: verified authenticated user
    uid = current_user.id
    uemail = current_user.email

    # IDOR Prevention: Check both persistent DB and in-memory store
    db = get_database()
    existing_job = None
    if db is not None:
        try:
            existing_job = await db.jobs.find_one({"_id": job_id})
        except Exception:
            pass
    if not existing_job:
        existing_job = memory_store.get_job(job_id)

    if existing_job and existing_job.get("userId"):
        # If job has an existing owner, must match current authenticated user
        if not current_user or existing_job.get("userId") != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to modify this job.")

    req_status = (req.status or "processing").lower().strip()
    if req_status in ("completed", "failed", "cancelled", "processing"):
        status_str = req_status
    else:
        status_str = "processing"

    if status_str == "completed":
        stage_str = "completed"
        st = JobStatus.COMPLETED
        stg = JobStage.COMPLETED
    elif status_str in ("failed", "cancelled"):
        stage_str = "finalizing"
        st = JobStatus.FAILED if status_str == "failed" else JobStatus.CANCELLED
        stg = JobStage.FINALIZING
    else:
        stage_str = "rendering"
        st = JobStatus.PROCESSING
        stg = JobStage.RENDERING

    formatted_clips = []
    for c in req.clips:
        c_doc = {
            "_id": c.id,
            "id": c.id,
            "jobId": job_id,
            "userId": uid,
            "userEmail": uemail,
            "startTime": c.start,
            "endTime": c.end,
            "duration": c.duration,
            "title": c.title,
            "hook": c.hook or "Viral highlight",
            "description": c.hook or "Key moment in video",
            "reason": "High retention moment",
            "category": "highlight",
            "score": c.score,
            "videoUrl": c.blobUrl or "",
            "thumbnailUrl": c.thumbnailUrl or "",
            "captionsText": None,
            "segments": None,
            "createdAt": now
        }
        formatted_clips.append(c_doc)
        memory_store.add_clip(c.id, c_doc)

    created_at = existing_job.get("createdAt", now) if existing_job else now

    job_settings = JobSettings(
        clipCount=req.clipCount,
        minDuration=15,
        maxDuration=90,
        format=req.format or "9:16",
        captions=False,
        saveToCloud=False
    )

    # Preserve duration and thumbnail from previous sync if present
    duration_val = req.duration if (req.duration and req.duration > 0) else (existing_job.get("duration", 0.0) if existing_job else 0.0)
    thumb_val = (req.clips[0].thumbnailUrl if req.clips and req.clips[0].thumbnailUrl else None) or (existing_job.get("thumbnail") if existing_job else None)

    job_doc = {
        "_id": job_id,
        "id": job_id,
        "userId": uid,
        "userEmail": uemail,
        "youtubeUrl": None,
        "videoId": "client_render",
        "sourceType": "upload",
        "title": req.title or "Client Rendered Video",
        "duration": duration_val,
        "thumbnail": thumb_val,
        "channel": "Local Device",
        "status": st,
        "progress": req.progress or (100 if status_str == "completed" else 10),
        "stage": stg,
        "clipCount": len(req.clips) or req.clipCount,
        "estimatedSeconds": 0,
        "settings": job_settings.model_dump(),
        "createdAt": created_at,
        "startedAt": created_at,
        "updatedAt": now,
        "completedAt": now if status_str == "completed" else None,
        "error": req.error if (status_str == "failed" and req.error) else None,
        "clips": formatted_clips
    }

    memory_store.set_job(job_id, job_doc)

    db = get_database()
    if db is not None:
        try:
            mongo_doc = dict(job_doc)
            mongo_doc["status"] = status_str
            mongo_doc["stage"] = stage_str
            mongo_doc["settings"] = job_settings.model_dump()
            await db.jobs.update_one({"_id": job_id}, {"$set": mongo_doc}, upsert=True)
            for c in formatted_clips:
                await db.clips.update_one({"_id": c["_id"]}, {"$set": c}, upsert=True)
        except Exception as e:
            logger.warning(f"MongoDB client job sync notice: {e}")

    logger.info(f"Synced client job {job_id} (status: {status_str}, {len(formatted_clips)} clips) for {uemail}")
    return JobResponse(**job_doc)


@router.get("", response_model=List[JobResponse])
async def list_user_jobs(
    limit: Optional[int] = Query(None, ge=1, le=100),
    skip: int = Query(0, ge=0),
    current_user: UserResponse = Depends(get_current_user)
):
    jobs = await job_service.get_user_jobs(current_user.id, limit=limit, skip=skip)
    return [JobResponse(**j) for j in jobs]


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, current_user: UserResponse = Depends(get_current_user)):
    job_doc = await job_service.get_job_by_id(job_id, user_id=current_user.id)
    if not job_doc:
        raise HTTPException(status_code=404, detail="Job not found.")
    return JobResponse(**job_doc)


@router.get("/{job_id}/clips", response_model=List[ClipResponse])
async def get_job_clips(job_id: str, current_user: UserResponse = Depends(get_current_user)):
    clips = await job_service.get_job_clips(job_id, user_id=current_user.id)
    if clips is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return [ClipResponse(**c) for c in clips]


@router.delete("/{job_id}")
async def delete_job(job_id: str, current_user: UserResponse = Depends(get_current_user)):
    job_doc = await job_service.get_job_by_id(job_id, user_id=current_user.id)
    if not job_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
    
    await job_service.delete_job(job_id, user_id=current_user.id)
    return {"status": "deleted", "jobId": job_id}

