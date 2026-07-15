import importlib.util
import unittest


@unittest.skipUnless(importlib.util.find_spec("sqlalchemy"), "requires PostgreSQL model dependencies")
class AccountModelTests(unittest.TestCase):
    def test_account_persists_segmentation_and_handoff_fields(self) -> None:
        from src.models.account import Account

        columns = Account.__table__.c
        self.assertEqual(Account.__tablename__, "accounts")
        self.assertIn("account_tier", columns)
        self.assertIn("routing_policy", columns)
        self.assertIn("tier_reason", columns)
        self.assertIn("human_handoff_at", columns)


if __name__ == "__main__":
    unittest.main()
