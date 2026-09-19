import os
import asyncio
import subprocess
import json
import re
from typing import Dict, Any, List, Optional, Callable
import httpx
import yt_dlp
from app.core.config import settings
from app.core.logging import logger
from app.providers.video.rapidapi_youtube import rapidapi_resolver
from app.providers.base import BaseVideoProcessor

class FFmpegVideoProcessor(BaseVideoProcessor):
    def __init__(self):
        os.makedirs(settings.TEMP_STORAGE_DIR, exist_ok=True)

    @staticmethod
    def extract_video_id(url_or_id: str) -> Optional[str]:
        if len(url_or_id) == 11 and re.match(r'^[a-zA-Z0-9_-]{11}$', url_or_id):
            return url_or_id
        patterns = [
            r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',
            r'(?:youtu\.be\/)([0-9A-Za-z_-]{11})',
            r'(?:shorts\/)([0-9A-Za-z_-]{11})',
            r'(?:embed\/)([0-9A-Za-z_-]{11})',
        ]
        for pattern in patterns:
            match = re.search(pattern, url_or_id)
            if match:
                return match.group(1)
        return None

    async def check_ffmpeg_installed(self) -> bool:
        try:
            process = await asyncio.create_subprocess_exec(
                "ffmpeg", "-version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await process.communicate()
            return process.returncode == 0
        except Exception as e:
            logger.warning(f"FFmpeg check failed: {e}")
            return False

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
            'nocheckcertificate': True,
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

    async def _fetch_external_stream_url(self, youtube_url: str) -> Optional[str]:
        """Query specialized distributed media instances (RapidAPI, Cobalt, Piped, Invidious) to bypass cloud datacenter bans."""
        video_id = self.extract_video_id(youtube_url)
        if not video_id:
            return None

        # 1. Try RapidAPI (if configured, 100% reliable direct CDN stream)
        try:
            rapid_url = await rapidapi_resolver.get_stream_url(video_id)
            if rapid_url:
                logger.info("Successfully fetched direct stream URL via RapidAPI")
                return rapid_url
        except Exception as re_err:
            logger.debug(f"RapidAPI stream resolution notice: {re_err}")

        # 2. Try Cobalt API instances
        cobalt_instances = [
            "https://api.cobalt.tools",
            "https://cobalt-api.kwiatekm.com",
            "https://api.wuk.sh"
        ]
        for api_url in cobalt_instances:
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.post(
                        f"{api_url}/",
                        json={
                            "url": f"https://www.youtube.com/watch?v={video_id}",
                            "videoQuality": "480"
                        },
                        headers={
                            "Accept": "application/json",
                            "Content-Type": "application/json"
                        }
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        stream_url = data.get("url")
                        if stream_url and stream_url.startswith("http"):
                            logger.info(f"Successfully resolved direct media stream via Cobalt ({api_url})")
                            return stream_url
            except Exception as e:
                logger.debug(f"Cobalt instance {api_url} check failed: {e}")

        # 2. Try Invidious / Piped instances
        inv_instances = [
            f"https://inv.nadeko.net/api/v1/videos/{video_id}",
            f"https://invidious.nerdvpn.de/api/v1/videos/{video_id}",
            f"https://pipedapi.kavin.rocks/streams/{video_id}"
        ]
        for inst_url in inv_instances:
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.get(inst_url)
                    if resp.status_code == 200:
                        data = resp.json()
                        # Invidious format
                        for fmt in data.get("formatStreams", []):
                            if fmt.get("url"):
                                logger.info("Successfully resolved stream URL via Invidious")
                                return fmt["url"]
                        # Piped format
                        for v in data.get("videoStreams", []):
                            if v.get("url"):
                                logger.info("Successfully resolved stream URL via Piped")
                                return v["url"]
            except Exception as e:
                logger.debug(f"Invidious instance {inst_url} check failed: {e}")

        return None

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
            stdout, stderr = await process.communicate()
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
        stdout, stderr = await process.communicate()
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
        """Extract metadata without full download with resilient oEmbed and RapidAPI fallback."""
        video_id = self.extract_video_id(youtube_url)

        # 1. High speed RapidAPI metadata resolver (if configured)
        try:
            if rapidapi_resolver.is_configured() and video_id:
                r_info = await rapidapi_resolver.get_video_info(video_id)
                if r_info and r_info.get("title"):
                    logger.info(f"✓ Successfully retrieved video info from RapidAPI for {video_id}")
                    return r_info
        except Exception as r_err:
            logger.debug(f"RapidAPI get_video_info notice: {r_err}")

        ydl_opts = {
            **self._get_base_ydl_opts(client_ip=client_ip),
            'skip_download': True,
        }
        loop = asyncio.get_event_loop()

        def _extract():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(youtube_url, download=False)
        
        try:
            info = await loop.run_in_executor(None, _extract)
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
        duration = end_time - start_time
        video_id = self.extract_video_id(youtube_url)

        # 1. Instant RapidAPI Direct Stream Cut (100% cloud bypass, ~2s render)
        if rapidapi_resolver.is_configured() and video_id:
            try:
                stream_url = await rapidapi_resolver.get_stream_url(video_id)
                if stream_url:
                    logger.info(f"Cutting clip directly from RapidAPI stream URL: [{start_time:.1f}s - {end_time:.1f}s]")
                    ffmpeg_cmd = [
                        "ffmpeg", "-y",
                        "-ss", str(start_time),
                        "-i", stream_url,
                        "-t", str(duration),
                        "-c:v", "libx264",
                        "-preset", "veryfast",
                        "-crf", "23",
                        "-c:a", "aac",
                        "-b:a", "128k",
                        output_path
                    ]
                    proc = await asyncio.create_subprocess_exec(
                        *ffmpeg_cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    await proc.communicate()
                    if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                        logger.info(f"✓ Successfully rendered clip section to {output_path} via RapidAPI stream.")
                        return output_path
            except Exception as r_err:
                logger.debug(f"Direct RapidAPI section cut notice: {r_err}")

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }
        if client_ip and self._is_valid_public_ip(client_ip):
            headers['X-Forwarded-For'] = client_ip
            headers['X-Real-IP'] = client_ip

        loop = asyncio.get_event_loop()
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

        result_path = await loop.run_in_executor(None, _exec)
        if result_path and os.path.exists(result_path):
            return result_path


        # 5. External Resolver Fallback: Cobalt / Invidious stream URL
        logger.info(f"Triggering automated Cobalt/Invidious stream resolver for {youtube_url}...")
        stream_url = await self._fetch_external_stream_url(youtube_url)
        if stream_url:
            ffmpeg_cmd = [
                "ffmpeg", "-y",
                "-ss", str(start_time),
                "-i", stream_url,
                "-t", str(duration),
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-crf", "23",
                "-c:a", "aac",
                "-b:a", "128k",
                output_path
            ]
            proc = await asyncio.create_subprocess_exec(
                *ffmpeg_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await proc.communicate()
            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                logger.info(f"Successfully streamed and rendered clip section to {output_path} via stream resolver.")
                return output_path

        raise RuntimeError("YouTube has temporarily rate-limited this video on cloud IP. Please verify RapidAPI credentials or try again in a few moments.")

    async def download_video(
        self,
        youtube_url: str,
        output_dir: str,
        on_progress: Optional[Callable[[int, str], None]] = None,
        client_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        os.makedirs(output_dir, exist_ok=True)
        video_id = self.extract_video_id(youtube_url)
        output_file = os.path.join(output_dir, f"{video_id or 'video'}.mp4")

        # 1. High Speed RapidAPI Video Stream Pre-fetch
        if rapidapi_resolver.is_configured() and video_id:
            try:
                if on_progress:
                    on_progress(10, "Fetching RapidAPI stream...")
                stream_url = await rapidapi_resolver.get_stream_url(video_id)
                video_info = await rapidapi_resolver.get_video_info(video_id)
                if stream_url:
                    if on_progress:
                        on_progress(30, "Downloading full video via high-speed CDN...")
                    ffmpeg_cmd = [
                        "ffmpeg", "-y",
                        "-i", stream_url,
                        "-c", "copy",
                        output_file
                    ]
                    proc = await asyncio.create_subprocess_exec(
                        *ffmpeg_cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    await proc.communicate()
                    if os.path.exists(output_file) and os.path.getsize(output_file) > 10000:
                        if on_progress:
                            on_progress(100, "Video downloaded successfully")
                        logger.info(f"✓ Successfully downloaded full video {video_id} via RapidAPI to {output_file}")
                        return {
                            "video_path": output_file,
                            "id": video_id,
                            "title": video_info.get("title") if video_info else "YouTube Video",
                            "duration": video_info.get("duration", 0.0) if video_info else 0.0,
                            "thumbnail": video_info.get("thumbnail") if video_info else None,
                            "channel": video_info.get("channel") if video_info else None
                        }
            except Exception as r_dl_err:
                logger.debug(f"RapidAPI full download notice ({r_dl_err}), falling back to yt-dlp...")

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

        # High speed download: 480p / 720p lightweight format for fast clipping
        ydl_opts = {
            **self._get_base_ydl_opts(client_ip=client_ip),
            'format': 'best[height<=480][ext=mp4]/bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]/best',
            'outtmpl': output_template,
            'merge_output_format': 'mp4',
            'concurrent_fragment_downloads': 8,
            'progress_hooks': [ydl_progress_hook] if on_progress else [],
        }

        loop = asyncio.get_event_loop()
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
                    'format': 'best[height<=480]/best[height<=720]/best',
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
            info, video_path = await loop.run_in_executor(None, _download)
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

    def _create_subtitles_file(
        self,
        caption_segments: List[Dict[str, Any]],
        clip_start: float,
        clip_end: float,
        srt_path: str
    ):
        """Create clean SRT file relative to clip start."""
        with open(srt_path, "w", encoding="utf-8") as f:
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
                
                f.write(f"{index}\n{start_str} --> {end_str}\n{text}\n\n")
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

        srt_file = None
        filter_complex = []

        # 9:16 Smart Center Crop: scale to fit 1280 height, crop 720 width
        if format_ratio == "9:16":
            filter_complex.append("scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280")
        elif format_ratio == "1:1":
            filter_complex.append("scale=720:720:force_original_aspect_ratio=increase,crop=720:720")
        else: # 16:9
            filter_complex.append("scale=1280:720")

        # Captions filter if enabled and segments present
        if captions and caption_segments:
            base_name = os.path.splitext(os.path.basename(output_clip_path))[0]
            srt_file = os.path.join(work_dir, f"{base_name}.srt")
            self._create_subtitles_file(caption_segments, start_time, end_time, srt_file)
            
            escaped_srt = srt_file.replace("\\", "/").replace(":", "\\:").replace("'", "'\\''")
            sub_style = "Fontname=Arial,Fontsize=11,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=1.2,Shadow=0.5,MarginV=45,Bold=1"
            filter_complex.append(f"subtitles='{escaped_srt}':force_style='{sub_style}'")

        vf_str = ",".join(filter_complex)

        # Build FFmpeg command
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(seek_offset),
            "-i", input_file,
            "-t", str(duration),
            "-vf", vf_str,
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "23",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            output_clip_path
        ]

        logger.info(f"Rendering clip [{start_time:.1f}s - {end_time:.1f}s] to {output_clip_path}...")
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
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
        await thumb_proc.communicate()

        # Clean temporary files
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
