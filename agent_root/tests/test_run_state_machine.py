import unittest


class RunStateMachineContractTests(unittest.TestCase):
    def test_pending_run_can_move_through_review_to_success(self) -> None:
        from src.core.run_state import RunStatus, transition_run

        self.assertEqual(transition_run(RunStatus.PENDING, RunStatus.EXTRACTING), RunStatus.EXTRACTING)
        self.assertEqual(
            transition_run(RunStatus.EXTRACTING, RunStatus.WAITING_REVIEW),
            RunStatus.WAITING_REVIEW,
        )
        self.assertEqual(transition_run(RunStatus.WAITING_REVIEW, RunStatus.ANNOTATING), RunStatus.ANNOTATING)
        self.assertEqual(transition_run(RunStatus.ANNOTATING, RunStatus.SUCCESS), RunStatus.SUCCESS)

    def test_terminal_run_cannot_be_reopened_without_retry_policy(self) -> None:
        from src.core.run_state import InvalidRunTransition, RunStatus, transition_run

        with self.assertRaises(InvalidRunTransition):
            transition_run(RunStatus.SUCCESS, RunStatus.PENDING)


if __name__ == "__main__":
    unittest.main()
