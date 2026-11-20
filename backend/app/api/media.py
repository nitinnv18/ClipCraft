import os
import re
import anyio
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse, FileResponse, Response
from app.core.config import settings

router = APIRouter(prefix="/media", tags=["Media"])

ALLOWED_MEDIA_FOLDERS = {"clips", "thumbnails"}

import os
import re
from typing import Optional
import anyio
from fastapi import APIRouter, HTTPException, Request, Query, status
from fastapi.responses import StreamingResponse, FileResponse, Response
from app.core.config import settings
from app.core.security import decode_access_token
from app.db.mongodb import get_database
from app.db.memory_store import memory_store

router = APIRouter(prefix="/media", tags=["Media"])

ALLOWED_MEDIA_FOLDERS = {"clips", "thumbnails"}

@router.api_route("/{folder}/{filename}", methods=["GET", "HEAD"])
async def get_media_file(
    folder: str,
    filename: str,
    request: Request,
    token: Optional[str] = Query(None)
):
    if folder not in ALLOWED_MEDIA_FOLDERS or ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    public_root = os.path.abspath(os.path.join(settings.TEMP_STORAGE_DIR, "public_media"))
    base_dir = os.path.abspath(os.path.join(public_root, folder))
    resolved_path = os.path.abspath(os.path.join(base_dir, filename))

    # Security check: must strictly be inside public_media
    if not resolved_path.startswith(public_root + os.sep):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    if not os.path.exists(resolved_path):
        raise HTTPException(status_code=404, detail="File not found.")

    # ── Authentication & IDOR Authorization ──────────────────────────────────
    raw_token = token
    if not raw_token:
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.lower().startswith("bearer "):
            raw_token = auth_header[7:].strip()
        elif request.cookies.get("clipcraft_token"):
            raw_token = request.cookies.get("clipcraft_token")
        elif request.cookies.get("admin_token"):
            raw_token = request.cookies.get("admin_token")

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required to access media.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    payload = decode_access_token(raw_token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Allow admins to access any media
    is_admin = (
        payload.get("type") == "admin"
        or payload.get("role") in ["admin", "superadmin", "super_admin"]
    )

    if not is_admin:
        user_id = str(payload.get("sub"))
        base_name = os.path.splitext(filename)[0]
        db = get_database()

        # Find associated clip or job to verify ownership
        owner_id: Optional[str] = None

        # 1. Look in memory store clips
        clip = memory_store.get_clip(base_name)
        if not clip:
            for c in memory_store.get_all_clips():
                if (
                    c.get("id") == base_name
                    or c.get("_id") == base_name
                    or filename in (c.get("videoUrl") or "")
                    or filename in (c.get("thumbnailUrl") or "")
                ):
                    clip = c
                    break

        # 2. Look in database clips
        if not clip and db is not None:
            try:
                clip = await db.clips.find_one({
                    "$or": [
                        {"_id": base_name},
                        {"id": base_name},
                        {"videoUrl": {"$regex": re.escape(filename)}},
                        {"thumbnailUrl": {"$regex": re.escape(filename)}}
                    ]
                })
            except Exception:
                pass

        if clip:
            owner_id = str(clip.get("userId") or "")
            if not owner_id and clip.get("jobId"):
                job_id = clip["jobId"]
                job = memory_store.get_job(job_id)
                if not job and db is not None:
                    try:
                        job = await db.jobs.find_one({"_id": job_id})
                    except Exception:
                        pass
                if job:
                    owner_id = str(job.get("userId") or "")

        # 3. Look in jobs (for job thumbnails or job-named files)
        if not owner_id:
            job = memory_store.get_job(base_name)
            if not job:
                for j in memory_store.get_all_jobs():
                    if (
                        j.get("id") == base_name
                        or j.get("_id") == base_name
                        or filename in (j.get("thumbnail") or "")
                    ):
                        job = j
                        break
            if not job and db is not None:
                try:
                    job = await db.jobs.find_one({
                        "$or": [
                            {"_id": base_name},
                            {"id": base_name},
                            {"thumbnail": {"$regex": re.escape(filename)}}
                        ]
                    })
                except Exception:
                    pass
            if job:
                owner_id = str(job.get("userId") or "")

        # IDOR check: requesting user must own the media
        if not owner_id or owner_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You do not own this media."
            )

    # If it's an image thumbnail, return standard FileResponse
    if not filename.endswith(".mp4"):
        return FileResponse(
            resolved_path,
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=86400"}
        )

    file_size = os.path.getsize(resolved_path)

    # Handle HEAD request for MP4 video
    if request.method == "HEAD":
        headers = {
            "Content-Length": str(file_size),
            "Accept-Ranges": "bytes",
            "Content-Type": "video/mp4",
            "Cache-Control": "public, max-age=3600"
        }
        return Response(status_code=status.HTTP_200_OK, headers=headers, media_type="video/mp4")

    # Full RFC 7233 HTTP Range streaming for MP4 videos
    range_header = request.headers.get("range")

    if not range_header:
        async def iterfile_full():
            async with await anyio.open_file(resolved_path, mode="rb") as file_like:
                while chunk := await file_like.read(1024 * 1024):
                    yield chunk

        headers = {
            "Content-Length": str(file_size),
            "Accept-Ranges": "bytes",
            "Content-Type": "video/mp4",
            "Cache-Control": "public, max-age=3600"
        }
        return StreamingResponse(iterfile_full(), headers=headers, media_type="video/mp4")

    # Parse byte range header
    range_match = re.match(r"bytes=(\d+)-(\d*)", range_header)
    if not range_match:
        raise HTTPException(status_code=416, detail="Requested Range Not Satisfiable")

    start = int(range_match.group(1))
    end = int(range_match.group(2)) if range_match.group(2) else file_size - 1

    if start >= file_size or end >= file_size or start > end:
        raise HTTPException(status_code=416, detail="Requested Range Not Satisfiable")

    chunk_size = end - start + 1

    async def iterfile_range():
        async with await anyio.open_file(resolved_path, mode="rb") as file_like:
            await file_like.seek(start)
            bytes_left = chunk_size
            while bytes_left > 0:
                read_len = min(1024 * 512, bytes_left)
                chunk = await file_like.read(read_len)
                if not chunk:
                    break
                bytes_left -= len(chunk)
                yield chunk

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(chunk_size),
        "Content-Type": "video/mp4",
        "Cache-Control": "public, max-age=3600"
    }

    return StreamingResponse(
        iterfile_range(),
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        headers=headers,
        media_type="video/mp4"
    )
