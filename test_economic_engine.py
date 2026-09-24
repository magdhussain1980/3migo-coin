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
        self.assertEqual(
            data["engine"],
            "3Migo Economic Engine"
        )
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
        reference = "test_contribution_001"

        data = economic_engine.add_contribution(
            self.telegram_id,
            100,
            source="test",
            reference=reference
        )

        self.assertEqual(
            data["telegram_id"],
            self.telegram_id
        )

        self.assertGreaterEqual(
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
        reference = "test_mining_001"

        result = economic_engine.register_mining_reward(
            self.telegram_id,
            10,
            reference=reference
        )

        self.assertTrue(
            result["success"] or result["duplicate"]
        )

        self.assertEqual(
            result["reward_3m"],
            10
        )

        self.assertEqual(
            result["status"],
            "locked"
        )

    def test_mining_idempotency(self):
        reference = "test_mining_idempotency_001"

        first = economic_engine.register_mining_reward(
            self.telegram_id,
            10,
            reference=reference
        )

        second = economic_engine.register_mining_reward(
            self.telegram_id,
            10,
            reference=reference
        )

        self.assertTrue(
            first["success"] or first["duplicate"]
        )

        self.assertTrue(
            second["duplicate"]
        )

    def test_unlock(self):
        reference = "test_unlock_003"

        before = economic_engine.user_economic_profile(
            self.telegram_id
        )

        locked_before = float(
            before["locked_3m"]
        )

        unlocked_before = float(
            before["unlocked_3m"]
        )

        if locked_before < 5:

            mining_reference = "test_unlock_mining_003"

            economic_engine.register_mining_reward(
                self.telegram_id,
                10,
                reference=mining_reference
            )

            before = economic_engine.user_economic_profile(
                self.telegram_id
            )

            locked_before = float(
                before["locked_3m"]
            )

            unlocked_before = float(
                before["unlocked_3m"]
            )

        self.assertGreaterEqual(
            locked_before,
            5
        )

        result = economic_engine.unlock_3m(
            self.telegram_id,
            5,
            reference=reference
        )

        self.assertTrue(
            result["success"] or result["duplicate"]
        )

        after = economic_engine.user_economic_profile(
            self.telegram_id
        )

        if result["success"]:

            self.assertEqual(
                float(after["locked_3m"]),
                locked_before - 5
            )

            self.assertEqual(
                float(after["unlocked_3m"]),
                unlocked_before + 5
            )

        else:

            self.assertGreaterEqual(
                float(after["unlocked_3m"]),
                unlocked_before
            )

    def test_spend(self):
        before = economic_engine.user_economic_profile(
            self.telegram_id
        )

        unlocked_before = float(
            before["unlocked_3m"]
        )

        if unlocked_before < 2:

            locked_before = float(
                before["locked_3m"]
            )

            if locked_before < 2:

                economic_engine.register_mining_reward(
                    self.telegram_id,
                    10,
                    reference="test_spend_mining_003"
                )

            economic_engine.unlock_3m(
                self.telegram_id,
                2,
                reference="test_spend_unlock_003"
            )

        before = economic_engine.user_economic_profile(
            self.telegram_id
        )

        unlocked_before = float(
            before["unlocked_3m"]
        )

        self.assertGreaterEqual(
            unlocked_before,
            2
        )

        result = economic_engine.spend_3m(
            self.telegram_id,
            "test_service",
            2,
            reference="test_spend_003"
        )

        self.assertTrue(
            result["success"] or result["duplicate"]
        )

        after = economic_engine.user_economic_profile(
            self.telegram_id
        )

        if result["success"]:

            self.assertEqual(
                float(after["unlocked_3m"]),
                unlocked_before - 2
            )

    def test_spending_protection(self):
        with self.assertRaises(Exception):

            economic_engine.spend_3m(
                self.telegram_id,
                "test_service",
                1000000,
                reference="test_spend_invalid_003"
            )

    def test_airdrop_preview(self):
        data = economic_engine.calculate_airdrop_preview(
            self.telegram_id
        )

        self.assertIn(
            "telegram_id",
            data
        )

        self.assertIn(
            "eligible_pool",
            data
        )

        self.assertIn(
            "user_contribution_score",
            data
        )

        self.assertIn(
            "total_contribution_score",
            data
        )

        self.assertIn(
            "estimated_airdrop_3m",
            data
        )

        self.assertEqual(
            data["telegram_id"],
            self.telegram_id
        )

        self.assertGreaterEqual(
            float(data["estimated_airdrop_3m"]),
            0
        )

    def test_revenue_record(self):
        reference = "test_revenue_003"

        result = economic_engine.record_revenue(
            source="test",
            gross_amount=100,
            fees=10,
            currency="USD",
            reference=reference,
            status="pending"
        )

        self.assertTrue(
            result["success"] or result.get("duplicate", False)
        )

        if result["success"]:

            self.assertEqual(
                result["gross_amount"],
                100
            )

            self.assertEqual(
                result["fees"],
                10
            )

            self.assertEqual(
                result["net_amount"],
                90
            )

    def test_revenue_confirmation(self):
        reference = "test_revenue_confirm_003"

        economic_engine.record_revenue(
            source="test_confirmation",
            gross_amount=100,
            fees=10,
            currency="USD",
            reference=reference,
            status="pending"
        )

        result = economic_engine.confirm_revenue(
            reference
        )

        self.assertTrue(
            result["success"] or result.get("duplicate", False)
        )

    def test_summary(self):
        data = economic_engine.economic_summary()

        self.assertEqual(
            data["project"],
            "3Migo"
        )

        self.assertEqual(
            data["unit"],
            "3M"
        )

        self.assertEqual(
            data["status"],
            "internal_economic_layer"
        )

        self.assertEqual(
            data["blockchain"],
            "not_active"
        )

        self.assertEqual(
            data["market_value"],
            "not_defined"
        )

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

        self.assertGreaterEqual(
            data["remaining_mining"],
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
            float(data["trust_score"]),
            0
        )

        self.assertLessEqual(
            float(data["trust_score"]),
            100
        )

        self.assertGreaterEqual(
            float(data["total_mined"]),
            0
        )

        self.assertGreaterEqual(
            float(data["locked_3m"]),
            0
        )

        self.assertGreaterEqual(
            float(data["unlocked_3m"]),
            0
        )

        self.assertGreaterEqual(
            float(data["airdrop_3m"]),
            0
        )


if __name__ == "__main__":
    unittest.main()