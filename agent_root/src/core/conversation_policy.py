from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel

from src.core.segmentation import AccountTier


class ConversationAction(StrEnum):
    HANDOFF_TO_HUMAN = "HANDOFF_TO_HUMAN"
    REQUIRE_HUMAN_APPROVAL = "REQUIRE_HUMAN_APPROVAL"
    NURTURE_RESPONSE = "NURTURE_RESPONSE"


class ConversationDecision(BaseModel):
    action: ConversationAction
    reason: str
    create_handoff_task: bool = False
    allow_video_recommendation: bool = False


def decide_conversation_action(account_tier: AccountTier, message: str) -> ConversationDecision:
    """Apply tier and risk policy before retrieval or model generation."""
    if account_tier is AccountTier.KA:
        return ConversationDecision(
            action=ConversationAction.HANDOFF_TO_HUMAN,
            reason="KA 账户必须由客户经理人工沟通。",
            create_handoff_task=True,
        )
    risky_intent = any(keyword in message for keyword in ("价格", "报价", "合同", "寿命", "8000", "20000", "参数"))
    if account_tier is AccountTier.LA and risky_intent:
        return ConversationDecision(
            action=ConversationAction.REQUIRE_HUMAN_APPROVAL,
            reason="LA 账户的报价、性能和关键技术内容须人工审核。",
            allow_video_recommendation=True,
        )
    return ConversationDecision(
        action=ConversationAction.NURTURE_RESPONSE,
        reason="可在授权与频控策略下提供已审核的标准化内容。",
        allow_video_recommendation=True,
    )
