import logging
import os
import re
import sys


class ColoredIconFormatter(logging.Formatter):
    """
    Clean, modern console formatter with contextual icons and ANSI colors.
    Formats logs into: [HH:MM:SS] │ LEVEL │ ICON Message
    """
    # ANSI escape sequences
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    GRAY = "\033[90m"
    CYAN = "\033[36m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    RED = "\033[31m"
    MAGENTA = "\033[35m"

    # Check if colors should be disabled (e.g., NO_COLOR env var)
    NO_COLOR = bool(os.getenv("NO_COLOR", ""))

    LEVEL_BADGES = {
        logging.DEBUG: ("DEBUG", DIM + MAGENTA),
        logging.INFO: ("INFO ", GREEN),
        logging.WARNING: ("WARN ", YELLOW),
        logging.ERROR: ("ERROR", RED + BOLD),
        logging.CRITICAL: ("FATAL", RED + BOLD),
    }

    CONTEXT_ICONS = [
        (re.compile(r"Successfully processed|\bsuccess\b", re.I), "🎉 "),
        (re.compile(r"\b(Starting|Initialized|Ready)\b", re.I), "🚀 "),
        (re.compile(r"\b(Shutting down|stopping)\b", re.I), "🛑 "),
        (re.compile(r"\b(Cleaned up|cleanup|orphaned|reap|reaped|purged)\b", re.I), "🧹 "),
        (re.compile(r"\b(MongoDB|Mongo|database)\b", re.I), "🍃 "),
        (re.compile(r"\b(Redis|queue|queued)\b", re.I), "⚡ "),
        (re.compile(r"User logged in|Registered new user|User suspended|User unsuspended|\buser\b", re.I), "👤 "),
        (re.compile(r"\b(Admin|Super Admin|auth|token|permission|unauthorized|forbidden|credentials)\b", re.I), "🔐 "),
        (re.compile(r"\b(cancelled|abort|aborted)\b", re.I), "⏹️ "),
        (re.compile(r"\b(retried|retry|retrying)\b", re.I), "🔄 "),
        (re.compile(r"\b(deleted|delete|remove|removed)\b", re.I), "🗑️ "),
        (re.compile(r"\b(settings updated|setting|settings)\b", re.I), "⚙️ "),
        (re.compile(r"\[Job\s+|video clipping job|\bjob_[a-zA-Z0-9]+\b", re.I), "🎬 "),
        (re.compile(r"\b(Whisper|transcribing|transcription|speech|audio)\b", re.I), "🎙️ "),
        (re.compile(r"\b(Groq|Llama|AI)\b", re.I), "🤖 "),
        (re.compile(r"\b(Ranking|high-retention|highlights?)\b|Selected \d+", re.I), "📊 "),
        (re.compile(r"\b(Rendering clip|FFmpeg|encode|transcode)\b", re.I), "✂️ "),
        (re.compile(r"\b(YouTube|stream|oEmbed|yt-dlp)\b", re.I), "📡 "),
        (re.compile(r"\b(Storage|Cloudinary|upload|uploading|CDN)\b", re.I), "💾 "),
        (re.compile(r"\b(probe|ffprobe|inspect)\b", re.I), "🔍 "),
        (re.compile(r"rate limit|429|\bthrottle\b", re.I), "⏳ "),
        (re.compile(r"\b(timeout|timed out)\b", re.I), "⏱️ "),
        (re.compile(r"\b(network|http|connection|connect)\b", re.I), "🌐 "),
    ]

    DEFAULT_LEVEL_ICONS = {
        logging.DEBUG: "🔍 ",
        logging.INFO: "",
        logging.WARNING: "⚠️  ",
        logging.ERROR: "❌ ",
        logging.CRITICAL: "🚨 ",
    }

    def format(self, record: logging.LogRecord) -> str:
        time_str = self.formatTime(record, "%H:%M:%S")
        badge_text, level_color = self.LEVEL_BADGES.get(
            record.levelno, (record.levelname.ljust(5), "")
        )

        raw_msg = record.getMessage()

        # Deduce contextual icon (skip if message starts with divider or already has an emoji/symbol)
        icon = ""
        has_symbol = bool(raw_msg and (
            ord(raw_msg[0]) > 10000 or
            (0x2600 <= ord(raw_msg[0]) <= 0x27BF) or
            raw_msg.startswith(("─", "-", "=", "┌", "│", "├", "└"))
        ))
        if not has_symbol:
            for pattern, ic in self.CONTEXT_ICONS:
                if pattern.search(raw_msg):
                    icon = ic
                    break
            if not icon:
                icon = self.DEFAULT_LEVEL_ICONS.get(record.levelno, "")

        if self.NO_COLOR:
            time_tag = f"[{time_str}]"
            formatted = f"{time_tag} {badge_text} {icon}{raw_msg}"
        else:
            time_tag = f"{self.GRAY}[{time_str}]{self.RESET}"
            badge = f"{level_color}{badge_text}{self.RESET}"
            msg_color = level_color if record.levelno >= logging.WARNING else ""
            msg = f"{msg_color}{icon}{raw_msg}{self.RESET}" if msg_color else f"{icon}{raw_msg}"
            formatted = f"{time_tag} {badge} {msg}"

        if record.exc_info:
            formatted += "\n" + self.formatException(record.exc_info)
        return formatted


class HealthCheckFilter(logging.Filter):
    """
    Suppresses routine 200 OK health check access logs from flooding the console,
    matching enterprise microservice logging standards (e.g. Datadog, CloudWatch).
    Failures (non-200) are still logged.
    """
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        if "GET /health" in msg or "GET /api/health" in msg:
            return " 200 " not in msg
        return True


def setup_logging():
    root = logging.getLogger()
    # Avoid duplicate handlers on re-runs
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(ColoredIconFormatter())
    
    root.setLevel(logging.INFO)
    root.addHandler(handler)

    # Filter out health check spam from uvicorn access logs
    uvicorn_access = logging.getLogger("uvicorn.access")
    uvicorn_access.addFilter(HealthCheckFilter())


logger = logging.getLogger("clipcraft")
