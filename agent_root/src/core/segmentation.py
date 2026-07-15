from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field


class AccountTier(StrEnum):
    KA = "KA"
    LA = "LA"
    SMB = "SMB"


class CoverageScope(StrEnum):
    NATIONAL = "national"
    LOCAL = "local"
    UNKNOWN = "unknown"


class RoutingPolicy(StrEnum):
    HUMAN_REQUIRED = "HUMAN_REQUIRED"
    HUMAN_APPROVAL = "HUMAN_APPROVAL"
    NURTURE_AUTOMATION = "NURTURE_AUTOMATION"


class SegmentationInput(BaseModel):
    company_name: str = Field(min_length=1, max_length=200)
    coverage_scope: CoverageScope
    is_business_customer: bool
    is_strategic_account: bool = False


class SegmentationDecision(BaseModel):
    account_tier: AccountTier
    routing_policy: RoutingPolicy
    tier_reason: str
    create_human_handoff: bool


def segment_account(account: SegmentationInput) -> SegmentationDecision:
    """Apply deterministic segmentation before any model or customer contact."""
    if account.is_strategic_account or (
        account.coverage_scope is CoverageScope.NATIONAL and account.is_business_customer
    ):
        return SegmentationDecision(
            account_tier=AccountTier.KA,
            routing_policy=RoutingPolicy.HUMAN_REQUIRED,
            tier_reason="全国覆盖或已标记为战略 B 端账户，必须由客户经理人工沟通。",
            create_human_handoff=True,
        )
    if account.coverage_scope is CoverageScope.LOCAL and account.is_business_customer:
        return SegmentationDecision(
            account_tier=AccountTier.LA,
            routing_policy=RoutingPolicy.HUMAN_APPROVAL,
            tier_reason="本地 B 端账户，可进行受控需求澄清，关键外发内容需人工审核。",
            create_human_handoff=False,
        )
    return SegmentationDecision(
        account_tier=AccountTier.SMB,
        routing_policy=RoutingPolicy.NURTURE_AUTOMATION,
        tier_reason="非战略或信息不足的小型账户，进入授权与频控下的标准化培育。",
        create_human_handoff=False,
    )
