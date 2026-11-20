import asyncio
from typing import Optional
from youtube_transcript_api import YouTubeTranscriptApi
from app.core.logging import logger
from app.core.utils import extract_youtube_id
from app.providers.base import BaseTranscriptProvider, TranscriptResult

def _fetch_transcript_sync(video_id: str):
    """Synchronous worker function executed in an async thread pool to prevent event loop stalls."""
    ytta = YouTubeTranscriptApi()
    raw_data = None
    try:
        raw_data = ytta.fetch(video_id)
    except Exception as e:
        logger.info(f"Direct fetch attempt failed ({e}), searching transcript list...")

    if not raw_data:
        try:
            t_list = ytta.list(video_id)
            for t in t_list:
                if t.language_code in ["en", "en-US", "en-GB", "en-IN", "hi", "hi-Latn"]:
                    raw_data = t.fetch()
                    break
            if not raw_data:
                for t in t_list:
                    raw_data = t.fetch()
                    break
        except Exception as list_err:
            logger.warning(f"Transcript list fetch error: {list_err}")
    return raw_data

class YouTubeTranscriptProvider(BaseTranscriptProvider):
    @staticmethod
    def extract_video_id(url_or_id: str) -> Optional[str]:
        return extract_youtube_id(url_or_id)

    async def get_transcript(self, video_id_or_url: str) -> TranscriptResult:
        video_id = self.extract_video_id(video_id_or_url)
        if not video_id:
            raise ValueError(f"Invalid YouTube URL or Video ID: {video_id_or_url}")

        logger.info(f"Fetching transcript for video ID: {video_id}...")

        try:
            raw_data = await asyncio.to_thread(_fetch_transcript_sync, video_id)

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
