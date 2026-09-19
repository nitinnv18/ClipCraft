from typing import List
from app.models.clip import ClipCandidate
from app.core.logging import logger

class ClipRankingEngine:
    @staticmethod
    def filter_and_rank_clips(
        candidates: List[ClipCandidate],
        target_count: int = 5,
        min_duration: int = 30,
        max_duration: int = 60,
        max_allowed_overlap_pct: float = 0.25
    ) -> List[ClipCandidate]:
        if not candidates:
            return []

        logger.info(f"Filtering and ranking {len(candidates)} candidate clips (target: {target_count})...")

        # 1. Primary Filter with tolerance
        filtered = [
            c for c in candidates
            if (min_duration - 10) <= c.duration <= (max_duration + 20)
        ]

        # 2. Adaptive Fallback: If duration filter dropped all candidates, keep all candidates
        if not filtered:
            logger.info("Adaptive ranking: Using all candidate clips with adjusted duration bounds.")
            filtered = list(candidates)

        # 3. Sort by AI Score descending
        filtered.sort(key=lambda x: x.score, reverse=True)

        # 4. Deduplicate / Overlap Suppression
        selected: List[ClipCandidate] = []
        for cand in filtered:
            overlap = False
            for s in selected:
                overlap_start = max(cand.start, s.start)
                overlap_end = min(cand.end, s.end)
                if overlap_end > overlap_start:
                    overlap_duration = overlap_end - overlap_start
                    shorter_len = min(cand.duration, s.duration) if min(cand.duration, s.duration) > 0 else 1.0
                    if (overlap_duration / shorter_len) > max_allowed_overlap_pct:
                        overlap = True
                        break
            if not overlap:
                selected.append(cand)
            if len(selected) >= target_count:
                break

        # Fallback if strict overlap yielded fewer than target
        if len(selected) < target_count and len(filtered) > len(selected):
            for cand in filtered:
                if cand not in selected:
                    selected.append(cand)
                if len(selected) >= target_count:
                    break

        # Final safety check: if still empty, take top original candidate
        if not selected and candidates:
            selected = [candidates[0]]

        logger.info(f"Selected {len(selected)} high-retention clips after ranking.")
        return selected
