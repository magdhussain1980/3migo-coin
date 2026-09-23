import sys
import unittest

def main():
print("=" * 60)
print("3Migo Economic Engine V2 - Automated Test")
print("=" * 60)

loader = unittest.TestLoader()

try:
    suite = loader.loadTestsFromName("test_economic_engine")

    runner = unittest.TextTestRunner(
        verbosity=2
    )

    result = runner.run(suite)

    print()
    print("=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    print(f"Tests run : {result.testsRun}")
    print(f"Failures  : {len(result.failures)}")
    print(f"Errors    : {len(result.errors)}")

    if result.wasSuccessful():
        print()
        print("STATUS: PASS")
        print("3Migo Economic Engine V2 is ready for the next integration stage.")
        return 0

    print()
    print("STATUS: FAIL")
    print("Review the failed tests before continuing.")
    return 1

except Exception as exc:
    print()
    print("STATUS: ERROR")
    print(f"Error: {exc}")
    return 1

if name == "main":
sys.exit(main())