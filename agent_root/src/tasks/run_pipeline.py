from __future__ import annotations

from pydantic import BaseModel

from src.services.feishu_client import InMemoryFeishuClient
from src.services.llm_provider import GraphContext, LlmProvider
from src.tasks.step3_ai_annotate import annotate_from_approved_graph_context


class RunAnnotation(BaseModel):
    summary: str
    entities: list[str]
    recommended_actions: list[str]


def _collected_item(run_id: str, industry: str) -> dict[str, object]:
    return {
        "id": f"mat_{run_id[-8:]}",
        "title": f"{industry}行业新收集信息",
        "summary": f"发现与 {industry} 场景相关的潜在线索与应用需求，等待人工核验。",
        "source": "本地演示采集器",
        "entities": [industry, "Friction X"],
    }


async def process_next_run(control_plane: InMemoryFeishuClient, provider: LlmProvider) -> None:
    pending = control_plane.claim_pending_run()
    if pending:
        industry = str(pending.params.get("industry") or "目标")
        control_plane.complete_extraction(pending.run_id, [_collected_item(pending.run_id, industry)])
        return

    annotating = control_plane.claim_annotating_run()
    if not annotating:
        return

    approved = set(annotating.approved_material_ids)
    evidence = [item for item in annotating.collected_items if str(item.get("id")) in approved]
    try:
        annotation = await annotate_from_approved_graph_context(
            provider,
            GraphContext(user_id=None, evidence=evidence),
            RunAnnotation,
            "Summarize newly collected, human-approved information and propose safe next actions.",
        )
        control_plane.complete_annotation(
            annotating.run_id,
            {"provider_model": provider.model_name, **annotation.model_dump()},
        )
    except Exception:
        control_plane.fail_annotation(annotating.run_id, "模型 Provider 处理失败，请检查配置或稍后重试。")
