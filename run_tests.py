import unittest
import test_economic_engine


def main():
    print("=" * 60)
    print("3Migo Economic Engine V2 - Automated Tests")
    print("=" * 60)

    suite = unittest.defaultTestLoader.loadTestsFromModule(
        test_economic_engine
    )

    runner = unittest.TextTestRunner(
        verbosity=2
    )

    result = runner.run(suite)

    print("=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")

    if result.wasSuccessful():
        print("RESULT: PASS")
        return 0

    print("RESULT: FAIL")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())