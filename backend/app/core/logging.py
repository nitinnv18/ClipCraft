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
        logging.DEBUG: ("🔍 DEBUG", DIM + MAGENTA),
        logging.INFO: ("✨ INFO ", GREEN),
        logging.WARNING: ("⚠️  WARN ", YELLOW),
        logging.ERROR: ("❌ ERROR", RED + BOLD),
        logging.CRITICAL: ("🚨 FATAL", RED + BOLD),
    }

    CONTEXT_ICONS = [
        (re.compile(r"Successfully processed", re.I), "🎉 "),
        (re.compile(r"Starting", re.I), "🚀 "),
        (re.compile(r"Shutting down", re.I), "🛑 "),
        (re.compile(r"Cleaned up|cleanup", re.I), "🧹 "),
        (re.compile(r"MongoDB|Mongo", re.I), "🍃 "),
        (re.compile(r"Redis|queued|queue", re.I), "⚡ "),
        (re.compile(r"User logged in|Registered new user|User suspended|User unsuspended", re.I), "👤 "),
        (re.compile(r"Admin|Super Admin", re.I), "🔐 "),
        (re.compile(r"cancelled", re.I), "⏹️ "),
        (re.compile(r"retried", re.I), "🔄 "),
        (re.compile(r"deleted", re.I), "🗑️ "),
        (re.compile(r"settings updated", re.I), "⚙️ "),
        (re.compile(r"\[Job\s+|video clipping job|job_", re.I), "🎬 "),
        (re.compile(r"Groq\s*Whisper|Transcribing|Whisper|audio", re.I), "🎙️ "),
        (re.compile(r"Groq|Llama|AI", re.I), "🤖 "),
        (re.compile(r"Ranking|high-retention|Selected \d+", re.I), "📊 "),
        (re.compile(r"Rendering clip|FFmpeg", re.I), "✂️ "),
        (re.compile(r"YouTube|stream", re.I), "📡 "),
        (re.compile(r"Storage|Cloudinary", re.I), "💾 "),
        (re.compile(r"probe", re.I), "🔍 "),
    ]

    def format(self, record: logging.LogRecord) -> str:
        time_str = self.formatTime(record, "%H:%M:%S")
        badge_text, level_color = self.LEVEL_BADGES.get(
            record.levelno, (record.levelname.ljust(7), "")
        )

        raw_msg = record.getMessage()

        # Deduce contextual icon
        icon = ""
        first_chars = raw_msg[:2] if raw_msg else ""
        # Check if raw_msg already has an emoji/unicode symbol
        if not any(ord(c) > 10000 for c in first_chars):
            for pattern, ic in self.CONTEXT_ICONS:
                if pattern.search(raw_msg):
                    icon = ic
                    break

        if self.NO_COLOR:
            time_tag = f"[{time_str}]"
            sep = "│"
            formatted = f"{time_tag} {sep} {badge_text} {sep} {icon}{raw_msg}"
        else:
            time_tag = f"{self.GRAY}[{time_str}]{self.RESET}"
            sep = f"{self.GRAY}│{self.RESET}"
            badge = f"{level_color}{badge_text}{self.RESET}"
            msg_color = level_color if record.levelno >= logging.WARNING else ""
            msg = f"{msg_color}{icon}{raw_msg}{self.RESET}" if msg_color else f"{icon}{raw_msg}"
            formatted = f"{time_tag} {sep} {badge} {sep} {msg}"

        if record.exc_info:
            formatted += "\n" + self.formatException(record.exc_info)
        return formatted


def setup_logging():
    root = logging.getLogger()
    # Avoid duplicate handlers on re-runs
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(ColoredIconFormatter())
    
    root.setLevel(logging.INFO)
    root.addHandler(handler)


logger = logging.getLogger("clipcraft")
