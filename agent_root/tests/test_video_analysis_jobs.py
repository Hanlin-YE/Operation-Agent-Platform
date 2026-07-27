import json
import time
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient


class VideoAnalysisJobStoreTests(unittest.TestCase):
    def test_explicit_whisper_model_configuration_overrides_local_default(self) -> None:
        from src.api.video_analysis_routes import _whisper_model_reference

        with patch.dict("os.environ", {"VIDEO_WHISPER_MODEL": "/tmp/custom-whisper"}, clear=False):
            self.assertEqual(_whisper_model_reference(), "/tmp/custom-whisper")

    def test_interrupted_jobs_are_failed_but_completed_results_are_retained(self) -> None:
        from src.services.video_analysis_jobs import VideoAnalysisJobStore

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "jobs.json"
            path.write_text(json.dumps({"jobs": {
                "running": {"jobId": "running", "status": "processing", "step": "转写", "percent": 45, "logs": [], "warnings": []},
                "done": {"jobId": "done", "status": "needs_review", "step": "等待人工审核", "percent": 100, "logs": [], "warnings": [], "transcript": [{"text": "保留证据"}]},
            }}), encoding="utf-8")

            store = VideoAnalysisJobStore(path)
            self.assertEqual(store.get("running")["status"], "failed")
            self.assertIn("服务重启", store.get("running")["error"]["message"])
            self.assertEqual(store.get("done")["transcript"][0]["text"], "保留证据")

    def test_job_updates_are_persisted_as_json(self) -> None:
        from src.services.video_analysis_jobs import VideoAnalysisJobStore

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "jobs.json"
            store = VideoAnalysisJobStore(path)
            job = store.create({"filename": "sample.mp4"})
            store.update(job["jobId"], status="processing", step="准备本地模型", percent=15, message="正在检查模型缓存")
            persisted = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(persisted["jobs"][job["jobId"]]["step"], "准备本地模型")
            self.assertEqual(persisted["jobs"][job["jobId"]]["status"], "processing")

    def test_successful_retry_clears_the_previous_error(self) -> None:
        from src.services.video_analysis_jobs import VideoAnalysisJobStore

        with tempfile.TemporaryDirectory() as directory:
            store = VideoAnalysisJobStore(Path(directory) / "jobs.json")
            job = store.create({"filename": "sample.mp4"})
            store.update(job["jobId"], status="failed", error={"code": "timeout", "message": "超时"})
            saved = store.update(job["jobId"], status="needs_review", step="等待人工审核", percent=100)
            self.assertNotIn("error", saved)

    def test_completed_result_can_be_reused_for_the_same_source_url(self) -> None:
        from src.services.video_analysis_jobs import VideoAnalysisJobStore

        with tempfile.TemporaryDirectory() as directory:
            store = VideoAnalysisJobStore(Path(directory) / "jobs.json")
            completed = store.create({"filename": "platform-video.mp4", "sourceUrl": "https://b23.tv/W633wW0"})
            store.update(completed["jobId"], status="needs_review", step="等待人工审核", percent=100, script={"title": "已完成拉片"})
            failed = store.create({"filename": "platform-video.mp4", "sourceUrl": "https://b23.tv/W633wW0"})
            store.update(failed["jobId"], status="failed", error={"code": "provider", "message": "余额不足"})

            reused = store.find_completed_by_source_url("https://b23.tv/W633wW0")

            self.assertEqual(reused["jobId"], completed["jobId"])
            self.assertEqual(reused["script"]["title"], "已完成拉片")


