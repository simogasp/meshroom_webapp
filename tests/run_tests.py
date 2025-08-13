#!/usr/bin/env python3
"""
Test runner for the Meshroom WebApp project.

This script provides a unified interface for running different types of tests:
- Integration tests (backend and client communication)
- Code quality tests (linting, formatting, type checking)
- Security tests (vulnerability scanning, static analysis)

Usage:
    python tests/run_tests.py                    # Run all tests
    python tests/run_tests.py --integration      # Run integration tests only
    python tests/run_tests.py --quality          # Run code quality tests only
    python tests/run_tests.py --security         # Run security tests only
    python tests/run_tests.py --quick            # Run quick integration tests
"""

import argparse
import logging
import subprocess
import sys
import time
from pathlib import Path
from typing import List, Tuple


def setup_logging(verbose_level: str):
    """
    Set up logging configuration with the specified verbosity level.

    Args:
        verbose_level: Logging level (DEBUG, INFO, WARNING, ERROR)
    """
    level_map = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
    }

    level = level_map.get(verbose_level.upper(), logging.INFO)

    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        force=True,
    )


# Global logger - will be configured in main()
logger = logging.getLogger(__name__)


class TestRunner:
    """Orchestrates test execution for the Meshroom WebApp."""

    def __init__(self, project_root: Path = None):
        """
        Initialize the test runner.

        Args:
            project_root: Path to project root directory
        """
        if project_root is None:
            project_root = Path(__file__).parent.parent

        self.project_root = project_root
        self.tests_dir = project_root / "tests"
        self.backend_manager = self.tests_dir / "scripts" / "backend_manager.py"
        self.backend_tests = self.tests_dir / "integration" / "test_backend.py"
        self.client_tests = self.tests_dir / "integration" / "test_client.py"
        self.quality_tests = self.tests_dir / "quality" / "test_quality.py"
        self.security_tests = self.tests_dir / "security" / "test_security.py"

    def run_command(self, cmd: List[str], description: str) -> Tuple[bool, str]:
        """
        Run a command and return success status and output.

        Args:
            cmd: Command to run as list of strings
            description: Description of the command for logging

        Returns:
            Tuple of (success, output)
        """
        logger.debug(f"Running command: {' '.join(cmd)}")
        logger.info(f"Running {description}...")

        try:
            result = subprocess.run(
                cmd,
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
            )

            if result.returncode == 0:
                logger.info(f"{description} passed")
                logger.debug(f"Command output: {result.stdout}")
                return True, result.stdout
            else:
                logger.error(f"{description} failed")
                if result.stderr:
                    logger.error(f"Error output: {result.stderr}")
                if result.stdout:
                    logger.debug(f"Standard output: {result.stdout}")
                return False, result.stderr

        except subprocess.TimeoutExpired:
            logger.error(f"{description} timed out")
            return False, "Command timed out"
        except Exception as e:
            logger.error(f"{description} failed with exception: {e}")
            return False, str(e)

    def ensure_backend_stopped(self):
        """Ensure the backend is stopped before tests."""
        logger.debug("Ensuring backend is stopped...")
        subprocess.run(
            [sys.executable, str(self.backend_manager), "stop"],
            cwd=self.project_root,
            capture_output=True,
        )

    def check_test_dependencies(self) -> bool:
        """
        Check if test dependencies are installed.

        Returns:
            True if dependencies are available, False otherwise
        """
        logger.info("Checking test dependencies...")

        # Check if requirements-test.txt exists
        test_requirements = self.project_root / "requirements-test.txt"
        if not test_requirements.exists():
            logger.error(
                "requirements-test.txt not found. Please install test dependencies."
            )
            return False

        # Try to import key testing modules
        required_modules = ["flake8", "mypy", "bandit", "safety"]
        missing_modules = []

        for module in required_modules:
            try:
                result = subprocess.run(
                    [sys.executable, "-c", f"import {module}"], capture_output=True
                )
                if result.returncode != 0:
                    missing_modules.append(module)
            except Exception:
                missing_modules.append(module)

        if missing_modules:
            logger.error(f"Missing test dependencies: {', '.join(missing_modules)}")
            logger.error("Please install test dependencies with:")
            logger.error("pip install -r requirements-test.txt")
            return False

        logger.info("All test dependencies are available")
        return True

    def run_integration_tests(self, quick: bool = False) -> bool:
        """
        Run integration tests for backend and client communication.

        Args:
            quick: Run quick tests only

        Returns:
            True if all integration tests pass
        """
        test_type = "QUICK INTEGRATION" if quick else "FULL INTEGRATION"
        logger.info("=" * 60)
        logger.info(f"RUNNING {test_type} TESTS")
        logger.info("=" * 60)

        self.ensure_backend_stopped()
        results = []

        # Backend startup test
        success, _ = self.run_command(
            [sys.executable, str(self.backend_manager), "start"], "Backend startup"
        )

        if not success:
            return False

        try:
            # Backend integration tests
            success, _ = self.run_command(
                [
                    sys.executable,
                    str(self.backend_tests),
                    "--wait-for-backend",
                    "--max-wait",
                    "30",
                ],
                "Backend integration tests",
            )
            results.append(("Backend Integration", success))

            # Client integration tests
            cmd = [sys.executable, str(self.client_tests)]
            if quick:
                cmd.append("--quick")

            success, _ = self.run_command(cmd, "Client integration tests")
            results.append(("Client Integration", success))

        finally:
            # Always stop backend
            self.run_command(
                [sys.executable, str(self.backend_manager), "stop"], "Backend shutdown"
            )

        # Summary
        passed = sum(1 for _, success in results if success)
        total = len(results)

        logger.info("=" * 60)
        logger.info("INTEGRATION TEST RESULTS")
        logger.info("=" * 60)

        for test_name, success in results:
            status = "PASS" if success else "FAIL"
            logger.info(f"{test_name:.<40} {status}")

        logger.info(f"Overall: {passed}/{total} integration tests passed")

        return passed == total

    def run_quality_tests(self, fix_issues: bool = False) -> bool:
        """
        Run code quality tests.

        Args:
            fix_issues: Whether to automatically fix issues

        Returns:
            True if quality tests pass
        """
        logger.info("=" * 60)
        logger.info("RUNNING CODE QUALITY TESTS")
        logger.info("=" * 60)

        cmd = [sys.executable, str(self.quality_tests)]
        if fix_issues:
            cmd.append("--fix")

        success, _ = self.run_command(cmd, "Code quality tests")
        return success

    def run_security_tests(self) -> bool:
        """
        Run security tests.

        Returns:
            True if security tests pass
        """
        logger.info("=" * 60)
        logger.info("RUNNING SECURITY TESTS")
        logger.info("=" * 60)

        success, _ = self.run_command(
            [sys.executable, str(self.security_tests)], "Security tests"
        )
        return success

    def run_all_tests(self, quick: bool = False, fix_issues: bool = False) -> bool:
        """
        Run all test suites.

        Args:
            quick: Run quick integration tests only
            fix_issues: Automatically fix code quality issues

        Returns:
            True if all tests pass, False otherwise
        """
        logger.info("=" * 60)
        logger.info("MESHROOM WEBAPP COMPLETE TEST SUITE")
        logger.info("=" * 60)
        logger.info(f"Integration test mode: {'Quick' if quick else 'Full'}")
        logger.info(f"Fix quality issues: {fix_issues}")
        logger.info(f"Project root: {self.project_root}")
        logger.info("=" * 60)

        # Check dependencies first
        if not self.check_test_dependencies():
            return False

        results = []

        # Run all test suites
        results.append(("Integration Tests", self.run_integration_tests(quick=quick)))
        results.append(
            ("Code Quality Tests", self.run_quality_tests(fix_issues=fix_issues))
        )
        results.append(("Security Tests", self.run_security_tests()))

        # Final summary
        logger.info("=" * 60)
        logger.info("COMPLETE TEST SUITE RESULTS")
        logger.info("=" * 60)

        passed = 0
        total = len(results)

        for test_suite, success in results:
            status = "PASS" if success else "FAIL"
            logger.info(f"{test_suite:.<40} {status}")
            if success:
                passed += 1

        logger.info("=" * 60)
        logger.info(f"OVERALL: {passed}/{total} test suites passed")

        if passed == total:
            logger.info("ALL TEST SUITES PASSED!")
            return True
        else:
            logger.error("SOME TEST SUITES FAILED!")
            return False


