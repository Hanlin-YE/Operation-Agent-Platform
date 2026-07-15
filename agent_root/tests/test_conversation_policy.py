import unittest


class ConversationPolicyTests(unittest.TestCase):
    def test_ka_message_requires_immediate_human_handoff(self) -> None:
        from src.core.conversation_policy import ConversationAction, decide_conversation_action
        from src.core.segmentation import AccountTier

        decision = decide_conversation_action(AccountTier.KA, "请给我报价")

        self.assertEqual(decision.action, ConversationAction.HANDOFF_TO_HUMAN)
        self.assertTrue(decision.create_handoff_task)

    def test_la_price_question_requires_approval(self) -> None:
        from src.core.conversation_policy import ConversationAction, decide_conversation_action
        from src.core.segmentation import AccountTier

        decision = decide_conversation_action(AccountTier.LA, "你们价格是多少")

        self.assertEqual(decision.action, ConversationAction.REQUIRE_HUMAN_APPROVAL)

    def test_smb_general_question_can_receive_controlled_nurture(self) -> None:
        from src.core.conversation_policy import ConversationAction, decide_conversation_action
        from src.core.segmentation import AccountTier

        decision = decide_conversation_action(AccountTier.SMB, "空心杯电机适合什么应用")

        self.assertEqual(decision.action, ConversationAction.NURTURE_RESPONSE)


if __name__ == "__main__":
    unittest.main()
