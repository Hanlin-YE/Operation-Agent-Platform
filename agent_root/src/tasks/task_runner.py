from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable


class TaskRunner:
    """Lifecycle wrapper for a bounded internal coroutine pool.

    Queue claiming and state transitions live in the control-plane adapter. This
    runner intentionally has no HTTP awareness and never bypasses review.
    """

    def __init__(self, poll_interval_seconds: float, concurrency: int) -> None:
        self._poll_interval_seconds = poll_interval_seconds
        self._semaphore = asyncio.Semaphore(concurrency)
        self._stop = asyncio.Event()

    async def run(self, poll_once: Callable[[], Awaitable[None]]) -> None:
        while not self._stop.is_set():
            async with self._semaphore:
                await poll_once()
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self._poll_interval_seconds)
            except TimeoutError:
                pass

    def stop(self) -> None:
        self._stop.set()
