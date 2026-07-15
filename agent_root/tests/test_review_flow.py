import asyncio
import unittest

from src.api.schemas import TaskType
from src.core.run_state import RunStatus
from src.services.llm_provider import GraphContext
from src.services.feishu_client import InMemoryFeishuClient


class RecordingProvider:
    model_name = "recording-model"
    consecutive_overages = 0

    def __init__(self) -> None:
        self.contexts: list[GraphContext] = []

    async def generate_json(self, context, output_model, instruction):
        self.contexts.append(context)
        return output_model.model_validate(
            {
                "summary": "已完成审核素材的结构化标注。",
                "entities": ["航空", "Friction X"],
                "recommended_actions": ["进入线索核验队列"],
            }
        )


class ReviewFlowTests(unittest.TestCase):
    def test_worker_can_promote_pending_run_to_review_and_confirm_it(self) -> None:
        control_plane = InMemoryFeishuClient()
        run = control_plane.create_task_record(
            TaskType.PROFILER,
            {"industry": "航空"},
            "review-flow-test-0001",
        )

        claimed = control_plane.claim_pending_run()
        self.assertEqual(claimed.run_id, run.run_id)
        self.assertEqual(claimed.status, RunStatus.EXTRACTING)

        control_plane.complete_extraction(run.run_id, ["mat_001"])
        confirmed = control_plane.confirm_materials(
            run_id=run.run_id,
            approved_material_ids=["mat_001"],
            rejected_material_ids=[],
            reviewer_id="operator_001",
            comment=None,
            expected_version=3,
        )

        self.assertEqual(confirmed.status, RunStatus.ANNOTATING)

    def test_approved_material_is_sent_to_provider_and_completed(self) -> None:
        from src.tasks.run_pipeline import process_next_run

        control_plane = InMemoryFeishuClient()
        provider = RecordingProvider()
        run = control_plane.create_task_record(
            TaskType.PROFILER,
            {"industry": "航空"},
            "provider-flow-test-0001",
        )

        asyncio.run(process_next_run(control_plane, provider))
        waiting = control_plane.get_task_record(run.run_id)
        self.assertEqual(waiting.status, RunStatus.WAITING_REVIEW)
        self.assertEqual(waiting.collected_items[0]["title"], "航空行业新收集信息")

        control_plane.confirm_materials(
            run_id=run.run_id,
            approved_material_ids=waiting.material_ids,
            rejected_material_ids=[],
            reviewer_id="operator_001",
            comment=None,
            expected_version=waiting.version,
        )
        asyncio.run(process_next_run(control_plane, provider))

        completed = control_plane.get_task_record(run.run_id)
        self.assertEqual(completed.status, RunStatus.SUCCESS)
        self.assertEqual(completed.result["provider_model"], "recording-model")
        self.assertEqual(completed.result["summary"], "已完成审核素材的结构化标注。")
        self.assertEqual(provider.contexts[0].evidence[0]["id"], waiting.material_ids[0])


if __name__ == "__main__":
    unittest.main()
