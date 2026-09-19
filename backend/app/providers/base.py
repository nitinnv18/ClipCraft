from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from app.models.clip import ClipCandidate

class TranscriptSegment(dict):
    start: float
    end: float
    text: str

class TranscriptResult:
    def __init__(self, segments: List[Dict[str, Any]], language: str = "en", is_generated: bool = False):
        self.segments = segments
        self.language = language
        self.is_generated = is_generated

    @property
    def full_text(self) -> str:
        return " ".join(s["text"] for s in self.segments)

class BaseTranscriptProvider(ABC):
    @abstractmethod
    async def get_transcript(self, video_id: str) -> TranscriptResult:
        """Fetch transcript segments for video ID."""
        pass

class BaseAIProvider(ABC):
    @abstractmethod
    async def detect_clips(
        self,
        transcript_segments: List[Dict[str, Any]],
        video_duration: float,
        target_clip_count: int = 5,
        min_duration: int = 30,
        max_duration: int = 60
    ) -> List[ClipCandidate]:
        """Analyze transcript and return scored candidate clips."""
        pass

class BaseStorageProvider(ABC):
    @abstractmethod
    async def upload_video(self, local_file_path: str, public_id_prefix: str = "clips") -> Dict[str, Any]:
        """Upload video to cloud storage and return URL + metadata."""
        pass

    @abstractmethod
    async def upload_image(self, local_file_path: str, public_id_prefix: str = "thumbnails") -> Dict[str, Any]:
        """Upload thumbnail image to cloud storage and return URL."""
        pass

    @abstractmethod
    async def delete_file(self, public_id: str) -> bool:
        """Delete file from cloud storage."""
        pass

class BaseVideoProcessor(ABC):
    @abstractmethod
    async def check_ffmpeg_installed(self) -> bool:
        """Check if FFmpeg is available."""
        pass

    @abstractmethod
    async def download_video(self, youtube_url: str, output_dir: str, **kwargs) -> Dict[str, Any]:
        """Download YouTube video using yt-dlp/ffmpeg and return metadata + path."""
        pass

    @abstractmethod
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
        **kwargs
    ) -> Dict[str, Any]:
        """Trim, crop to vertical 9:16, burn captions, and extract thumbnail."""
        pass

class BaseQueueProvider(ABC):
    @abstractmethod
    async def enqueue_job(self, job_id: str, payload: Dict[str, Any]) -> bool:
        """Add job to processing queue."""
        pass

    @abstractmethod
    async def get_next_job(self, timeout_seconds: int = 5) -> Optional[Dict[str, Any]]:
        """Fetch next job from queue."""
        pass
