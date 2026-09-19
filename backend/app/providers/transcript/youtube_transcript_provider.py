import re
from typing import Dict, Any, List, Optional
from youtube_transcript_api import YouTubeTranscriptApi
from app.core.logging import logger
from app.providers.base import BaseTranscriptProvider, TranscriptResult

from app.providers.video.rapidapi_youtube import rapidapi_resolver

class YouTubeTranscriptProvider(BaseTranscriptProvider):
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

    async def get_transcript(self, video_id_or_url: str) -> TranscriptResult:
        video_id = self.extract_video_id(video_id_or_url)
        if not video_id:
            raise ValueError(f"Invalid YouTube URL or Video ID: {video_id_or_url}")

        logger.info(f"Fetching transcript for video ID: {video_id}...")

        # 1. High speed RapidAPI TimedText subtitles (bypasses all datacenter bot bans)
        if rapidapi_resolver.is_configured():
            try:
                rapid_segments = await rapidapi_resolver.get_transcript_segments(video_id)
                if rapid_segments and len(rapid_segments) > 0:
                    logger.info(f"✓ Retrieved {len(rapid_segments)} transcript segments via RapidAPI timedtext.")
                    return TranscriptResult(
                        segments=rapid_segments,
                        language="en",
                        is_generated=True
                    )
            except Exception as r_err:
                logger.debug(f"RapidAPI transcript fetch notice: {r_err}")

        try:
            ytta = YouTubeTranscriptApi()
            raw_data = None

            # 2. Try direct fetch via youtube-transcript-api
            try:
                raw_data = ytta.fetch(video_id)
            except Exception as e:
                logger.info(f"Direct fetch attempt failed ({e}), searching transcript list...")

            # 3. Try listing all available transcripts (manual, auto, translation)
            if not raw_data:
                try:
                    t_list = ytta.list(video_id)
                    # Try English / Hindi first
                    for t in t_list:
                        if t.language_code in ["en", "en-US", "en-GB", "en-IN", "hi", "hi-Latn"]:
                            raw_data = t.fetch()
                            break
                    
                    # Try any available transcript
                    if not raw_data:
                        for t in t_list:
                            raw_data = t.fetch()
                            break
                except Exception as list_err:
                    logger.warning(f"Transcript list fetch error: {list_err}")

            if not raw_data:
                raise ValueError("No transcript or subtitles track found on YouTube for this video.")

            segments = []
            for item in raw_data:
                # Support both dict and object attributes (FetchedTranscriptSnippet)
                if isinstance(item, dict):
                    start = round(float(item.get("start", 0)), 2)
                    duration = round(float(item.get("duration", 0)), 2)
                    text = str(item.get("text", "")).strip().replace("\n", " ")
                else:
                    start = round(float(getattr(item, "start", 0)), 2)
                    duration = round(float(getattr(item, "duration", 0)), 2)
                    text = str(getattr(item, "text", "")).strip().replace("\n", " ")
                
                end = round(start + duration, 2)
                if text:
                    segments.append({
                        "start": start,
                        "end": end,
                        "duration": duration,
                        "text": text
                    })

            logger.info(f"Retrieved {len(segments)} transcript segments for video {video_id}.")
            return TranscriptResult(
                segments=segments,
                language="en",
                is_generated=True
            )
        except Exception as e:
            logger.error(f"Failed to retrieve transcript for {video_id}: {e}")
            raise RuntimeError(f"Transcript unavailable for this video: {str(e)}")
