import unittest


class SegmentationPolicyTests(unittest.TestCase):
    def test_national_strategic_account_is_ka_and_requires_human(self) -> None:
        from src.core.segmentation import AccountTier, RoutingPolicy, SegmentationInput, segment_account

        decision = segment_account(
            SegmentationInput(
                company_name="全国机器人集团",
                coverage_scope="national",
                is_business_customer=True,
                is_strategic_account=True,
            )
        )

        self.assertEqual(decision.account_tier, AccountTier.KA)
        self.assertEqual(decision.routing_policy, RoutingPolicy.HUMAN_REQUIRED)
        self.assertTrue(decision.create_human_handoff)

    def test_local_b2b_account_requires_approval_not_automatic_outreach(self) -> None:
        from src.core.segmentation import AccountTier, RoutingPolicy, SegmentationInput, segment_account

        decision = segment_account(
            SegmentationInput(company_name="深圳本地医疗设备厂", coverage_scope="local", is_business_customer=True)
        )

        self.assertEqual(decision.account_tier, AccountTier.LA)
        self.assertEqual(decision.routing_policy, RoutingPolicy.HUMAN_APPROVAL)
        self.assertFalse(decision.create_human_handoff)

    def test_unknown_or_small_account_enters_permissioned_smb_nurture(self) -> None:
        from src.core.segmentation import AccountTier, RoutingPolicy, SegmentationInput, segment_account

        decision = segment_account(SegmentationInput(company_name="示例工作室", coverage_scope="unknown", is_business_customer=False))

        self.assertEqual(decision.account_tier, AccountTier.SMB)
        self.assertEqual(decision.routing_policy, RoutingPolicy.NURTURE_AUTOMATION)
        self.assertFalse(decision.create_human_handoff)


if __name__ == "__main__":
    unittest.main()
