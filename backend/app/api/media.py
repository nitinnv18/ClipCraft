import os
import re
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse, FileResponse, Response
from app.core.config import settings

router = APIRouter(prefix="/media", tags=["Media"])

@router.api_route("/{folder}/{filename}", methods=["GET", "HEAD"])
async def get_media_file(folder: str, filename: str, request: Request):
    base_dir = os.path.join(settings.TEMP_STORAGE_DIR, "public_media", folder)
    file_path = os.path.join(base_dir, filename)

    # Security check to prevent directory traversal
    resolved_path = os.path.abspath(file_path)
    if not resolved_path.startswith(os.path.abspath(settings.TEMP_STORAGE_DIR)):
        raise HTTPException(status_code=403, detail="Access denied.")

    if not os.path.exists(resolved_path):
        raise HTTPException(status_code=404, detail="File not found.")

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
        def iterfile_full():
            with open(resolved_path, mode="rb") as file_like:
                while chunk := file_like.read(1024 * 1024):
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

    def iterfile_range():
        with open(resolved_path, mode="rb") as file_like:
            file_like.seek(start)
            bytes_left = chunk_size
            while bytes_left > 0:
                read_len = min(1024 * 512, bytes_left)
                chunk = file_like.read(read_len)
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
