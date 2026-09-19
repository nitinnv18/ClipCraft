import pytest
from app.models.clip import ClipCandidate
from app.services.ranking_engine import ClipRankingEngine
from app.services.boundary_optimizer import BoundaryOptimizer

def test_ranking_and_overlap_filtering():
    candidates = [
        ClipCandidate(
            start=10.0, end=50.0, duration=40.0,
            title="Clip 1", hook="Hook 1", description="Desc 1", reason="Reason 1",
            score=95
        ),
        # Heavily overlapping clip with lower score
        ClipCandidate(
            start=12.0, end=52.0, duration=40.0,
            title="Clip 2 (Duplicate)", hook="Hook 2", description="Desc 2", reason="Reason 2",
            score=88
        ),
        # Non-overlapping high value clip
        ClipCandidate(
            start=100.0, end=145.0, duration=45.0,
            title="Clip 3", hook="Hook 3", description="Desc 3", reason="Reason 3",
            score=91
        ),
        # Out of bounds too short clip (< 25s)
        ClipCandidate(
            start=200.0, end=210.0, duration=10.0,
            title="Clip 4 Too Short", hook="Hook 4", description="Desc 4", reason="Reason 4",
            score=99
        )
    ]

    selected = ClipRankingEngine.filter_and_rank_clips(
        candidates=candidates,
        target_count=2,
        min_duration=30,
        max_duration=60
    )

    assert len(selected) == 2
    assert selected[0].title == "Clip 1"
    assert selected[1].title == "Clip 3"
    # Ensure duplicate was filtered out
    titles = [c.title for c in selected]
    assert "Clip 2 (Duplicate)" not in titles
    assert "Clip 4 Too Short" not in titles

def test_boundary_optimizer():
    candidate = ClipCandidate(
        start=10.4, end=49.8, duration=39.4,
        title="Clip", hook="Hook", description="Desc", reason="Reason", score=90
    )
    segments = [
        {"start": 10.0, "end": 15.2, "text": "Start here."},
        {"start": 15.2, "end": 50.0, "text": "End here perfectly."}
    ]

    optimized = BoundaryOptimizer.optimize_boundaries(candidate, segments)
    assert optimized.start == 10.0
    assert optimized.end == 50.0
    assert optimized.duration == 40.0