class VideoAnalysisWorkerTests(unittest.IsolatedAsyncioTestCase):
    async def test_worker_persists_model_failure_and_deletes_temporary_video(self) -> None:
        from src.api.video_analysis_routes import _run_job
        from src.services.video_analysis_jobs import VideoAnalysisJobStore

        with tempfile.TemporaryDirectory() as root:
            store = VideoAnalysisJobStore(Path(root) / "jobs.json")
            job = store.create({"filename": "sample.mp4"})
            work = Path(root) / "work"; work.mkdir()
            (work / "sample.mp4").write_bytes(b"source video")
            request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(video_analysis_job_store=store)))
            with patch("src.api.video_analysis_routes._load_whisper_model", side_effect=RuntimeError("模型下载失败")):
                await _run_job(request, job["jobId"], work, None)
            saved = store.get(job["jobId"])
            self.assertEqual(saved["status"], "failed")
            self.assertIn("模型下载失败", saved["error"]["message"])
            self.assertFalse(work.exists())

    async def test_worker_keeps_evidence_when_llm_is_not_configured(self) -> None:
        from src.api.video_analysis_routes import _run_job
        from src.services.video_analysis_jobs import VideoAnalysisJobStore

        with tempfile.TemporaryDirectory() as root, patch.dict("os.environ", {"LLM_API_KEY": "", "OPENAI_API_KEY": "", "LLM_MODEL": "", "OPENAI_MODEL": ""}, clear=False):
            store = VideoAnalysisJobStore(Path(root) / "jobs.json")
            job = store.create({"filename": "sample.mp4"})
            work = Path(root) / "work"; work.mkdir()
            (work / "sample.mp4").write_bytes(b"source video")
            request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(video_analysis_job_store=store)))
            with patch("src.api.video_analysis_routes._load_whisper_model", return_value=object()), patch("src.api.video_analysis_routes._transcribe", return_value=[{"startSec": 0, "endSec": 1, "text": "证据"}]), patch("src.api.video_analysis_routes._detect_scenes", return_value=[]), patch("src.api.video_analysis_routes._duration", return_value=1):
                await _run_job(request, job["jobId"], work, None)
            saved = store.get(job["jobId"])
            self.assertEqual(saved["status"], "model_not_configured")
            self.assertEqual(saved["transcript"][0]["text"], "证据")
            self.assertFalse(work.exists())

    async def test_worker_fails_instead_of_hanging_when_model_load_times_out(self) -> None:
        from src.api.video_analysis_routes import _run_job
        from src.services.video_analysis_jobs import VideoAnalysisJobStore

        with tempfile.TemporaryDirectory() as root:
            store = VideoAnalysisJobStore(Path(root) / "jobs.json")
            job = store.create({"filename": "sample.mp4"})
            work = Path(root) / "work"; work.mkdir()
            (work / "sample.mp4").write_bytes(b"source video")
            request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(video_analysis_job_store=store)))

            with patch("src.api.video_analysis_routes._model_load_timeout_seconds", return_value=0.001), patch("src.api.video_analysis_routes._load_whisper_model", side_effect=lambda: time.sleep(0.05)):
                await _run_job(request, job["jobId"], work, None)

            saved = store.get(job["jobId"])
            self.assertEqual(saved["status"], "failed")
            self.assertIn("模型加载超时", saved["error"]["message"])
            self.assertFalse(work.exists())


class VideoAnalysisJobApiTests(unittest.TestCase):
    def test_posting_an_already_completed_url_returns_the_existing_result(self) -> None:
        from src.main import create_app

        source_url = "https://b23.tv/W633wW0"
        with tempfile.TemporaryDirectory() as directory, patch.dict("os.environ", {
            "VIDEO_ANALYZER_ENABLED": "true",
            "VIDEO_ANALYSIS_JOB_STORE_PATH": str(Path(directory) / "jobs.json"),
        }, clear=False):
            app = create_app(start_runner=False, initialize_graph=False)
            completed = app.state.video_analysis_job_store.create({"filename": "platform-video.mp4", "sourceUrl": source_url})
            app.state.video_analysis_job_store.update(completed["jobId"], status="needs_review", step="等待人工审核", percent=100, script={"title": "已完成拉片"})

            with patch("src.api.video_analysis_routes._run_job", new=AsyncMock()) as worker, TestClient(app) as client:
                response = client.post("/api/video-analysis/jobs", files={"source_url": (None, source_url)})

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["jobId"], completed["jobId"])
            worker.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
