import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


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


if __name__ == "__main__":
    unittest.main()
