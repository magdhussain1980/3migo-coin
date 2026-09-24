import unittest

import economic_engine


class TestEconomicEngine(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        economic_engine.init_economic_engine()

    def setUp(self):
        self.telegram_id = 9988776655

    def test_tokenomics(self):
        data = economic_engine.validate_tokenomics()

        self.assertTrue(data["valid"])
        self.assertEqual(data["percentage_total"], 100.0)
        self.assertEqual(
            data["allocation_total"],
            data["max_supply"]
        )

    def test_health(self):
        data = economic_engine.health()

        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["engine"], "3Migo Economic Engine")
        self.assertTrue(data["tokenomics_valid"])

    def test_user_creation(self):
        data = economic_engine.ensure_user_account(
            self.telegram_id
        )

        self.assertEqual(
            data["telegram_id"],
            self.telegram_id
        )

    def test_contribution(self):
        data = economic_engine.add_contribution(
            self.telegram_id,
            100,
            source="test",
            reference="test_contribution_001"
        )

        self.assertEqual(
            data["contribution_score"],
            100
        )

    def test_trust_score(self):
        data = economic_engine.set_trust_score(
            self.telegram_id,
            85
        )

        self.assertEqual(
            data["trust_score"],
            85
        )

    def test_mining(self):
        result = economic_engine.register_mining_reward(
            self.telegram_id,
            10,
            reference="test_mining_001"
        )

        self.assertTrue(result["success"])
        self.assertEqual(result["reward_3m"], 10)
        self.assertEqual(result["status"], "locked")

    def test_mining_idempotency(self):
        result = economic_engine.register_mining_reward(
            self.telegram_id,
            10,
            reference="test_mining_001"
        )

        self.assertTrue(result["duplicate"])

    def test_unlock(self):
        result = economic_engine.unlock_3m(
            self.telegram_id,
            5,
            reference="test_unlock_001"
        )

        self.assertTrue(result["success"])

        profile = economic_engine.user_economic_profile(
            self.telegram_id
        )

        self.assertEqual(profile["locked_3m"], 5)
        self.assertEqual(profile["unlocked_3m"], 5)

    def test_spend(self):
        result = economic_engine.spend_3m(
            self.telegram_id,
            "test_service",
            2,
            reference="test_spend_001"
        )

        self.assertTrue(result["success"])

        profile = economic_engine.user_economic_profile(
            self.telegram_id
        )

        self.assertEqual(profile["unlocked_3m"], 3)

    def test_spending_protection(self):
        with self.assertRaises(Exception):
            economic_engine.spend_3m(
                self.telegram_id,
                "test_service",
                1000,
                reference="test_spend_invalid_001"
            )

    def test_airdrop_preview(self):
        data = economic_engine.calculate_airdrop_preview(
            self.telegram_id
        )

        self.assertIn("telegram_id", data)
        self.assertIn("airdrop_3m", data)

    def test_revenue_record(self):
        result = economic_engine.record_revenue(
            source="test",
            gross_amount=100,
            fees=10,
            currency="USD",
            reference="test_revenue_001",
            status="pending"
        )

        self.assertTrue(result["success"])
        self.assertEqual(result["gross_amount"], 100)
        self.assertEqual(result["fees"], 10)
        self.assertEqual(result["net_amount"], 90)

    def test_revenue_confirmation(self):
        result = economic_engine.confirm_revenue(
            "test_revenue_001"
        )

        self.assertTrue(result["success"])

    def test_summary(self):
        data = economic_engine.economic_summary()

        self.assertEqual(data["project"], "3Migo")
        self.assertEqual(data["unit"], "3M")
        self.assertEqual(data["status"], "internal_economic_layer")
        self.assertEqual(data["blockchain"], "not_active")

    def test_capacity(self):
        data = economic_engine.economic_capacity()

        self.assertEqual(
            data["max_supply"],
            30_000_000_000.0
        )

        self.assertGreaterEqual(
            data["remaining_supply"],
            0
        )

    def test_profile_integrity(self):
        data = economic_engine.user_economic_profile(
            self.telegram_id
        )

        self.assertEqual(
            data["telegram_id"],
            self.telegram_id
        )

        self.assertGreaterEqual(
            data["trust_score"],
            0
        )

        self.assertLessEqual(
            data["trust_score"],
            100
        )


if __name__ == "__main__":
    unittest.main()