from typing import List, Dict, Any
from app.models.clip import ClipCandidate

class BoundaryOptimizer:
    """Optimizes clip boundaries to snap perfectly to spoken sentence boundaries and natural speech pauses,
    preventing mid-sentence cutoffs and awkward trailing words."""

    TERMINAL_PUNCTUATION = ('.', '!', '?', '।', '۔')

    @classmethod
    def optimize_boundaries(
        cls,
        candidate: ClipCandidate,
        segments: List[Dict[str, Any]],
        max_snap_distance: float = 3.5
    ) -> ClipCandidate:
        if not segments:
            return candidate

        best_start = candidate.start
        best_end = candidate.end

        # 1. Start boundary snapping: find closest segment start
        start_candidates = []
        for i, seg in enumerate(segments):
            diff = abs(seg["start"] - candidate.start)
            if diff <= max_snap_distance:
                text = seg.get("text", "").strip()
                # Prioritize segments that begin a sentence
                is_sentence_start = i == 0 or segments[i - 1].get("text", "").strip().endswith(cls.TERMINAL_PUNCTUATION)
                start_candidates.append((diff, not is_sentence_start, seg["start"]))

        if start_candidates:
            # Sort by: whether it's a sentence start (False/0 preferred), then min diff
            start_candidates.sort(key=lambda x: (x[1], x[0]))
            best_start = start_candidates[0][2]

        # 2. End boundary snapping: find closest segment end
        end_candidates = []
        for i, seg in enumerate(segments):
            diff = abs(seg["end"] - candidate.end)
            if diff <= max_snap_distance:
                text = seg.get("text", "").strip()
                # Prioritize segments that end with a period, exclamation, or question mark
                is_sentence_end = text.endswith(cls.TERMINAL_PUNCTUATION)
                end_candidates.append((diff, not is_sentence_end, seg["end"]))

        if end_candidates:
            # Sort by: whether it's a sentence end (False/0 preferred), then min diff
            end_candidates.sort(key=lambda x: (x[1], x[0]))
            best_end = end_candidates[0][2]

        # 3. Ensure valid boundaries and maintain minimum duration
        if best_end > best_start:
            candidate.start = round(best_start, 2)
            candidate.end = round(best_end, 2)
            candidate.duration = round(candidate.end - candidate.start, 2)

        return candidate

