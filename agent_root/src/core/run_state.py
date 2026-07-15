from __future__ import annotations

from enum import StrEnum


class RunStatus(StrEnum):
    PENDING = "PENDING"
    EXTRACTING = "EXTRACTING"
    WAITING_REVIEW = "WAITING_REVIEW"
    ANNOTATING = "ANNOTATING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"


class InvalidRunTransition(ValueError):
    """Raised when a task status change violates the execution state machine."""


_ALLOWED_TRANSITIONS: dict[RunStatus, set[RunStatus]] = {
    RunStatus.PENDING: {RunStatus.EXTRACTING},
    RunStatus.EXTRACTING: {RunStatus.WAITING_REVIEW, RunStatus.FAILED},
    RunStatus.WAITING_REVIEW: {RunStatus.ANNOTATING, RunStatus.FAILED},
    RunStatus.ANNOTATING: {RunStatus.SUCCESS, RunStatus.FAILED},
    RunStatus.SUCCESS: set(),
    RunStatus.FAILED: {RunStatus.PENDING},
}


def transition_run(current: RunStatus, target: RunStatus) -> RunStatus:
    """Validate and return a permitted transition.

    FAILED -> PENDING is intentionally the only retry path. Authorization for
    that path is enforced by the caller (human action or controlled retryer).
    """

    if target not in _ALLOWED_TRANSITIONS[current]:
        raise InvalidRunTransition(f"Cannot transition run from {current} to {target}")
    return target