def main():
    """Main entry point for the test runner."""
    parser = argparse.ArgumentParser(description="Run Meshroom WebApp tests")

    # Test type selection (mutually exclusive group)
    test_group = parser.add_mutually_exclusive_group()
    test_group.add_argument(
        "--integration", action="store_true", help="Run integration tests only"
    )
    test_group.add_argument(
        "--quality", action="store_true", help="Run code quality tests only"
    )
    test_group.add_argument(
        "--security", action="store_true", help="Run security tests only"
    )

    # Test modifiers
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Run quick integration tests (faster execution)",
    )
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Automatically fix code quality issues when possible",
    )

    # General options
    parser.add_argument(
        "--project-root", type=Path, help="Path to project root directory"
    )
    parser.add_argument(
        "--verbose",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Set the verbosity level",
    )

    args = parser.parse_args()

    # Setup logging
    setup_logging(args.verbose)

    runner = TestRunner(args.project_root)

    try:
        if args.integration:
            success = runner.run_integration_tests(quick=args.quick)
        elif args.quality:
            success = runner.run_quality_tests(fix_issues=args.fix)
        elif args.security:
            success = runner.run_security_tests()
        else:
            # Run all tests
            success = runner.run_all_tests(quick=args.quick, fix_issues=args.fix)

        sys.exit(0 if success else 1)

    except KeyboardInterrupt:
        logger.error("Tests interrupted by user")
        runner.ensure_backend_stopped()
        sys.exit(1)
    except Exception as e:
        logger.error(f"Test execution failed: {e}")
        runner.ensure_backend_stopped()
        sys.exit(1)


if __name__ == "__main__":
    main()
