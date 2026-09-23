import os
import tempfile
import unittest

import economic_engine

class TestEconomicEngineV2(unittest.TestCase):

@classmethod
def setUpClass(cls):
    # Use a temporary database so the test never modifies production data.
    cls.temp_dir = tempfile.TemporaryDirectory()
    cls.db_path = os.path.join(cls.temp_dir.name, "test_3migo_economic.db")

    economic_engine.DB_PATH = cls.db_path
    economic_engine.init_economic_engine()

    cls.user_id = 990000001
    cls.reference_mining = "TEST-MINING-001"
    cls.reference_spend = "TEST-SPEND-001"

@classmethod
def tearDownClass(cls):
    cls.temp_dir.cleanup()

def test_01_tokenomics(self):
    result = economic_engine.validate_tokenomics()

    self.assertTrue(result["valid"])
    self.assertEqual(
        result["max_supply"],
        30_000_000_000.0
    )
    self.assertEqual(
        result["allocation_total"],
        30_000_000_000.0
    )
    self.assertEqual(result["difference"], 0.0)

def test_02_engine_health(self):
    result = economic_engine.health()

    self.assertEqual(result["status"], "ok")
    self.assertEqual(
        result["engine"],
        "3Migo Economic Engine"
    )
    self.assertEqual(result["version"], "2.0")
    self.assertTrue(result["tokenomics_valid"])

def test_03_create_economic_user(self):
    result = economic_engine.ensure_user_account(self.user_id)

    self.assertIsNotNone(result)

    profile = economic_engine.user_economic_profile(self.user_id)

    self.assertEqual(profile["telegram_id"], self.user_id)
    self.assertEqual(profile["total_mined"], 0.0)
    self.assertEqual(profile["locked_3m"], 0.0)
    self.assertEqual(profile["unlocked_3m"], 0.0)

def test_04_add_contribution(self):
    result = economic_engine.add_contribution(
        telegram_id=self.user_id,
        contribution_type="daily_activity",
        score=10.0,
        reference="TEST-CONTRIBUTION-001"
    )

    self.assertIsNotNone(result)

    profile = economic_engine.user_economic_profile(self.user_id)

    self.assertGreaterEqual(
        profile["contribution_score"],
        10.0
    )

def test_05_set_trust_score(self):
    result = economic_engine.set_trust_score(
        telegram_id=self.user_id,
        trust_score=95.0
    )

    self.assertIsNotNone(result)

    profile = economic_engine.user_economic_profile(self.user_id)

    self.assertEqual(
        profile["trust_score"],
        95.0
    )

def test_06_register_mining_reward(self):
    result = economic_engine.register_mining_reward(
        telegram_id=self.user_id,
        amount_3m=100.0,
        reference=self.reference_mining
    )

    self.assertIsNotNone(result)

    profile = economic_engine.user_economic_profile(self.user_id)

    self.assertEqual(
        profile["total_mined"],
        100.0
    )

    self.assertEqual(
        profile["locked_3m"],
        100.0
    )

    self.assertEqual(
        profile["unlocked_3m"],
        0.0
    )

def test_07_mining_idempotency(self):
    result = economic_engine.register_mining_reward(
        telegram_id=self.user_id,
        amount_3m=100.0,
        reference=self.reference_mining
    )

    profile = economic_engine.user_economic_profile(self.user_id)

    # The same reference must not create another reward.
    self.assertEqual(
        profile["total_mined"],
        100.0
    )

    self.assertEqual(
        profile["locked_3m"],
        100.0
    )

def test_08_unlock_3m(self):
    result = economic_engine.unlock_3m(
        telegram_id=self.user_id,
        amount_3m=40.0,
        reference="TEST-UNLOCK-001"
    )

    self.assertIsNotNone(result)

    profile = economic_engine.user_economic_profile(self.user_id)

    self.assertEqual(
        profile["locked_3m"],
        60.0
    )

    self.assertEqual(
        profile["unlocked_3m"],
        40.0
    )

def test_09_spend_3m(self):
    result = economic_engine.spend_3m(
        telegram_id=self.user_id,
        amount_3m=10.0,
        service_type="ai_hub",
        reference=self.reference_spend,
        description="Test AI Hub service"
    )

    self.assertIsNotNone(result)

    profile = economic_engine.user_economic_profile(self.user_id)

    self.assertEqual(
        profile["unlocked_3m"],
        30.0
    )

def test_10_spending_protection(self):
    with self.assertRaises(Exception):
        economic_engine.spend_3m(
            telegram_id=self.user_id,
            amount_3m=1000.0,
            service_type="ai_hub",
            reference="TEST-SPEND-OVER-001",
            description="Should fail"
        )

def test_11_airdrop_preview(self):
    result = economic_engine.calculate_airdrop_preview(
        telegram_id=self.user_id
    )

    self.assertIsNotNone(result)

    self.assertIn(
        "eligible",
        result
    )

    self.assertIn(
        "airdrop_3m",
        result
    )

def test_12_revenue_record(self):
    result = economic_engine.record_revenue(
        source="affiliate",
        campaign_id="TEST-CAMPAIGN-001",
        gross_amount=100.0,
        currency="USD",
        notes="Automated test revenue"
    )

    self.assertIsNotNone(result)

def test_13_revenue_confirmation(self):
    # Find the latest test revenue through the engine database.
    conn = economic_engine.get_connection()

    try:
        row = conn.execute(
            """
            SELECT revenue_id
            FROM revenue_ledger_v2
            ORDER BY id DESC
            LIMIT 1
            """
        ).fetchone()
    finally:
        conn.close()

    self.assertIsNotNone(row)

    revenue_id = row["revenue_id"]

    result = economic_engine.confirm_revenue(
        revenue_id=revenue_id
    )

    self.assertIsNotNone(result)

def test_14_economic_summary(self):
    result = economic_engine.economic_summary()

    self.assertEqual(
        result["project"],
        "3Migo"
    )

    self.assertEqual(
        result["version"],
        "2.0"
    )

    self.assertEqual(
        result["unit"],
        "3M"
    )

    self.assertEqual(
        result["tokenomics"]["max_supply"],
        30_000_000_000.0
    )

    self.assertTrue(
        result["tokenomics"]["valid"]
    )

def test_15_economic_capacity(self):
    result = economic_engine.economic_capacity()

    self.assertEqual(
        result["max_supply"],
        30_000_000_000.0
    )

    self.assertEqual(
        result["mining_allocation"],
        12_000_000_000.0
    )

    self.assertGreaterEqual(
        result["remaining_mining"],
        0.0
    )

def test_16_user_profile_integrity(self):
    profile = economic_engine.user_economic_profile(
        self.user_id
    )

    self.assertEqual(
        profile["total_mined"],
        100.0
    )

    self.assertEqual(
        profile["locked_3m"],
        60.0
    )

    self.assertEqual(
        profile["unlocked_3m"],
        30.0
    )

    self.assertGreaterEqual(
        profile["contribution_score"],
        10.0
    )

    self.assertEqual(
        profile["trust_score"],
        95.0
    )

if name == "main":
unittest.main(verbosity=2)