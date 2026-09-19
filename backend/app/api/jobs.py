import os
import uuid
import shutil
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request, UploadFile, File, Form, status
from app.core.config import settings
from app.models.user import UserResponse
from app.models.job import JobCreateRequest, JobResponse
from app.models.clip import ClipResponse
from app.api.auth import get_current_user
from app.services.job_service import job_service
from app.middleware.rate_limit import limiter, JOB_CREATE_LIMIT

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
        client_ip = (
            request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            or request.headers.get("x-real-ip", "").strip()
            or (request.client.host if request.client else None)
        )
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
    saveToCloud: bool = Form(True),
    current_user: UserResponse = Depends(get_current_user)
):
    filename = file.filename or "uploaded_video.mp4"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"]:
        raise HTTPException(status_code=400, detail="Unsupported video format. Please upload MP4, MOV, or WEBM.")

    # Save uploaded video file
    upload_dir = os.path.join(settings.TEMP_STORAGE_DIR, "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    temp_file_id = uuid.uuid4().hex[:12]
    saved_file_path = os.path.join(upload_dir, f"video_{temp_file_id}{ext}")

    try:
        with open(saved_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")
    finally:
        await file.close()

    try:
        client_ip = (
            request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            or request.headers.get("x-real-ip", "").strip()
            or (request.client.host if request.client else None)
        )
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


@router.get("", response_model=List[JobResponse])
async def list_user_jobs(current_user: UserResponse = Depends(get_current_user)):
    jobs = await job_service.get_user_jobs(current_user.id)
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

