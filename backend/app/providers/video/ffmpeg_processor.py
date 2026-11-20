import os
import asyncio
import json
from typing import Dict, Any, List, Optional, Callable
import anyio
import httpx
import yt_dlp
from app.core.config import settings
from app.core.logging import logger
from app.core.utils import extract_youtube_id
from app.providers.base import BaseVideoProcessor

class FFmpegVideoProcessor(BaseVideoProcessor):
    def __init__(self):
        os.makedirs(settings.TEMP_STORAGE_DIR, exist_ok=True)

    @staticmethod
    def extract_video_id(url_or_id: str) -> Optional[str]:
        return extract_youtube_id(url_or_id)

    def _get_base_ydl_opts(self, client_ip: Optional[str] = None) -> Dict[str, Any]:
        """Return robust yt-dlp extractor options supporting mobile Android/iOS YouTube player APIs."""
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }
        if client_ip and self._is_valid_public_ip(client_ip):
            headers['X-Forwarded-For'] = client_ip
            headers['X-Real-IP'] = client_ip

        return {
            'quiet': True,
            'no_warnings': True,
            'nocheckcertificate': False,
            'socket_timeout': 30,
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'ios'],
                }
            },
            'http_headers': headers,
        }


    @staticmethod
    def _is_valid_public_ip(ip_str: str) -> bool:
        try:
            import ipaddress
            ip = ipaddress.ip_address(ip_str)
            return ip.is_global and not ip.is_private and not ip.is_loopback and not ip.is_reserved
        except Exception:
            return False

    async def get_local_video_info(self, video_path: str) -> Dict[str, Any]:
        """Extract duration and metadata from a local video file using ffprobe."""
        try:
            cmd = [
                "ffprobe",
                "-v", "error",
                "-show_entries", "format=duration,size,bit_rate:stream=width,height,codec_name",
                "-of", "json",
                video_path
            ]
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=30.0)
            if process.returncode == 0:
                data = json.loads(stdout.decode("utf-8"))
                duration = float(data.get("format", {}).get("duration", 0.0))
                return {
                    "duration": duration,
                    "format": data.get("format", {}),
                    "streams": data.get("streams", [])
                }
        except Exception as e:
            logger.warning(f"ffprobe failed for {video_path}: {e}")

        # Fallback estimation using file size
        try:
            size_mb = os.path.getsize(video_path) / (1024 * 1024)
            # Estimate ~1.5 MB per second for 1080p video
            est_duration = max(10.0, size_mb * 0.8)
            return {"duration": est_duration}
        except Exception:
            return {"duration": 60.0}

    async def extract_audio(self, video_path: str, output_audio_path: str) -> str:
        """Extract compressed mono 16kHz speech MP3 from video for fast AI transcription."""
        os.makedirs(os.path.dirname(os.path.abspath(output_audio_path)), exist_ok=True)
        cmd = [
            "ffmpeg", "-y",
            "-i", video_path,
            "-vn",
            "-acodec", "libmp3lame",
            "-ac", "1",
            "-ar", "16000",
            "-b:a", "48k",
            output_audio_path
        ]
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=120.0)
        if process.returncode != 0 or not os.path.exists(output_audio_path):
            raise RuntimeError(f"FFmpeg audio extraction failed: {stderr.decode('utf-8', errors='ignore')}")
        return output_audio_path

    async def generate_thumbnail_from_video(self, video_path: str, output_thumb_path: str, timestamp: float = 1.0) -> str:
        """Extract a high-quality frame from local video as thumbnail."""
        os.makedirs(os.path.dirname(os.path.abspath(output_thumb_path)), exist_ok=True)
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(max(0.0, timestamp)),
            "-i", video_path,
            "-vframes", "1",
            "-q:v", "2",
            output_thumb_path
        ]
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()
        return output_thumb_path

    async def get_video_info(self, youtube_url: str, client_ip: Optional[str] = None) -> Dict[str, Any]:
        """Extract metadata without full download using yt-dlp."""
        video_id = self.extract_video_id(youtube_url)

        ydl_opts = {
            **self._get_base_ydl_opts(client_ip=client_ip),
            'skip_download': True,
        }

        def _extract():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(youtube_url, download=False)
        
        try:
            info = await asyncio.to_thread(_extract)
            return {
                "id": info.get("id") or video_id,
                "title": info.get("title", "YouTube Video"),
                "duration": float(info.get("duration", 0)),
                "thumbnail": info.get("thumbnail") or (f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg" if video_id else None),
                "channel": info.get("uploader") or info.get("channel") or "Creator",
            }
        except Exception as e:
            logger.warning(f"yt-dlp extraction failed ({e}). Attempting YouTube oEmbed fallback...")
            try:
                headers = {}
                if client_ip and self._is_valid_public_ip(client_ip):
                    headers["X-Forwarded-For"] = client_ip
                async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
                    resp = await client.get(f"https://www.youtube.com/oembed?url={youtube_url}&format=json")
                    if resp.status_code == 200:
                        data = resp.json()
                        return {
                            "id": video_id or "youtube_video",
                            "title": data.get("title", "YouTube Video"),
                            "duration": 0.0,
                            "thumbnail": data.get("thumbnail_url") or (f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg" if video_id else None),
                            "channel": data.get("author_name", "Creator"),
                        }
            except Exception as oe:
                logger.warning(f"oEmbed fallback error: {oe}")

            return {
                "id": video_id or "youtube_video",
                "title": "YouTube Video Highlights",
                "duration": 0.0,
                "thumbnail": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg" if video_id else None,
                "channel": "YouTube Creator",
            }

    async def download_clip_section(
        self,
        youtube_url: str,
        start_time: float,
        end_time: float,
        output_path: str,
        client_ip: Optional[str] = None
    ) -> str:
        """Download exact 30s-60s range with rapid stream resolver or yt-dlp fallback."""
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }
        if client_ip and self._is_valid_public_ip(client_ip):
            headers['X-Forwarded-For'] = client_ip
            headers['X-Real-IP'] = client_ip

        def _exec():
            # Attempt 2: android + ios mobile clients
            try:
                opts = {
                    'quiet': True,
                    'no_warnings': True,
                    'nocheckcertificate': True,
                    'socket_timeout': 15,
                    'http_headers': headers,
                    'extractor_args': {
                        'youtube': {
                            'player_client': ['android', 'ios'],
                        }
                    },
                    'format': 'best',
                    'download_ranges': yt_dlp.utils.download_range_func(None, [(start_time, end_time)]),
                    'outtmpl': output_path,
                    'force_keyframes_at_cuts': True,
                    'overwrites': True,
                }
                with yt_dlp.YoutubeDL(opts) as ydl:
                    ydl.extract_info(youtube_url, download=True)
                    if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                        return output_path
            except Exception as e:
                logger.debug(f"yt-dlp mobile section download notice: {e}")

            return None

        result_path = await asyncio.to_thread(_exec)
        if result_path and os.path.exists(result_path):
            return result_path

        raise RuntimeError("YouTube has temporarily rate-limited this video on cloud IP. Please try again in a few moments or upload the video directly.")

    async def download_video(
        self,
        youtube_url: str,
        output_dir: str,
        on_progress: Optional[Callable[[int, str], None]] = None,
        client_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        os.makedirs(output_dir, exist_ok=True)
        video_id = self.extract_video_id(youtube_url)
        output_template = os.path.join(output_dir, "%(id)s.%(ext)s")
        
        def ydl_progress_hook(d):
            if d.get('status') == 'downloading' and on_progress:
                total = d.get('total_bytes') or d.get('total_bytes_estimate') or 1
                downloaded = d.get('downloaded_bytes', 0)
                pct = int((downloaded / total) * 100) if total > 0 else 0
                mb_down = downloaded / (1024 * 1024)
                mb_total = total / (1024 * 1024)
                msg = f"Downloading video ({mb_down:.1f}MB / {mb_total:.1f}MB)"
                on_progress(pct, msg)

        # High fidelity download: supports up to 2160p (4K) Ultra HD
        ydl_opts = {
            **self._get_base_ydl_opts(client_ip=client_ip),
            'format': 'bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=2160]+bestaudio/best[height<=2160]/bestvideo+bestaudio/best',
            'outtmpl': output_template,
            'merge_output_format': 'mp4',
            'concurrent_fragment_downloads': 8,
            'progress_hooks': [ydl_progress_hook] if on_progress else [],
        }

        def _download():
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(youtube_url, download=True)
                    filename = ydl.prepare_filename(info)
                    if not filename.endswith(".mp4"):
                        base = os.path.splitext(filename)[0]
                        filename = f"{base}.mp4"
                    return info, filename
            except Exception as e:
                logger.warning(f"Primary download failed ({e}), attempting android/ios fallback client...")
                fallback_opts = {
                    **self._get_base_ydl_opts(client_ip=client_ip),
                    'extractor_args': {
                        'youtube': {
                            'player_client': ['android_creator', 'tv', 'android', 'ios', 'mweb'],
                        }
                    },
                    'format': 'bestvideo[height<=2160]+bestaudio/best[height<=2160]/best',
                    'outtmpl': output_template,
                    'merge_output_format': 'mp4',
                    'progress_hooks': [ydl_progress_hook] if on_progress else [],
                }
                with yt_dlp.YoutubeDL(fallback_opts) as ydl:
                    info = ydl.extract_info(youtube_url, download=True)
                    filename = ydl.prepare_filename(info)
                    if not filename.endswith(".mp4"):
                        base = os.path.splitext(filename)[0]
                        filename = f"{base}.mp4"
                    return info, filename

        try:
            info, video_path = await asyncio.to_thread(_download)
            return {
                "video_path": video_path,
                "id": info.get("id"),
                "title": info.get("title"),
                "duration": float(info.get("duration", 0)),
                "thumbnail": info.get("thumbnail"),
                "channel": info.get("uploader")
            }
        except Exception as dl_err:
            logger.warning(f"Full video pre-download skipped ({dl_err}). Using fast per-clip range streaming...")
            return {
                "video_path": None,
                "id": self.extract_video_id(youtube_url),
                "title": "YouTube Video",
                "duration": 0.0,
                "thumbnail": None,
                "channel": None,
                "use_section_streaming": True
            }

    async def _create_subtitles_file(
        self,
        caption_segments: List[Dict[str, Any]],
        clip_start: float,
        clip_end: float,
        srt_path: str
    ):
        """Create clean SRT file relative to clip start asynchronously."""
        async with await anyio.open_file(srt_path, "w", encoding="utf-8") as f:
            index = 1
            for seg in caption_segments:
                seg_start = seg["start"]
                seg_end = seg["end"]
                # Filter segments within clip range
                if seg_end <= clip_start or seg_start >= clip_end:
                    continue
                
                rel_start = max(0.0, seg_start - clip_start)
                rel_end = min(clip_end - clip_start, seg_end - clip_start)
                
                if rel_end <= rel_start:
                    continue

                start_str = self._format_srt_time(rel_start)
                end_str = self._format_srt_time(rel_end)
                text = seg["text"].strip().upper()
                
                await f.write(f"{index}\n{start_str} --> {end_str}\n{text}\n\n")
                index += 1

    @staticmethod
    def _format_srt_time(seconds: float) -> str:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds - int(seconds)) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    async def process_clip(
        self,
        source_video_path: Optional[str],
        start_time: float,
        end_time: float,
        output_clip_path: str,
        output_thumbnail_path: str,
        format_ratio: str = "9:16",
        captions: bool = True,
        caption_segments: Optional[List[Dict[str, Any]]] = None,
        youtube_url: Optional[str] = None,
        client_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        duration = end_time - start_time
        work_dir = os.path.dirname(output_clip_path)
        os.makedirs(work_dir, exist_ok=True)

        # Determine effective source file
        temp_section_file = None
        if source_video_path and os.path.exists(source_video_path):
            input_file = source_video_path
            seek_offset = start_time
        elif youtube_url:
            base_name = os.path.splitext(os.path.basename(output_clip_path))[0]
            temp_section_file = os.path.join(work_dir, f"raw_{base_name}.mp4")
            logger.info(f"Streaming direct clip range [{start_time:.1f}s - {end_time:.1f}s] to {temp_section_file}...")
            await self.download_clip_section(
                youtube_url=youtube_url,
                start_time=start_time,
                end_time=end_time,
                output_path=temp_section_file,
                client_ip=client_ip
            )
            input_file = temp_section_file
            seek_offset = 0.0
        else:
            raise RuntimeError("No source video path or YouTube URL provided for clip rendering.")

        # Probe video to preserve 4K (2160p) / 1080p source fidelity
        source_width = 1920
        source_height = 1080
        try:
            info = await self.get_local_video_info(input_file)
            streams = info.get("streams", [])
            video_stream = next((s for s in streams if s.get("codec_type") == "video"), streams[0] if streams else {})
            if video_stream.get("width") and video_stream.get("height"):
                source_width = int(video_stream["width"])
                source_height = int(video_stream["height"])
            elif info.get("width") and info.get("height"):
                source_width = int(info["width"])
                source_height = int(info["height"])
        except Exception as probe_err:
            logger.debug(f"Video probe note: {probe_err}")

        is_4k = source_height >= 2160 or source_width >= 3840
        is_1080p = source_height >= 1080 or source_width >= 1920

        srt_file = None
        filter_complex = []

        # High-Fidelity Crop Scaling: preserve 4K Ultra HD (2160p) & 1080p full resolution
        if format_ratio == "9:16":
            if is_4k:
                filter_complex.append("scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840")
            elif is_1080p:
                filter_complex.append("scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920")
            else:
                filter_complex.append("scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280")
        elif format_ratio == "1:1":
            if is_4k:
                filter_complex.append("scale=2160:2160:force_original_aspect_ratio=increase,crop=2160:2160")
            elif is_1080p:
                filter_complex.append("scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080")
            else:
                filter_complex.append("scale=720:720:force_original_aspect_ratio=increase,crop=720:720")
        else: # 16:9 / Landscape
            if is_4k:
                filter_complex.append("scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160")
            elif is_1080p:
                filter_complex.append("scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080")
            else:
                filter_complex.append("scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720")

        # Captions filter if enabled and segments present
        if captions and caption_segments:
            base_name = os.path.splitext(os.path.basename(output_clip_path))[0]
            srt_file = os.path.join(work_dir, f"{base_name}.srt")
            await self._create_subtitles_file(caption_segments, start_time, end_time, srt_file)
            
            escaped_srt = srt_file.replace("\\", "/").replace(":", "\\:").replace("'", "'\\''")
            sub_fontsize = "18" if is_4k else ("14" if is_1080p else "11")
            sub_margin = "90" if is_4k else ("60" if is_1080p else "45")
            sub_style = f"Fontname=Arial,Fontsize={sub_fontsize},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,MarginV={sub_margin},Bold=1"
            filter_complex.append(f"subtitles='{escaped_srt}':force_style='{sub_style}'")

        vf_str = ",".join(filter_complex)

        # Visually lossless CRF 18 for 4K / 1080p
        crf_val = "18" if (is_4k or is_1080p) else "20"
        preset_val = "fast" if is_4k else "veryfast"

        # Build FFmpeg command (bounded to 4 worker threads for 4K responsiveness)
        cmd = [
            "ffmpeg", "-y",
            "-threads", "4",
            "-ss", str(seek_offset),
            "-i", input_file,
            "-t", str(duration),
            "-vf", vf_str,
            "-c:v", "libx264",
            "-preset", preset_val,
            "-crf", crf_val,
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
            output_clip_path
        ]

        logger.info(f"Rendering clip [{start_time:.1f}s - {end_time:.1f}s] to {output_clip_path}...")
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        try:
            try:
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300.0)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                try:
                    proc.kill()
                    await proc.wait()
                except Exception:
                    pass
                raise RuntimeError("FFmpeg video rendering timed out or was cancelled.")

            if proc.returncode != 0:
                logger.error(f"FFmpeg rendering error: {stderr.decode('utf-8', errors='ignore')}")
                raise RuntimeError("FFmpeg failed to render video clip.")

            # Extract representative thumbnail
            thumb_offset = seek_offset + min(2.0, duration * 0.15)
            thumb_cmd = [
                "ffmpeg", "-y",
                "-ss", str(thumb_offset),
                "-i", input_file,
                "-vframes", "1",
                "-vf", filter_complex[0],
                "-q:v", "2",
                output_thumbnail_path
            ]
            thumb_proc = await asyncio.create_subprocess_exec(
                *thumb_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            try:
                await asyncio.wait_for(thumb_proc.communicate(), timeout=30.0)
            except asyncio.TimeoutError:
                try:
                    thumb_proc.kill()
                    await thumb_proc.wait()
                except Exception:
                    pass
        finally:
            # Clean temporary files guaranteed
            if srt_file and os.path.exists(srt_file):
                try:
                    os.remove(srt_file)
                except Exception:
                    pass

            if temp_section_file and os.path.exists(temp_section_file):
                try:
                    os.remove(temp_section_file)
                except Exception:
                    pass

        return {
            "clip_path": output_clip_path,
            "thumbnail_path": output_thumbnail_path,
            "duration": duration
        }
