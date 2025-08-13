#!/usr/bin/env python3
"""
Test runner for the Meshroom WebApp project.

This script provides a unified interface for running all tests,
including unit tests, integration tests, and end-to-end workflows.

Usage:
    python tests/run_tests.py                    # Run all tests
    python tests/run_tests.py --quick            # Run quick tests only
    python tests/run_tests.py --integration      # Run integration tests only
    python tests/run_tests.py --backend-only     # Test backend only
    python tests/run_tests.py --client-only      # Test client only
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
    # Map verbose level strings to logging constants
    level_map = {
        'DEBUG': logging.DEBUG,
        'INFO': logging.INFO,
        'WARNING': logging.WARNING,
        'ERROR': logging.ERROR
    }

    level = level_map.get(verbose_level.upper(), logging.INFO)

    # Configure logging
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        force=True  # Force reconfiguration if already configured
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

    def run_command(self, cmd: List[str], description: str) -> Tuple[bool, str]:
        """
        Run a command and return success status and output.

        Args:
            cmd: Command to run as list of strings
            description: Description of the command for logging

        Returns:
            Tuple of (success, output)
        """
        logger.info(f"Running {description}...")

        try:
            result = subprocess.run(
                cmd,
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )

            if result.returncode == 0:
                logger.info(f"{description} passed")
                return True, result.stdout
            else:
                logger.error(f"{description} failed")
                if result.stderr:
                    logger.error(f"Error output: {result.stderr}")
                return False, result.stderr

        except subprocess.TimeoutExpired:
            logger.error(f"{description} timed out")
            return False, "Command timed out"
        except Exception as e:
            logger.error(f"{description} failed with exception: {e}")
            return False, str(e)

    def ensure_backend_stopped(self):
        """Ensure the backend is stopped before tests."""
        logger.info("Ensuring backend is stopped...")
        subprocess.run([
            sys.executable, str(self.backend_manager), "stop"
        ], cwd=self.project_root, capture_output=True)

    def run_lint_checks(self) -> bool:
        """Run code linting checks."""
        logger.info("=" * 60)
        logger.info("RUNNING LINTING CHECKS")
        logger.info("=" * 60)

        # Install flake8 if needed
        subprocess.run([
            sys.executable, "-m", "pip", "install", "flake8"
        ], cwd=self.project_root, capture_output=True)

        # Build flake8 command
        flake8_cmd = [
            sys.executable, "-m", "flake8", ".",
            "--count", "--select=E9,F63,F7,F82",
            "--show-source", "--statistics", "--exclude", ".venv,venv"
        ]
        logger.debug(f"Flake8 command: {' '.join(flake8_cmd)}")
        success, _ = self.run_command(flake8_cmd, "Flake8 syntax check")

        return success

    def run_backend_startup_test(self) -> bool:
        """Test backend startup and shutdown."""
        logger.info("=" * 60)
        logger.info("TESTING BACKEND STARTUP")
        logger.info("=" * 60)

        self.ensure_backend_stopped()

        # Test startup
        success, _ = self.run_command([
            sys.executable, str(self.backend_manager), "start"
        ], "Backend startup")

        if not success:
            return False

        # Test status
        success, _ = self.run_command([
            sys.executable, str(self.backend_manager), "status"
        ], "Backend status check")

        # Always try to stop
        self.run_command([
            sys.executable, str(self.backend_manager), "stop"
        ], "Backend shutdown")

        return success

    def run_backend_integration_tests(self) -> bool:
        """Run backend integration tests."""
        logger.info("=" * 60)
        logger.info("RUNNING BACKEND INTEGRATION TESTS")
        logger.info("=" * 60)

        self.ensure_backend_stopped()

        # Start backend
        success, _ = self.run_command([
            sys.executable, str(self.backend_manager), "start"
        ], "Starting backend for integration tests")

        if not success:
            return False

        try:
            # Run backend tests
            success, _ = self.run_command([
                sys.executable, str(self.backend_tests),
                "--wait-for-backend", "--max-wait", "30"
            ], "Backend integration tests")

            return success

        finally:
            # Always stop backend
            self.run_command([
                sys.executable, str(self.backend_manager), "stop"
            ], "Stopping backend after integration tests")

    def run_client_integration_tests(self, quick: bool = False) -> bool:
        """Run client integration tests."""
        test_type = "QUICK CLIENT" if quick else "FULL CLIENT"
        logger.info("=" * 60)
        logger.info(f"RUNNING {test_type} INTEGRATION TESTS")
        logger.info("=" * 60)

        self.ensure_backend_stopped()

        # Start backend
        success, _ = self.run_command([
            sys.executable, str(self.backend_manager), "start"
        ], "Starting backend for client tests")

        if not success:
            return False

        try:
            # Run client tests
            cmd = [sys.executable, str(self.client_tests)]
            if quick:
                cmd.append("--quick")

            success, _ = self.run_command(cmd, f"{test_type.lower()} integration tests")

            return success

        finally:
            # Always stop backend
            self.run_command([
                sys.executable, str(self.backend_manager), "stop"
            ], "Stopping backend after client tests")

    def run_all_tests(self, quick: bool = False, skip_lint: bool = False) -> bool:
        """
        Run the complete test suite.

        Args:
            quick: Run quick tests only
            skip_lint: Skip linting checks

        Returns:
            True if all tests pass, False otherwise
        """
        logger.info("=" * 60)
        logger.info("MESHROOM WEBAPP TEST SUITE")
        logger.info("=" * 60)
        logger.info(f"Test mode: {'Quick' if quick else 'Full'}")
        logger.info(f"Project root: {self.project_root}")
        logger.info("=" * 60)

        results = []

        # Linting checks
        if not skip_lint:
            results.append(("Linting", self.run_lint_checks()))

        # Backend startup test
        results.append(("Backend Startup", self.run_backend_startup_test()))

        # Backend integration tests
        results.append(("Backend Integration", self.run_backend_integration_tests()))

        # Client integration tests
        results.append(("Client Integration", self.run_client_integration_tests(quick=quick)))

        # Summary
        logger.info("=" * 60)
        logger.info("TEST RESULTS SUMMARY")
        logger.info("=" * 60)

        passed = 0
        total = len(results)

        for test_name, success in results:
            status = "PASSED" if success else "FAILED"
            logger.info(f"{test_name:.<50} {status}")
            if success:
                passed += 1

        logger.info("=" * 60)
        logger.info(f"OVERALL: {passed}/{total} test suites passed")

        if passed == total:
            logger.info("ALL TESTS PASSED!")
            return True
        else:
            logger.error("SOME TESTS FAILED!")
            return False


def main():
    """Main entry point for the test runner."""
    parser = argparse.ArgumentParser(description="Run Meshroom WebApp tests")
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Run quick tests only (faster execution)"
    )
    parser.add_argument(
        "--integration",
        action="store_true",
        help="Run integration tests only"
    )
    parser.add_argument(
        "--backend-only",
        action="store_true",
        help="Run backend tests only"
    )
    parser.add_argument(
        "--client-only",
        action="store_true",
        help="Run client tests only"
    )
    parser.add_argument(
        "--skip-lint",
        action="store_true",
        help="Skip linting checks"
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        help="Path to project root directory"
    )
    parser.add_argument(
        "--verbose",
        type=str,
        default="INFO",
        help="Set the verbosity level (DEBUG, INFO, WARNING, ERROR)"
    )

    args = parser.parse_args()

    # Setup logging
    setup_logging(args.verbose)

    runner = TestRunner(args.project_root)

    try:
        if args.backend_only:
            success = (
                runner.run_backend_startup_test() and
                runner.run_backend_integration_tests()
            )
        elif args.client_only:
            success = runner.run_client_integration_tests(quick=args.quick)
        elif args.integration:
            success = (
                runner.run_backend_integration_tests() and
                runner.run_client_integration_tests(quick=args.quick)
            )
        else:
            success = runner.run_all_tests(quick=args.quick, skip_lint=args.skip_lint)

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
