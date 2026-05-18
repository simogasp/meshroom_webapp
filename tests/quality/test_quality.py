#!/usr/bin/env python3
"""Code quality testing script for the Meshroom WebApp project.

This script runs code quality checks including linting with ruff,
type checking with mypy, and code formatting checks.

Usage:
    python tests/quality/test_quality.py
    python tests/quality/test_quality.py --fix
    python tests/quality/test_quality.py --output-dir reports/
"""

import argparse
import logging
import subprocess
import sys
from pathlib import Path
from typing import Optional, Tuple


# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class QualityTester:
    """Runs code quality tests for the Meshroom WebApp project."""

    def __init__(
        self,
        project_root: Path,
        output_dir: Path | None = None,
        fix_issues: bool = False,
    ):
        """Initialize the quality tester.

        Args:
            project_root: Path to the project root directory
            output_dir: Directory to save quality reports
            fix_issues: Whether to automatically fix issues when possible

        """
        self.project_root = project_root
        self.output_dir = output_dir or (project_root / "reports" / "quality")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.fix_issues = fix_issues

    def run_ruff_check(self) -> tuple[bool, str]:
        """Run ruff linting checks (replaces flake8 and isort).

        Returns:
            Tuple of (success, output)

        """
        action = "Fixing" if self.fix_issues else "Checking"
        logger.info(f"{action} code with ruff linter...")

        try:
            # Ruff check includes linting, pyflakes, isort, and more
            ruff_args = [
                sys.executable,
                "-m",
                "ruff",
                "check",
                "src/",
                "tests/",
                # Configuration is automatically read from pyproject.toml
            ]

            if self.fix_issues:
                ruff_args.append("--fix")

            # Save output to file
            output_file = self.output_dir / "ruff_report.txt"

            result = subprocess.run(
                ruff_args, capture_output=True, text=True, cwd=self.project_root
            )

            # Save report
            with open(output_file, "w") as f:
                f.write("Ruff Linting Report\n")
                f.write("===================\n\n")
                f.write(f"Return code: {result.returncode}\n\n")
                f.write(f"STDOUT:\n{result.stdout}\n\n")
                f.write(f"STDERR:\n{result.stderr}\n")

            logger.info(f"Ruff report saved to: {output_file}")

            if result.returncode == 0:
                if self.fix_issues:
                    logger.info("Ruff fixes applied successfully")
                else:
                    logger.info("Ruff checks passed - no linting issues found")
                return True, result.stdout
            else:
                if self.fix_issues:
                    logger.warning("Ruff found issues that could not be auto-fixed")
                else:
                    logger.warning("Ruff found linting issues")
                logger.warning(f"Issues:\n{result.stdout}")
                return False, result.stdout

        except Exception as e:
            logger.error(f"Error running ruff: {e}")
            return False, str(e)

    def run_ruff_format_check(self) -> tuple[bool, str]:
        """Run ruff format check (replaces black).

        Returns:
            Tuple of (success, output)

        """
        action = "Formatting" if self.fix_issues else "Checking format of"
        logger.info(f"{action} code with ruff formatter...")

        try:
            ruff_args = [
                sys.executable,
                "-m",
                "ruff",
                "format",
                "src/",
                "tests/",
                # Configuration is automatically read from pyproject.toml
            ]

            if not self.fix_issues:
                ruff_args.append("--check")

            # Save output to file
            output_file = self.output_dir / "ruff_format_report.txt"

            result = subprocess.run(
                ruff_args, capture_output=True, text=True, cwd=self.project_root
            )

            # Save report
            with open(output_file, "w") as f:
                f.write("Ruff Format Report\n")
                f.write("==================\n\n")
                f.write(f"Return code: {result.returncode}\n\n")
                f.write(f"STDOUT:\n{result.stdout}\n\n")
                f.write(f"STDERR:\n{result.stderr}\n")

            logger.info(f"Ruff format report saved to: {output_file}")

            if result.returncode == 0:
                if self.fix_issues:
                    logger.info("Code formatting applied successfully")
                else:
                    logger.info("Code formatting checks passed")
                return True, result.stdout
            else:
                if self.fix_issues:
                    logger.warning("Ruff format encountered errors")
                else:
                    logger.warning("Code formatting issues found")
                logger.warning(f"Output:\n{result.stdout}")
                return False, result.stdout

        except Exception as e:
            logger.error(f"Error running ruff format: {e}")
            return False, str(e)

    def run_mypy_check(self) -> tuple[bool, str]:
        """Run mypy type checking.

        Returns:
            Tuple of (success, output)

        """
        logger.info("Running mypy type checking...")

        try:
            # MyPy will automatically use [tool.mypy] configuration from pyproject.toml
            mypy_args = [
                sys.executable,
                "-m",
                "mypy",
                "src/",
            ]

            # Save output to file
            output_file = self.output_dir / "mypy_report.txt"

            result = subprocess.run(
                mypy_args, capture_output=True, text=True, cwd=self.project_root
            )

            # Save report
            with open(output_file, "w") as f:
                f.write("MyPy Report\n")
                f.write("===========\n\n")
                f.write(f"Return code: {result.returncode}\n\n")
                f.write(f"STDOUT:\n{result.stdout}\n\n")
                f.write(f"STDERR:\n{result.stderr}\n")

            logger.info(f"MyPy report saved to: {output_file}")

            if result.returncode == 0:
                logger.info("MyPy type checking passed")
                return True, result.stdout
            else:
                logger.warning("MyPy found type checking issues")
                logger.warning(f"Issues:\n{result.stdout}")
                return False, result.stdout

        except Exception as e:
            logger.error(f"Error running mypy: {e}")
            return False, str(e)

    def run_all_quality_tests(self) -> bool:
        """Run all code quality tests.

        Returns:
            True if all quality tests pass

        """
        logger.info("=" * 60)
        logger.info("RUNNING CODE QUALITY TESTS")
        logger.info("=" * 60)
        logger.info(f"Project root: {self.project_root}")
        logger.info(f"Output directory: {self.output_dir}")
        logger.info(f"Fix issues: {self.fix_issues}")

        results = []

        # Run all checks
        results.append(("Ruff Linting", self.run_ruff_check()))
        results.append(("Ruff Formatting", self.run_ruff_format_check()))
        results.append(("MyPy Type Checking", self.run_mypy_check()))

        # Summary
        logger.info("=" * 60)
        logger.info("CODE QUALITY TEST RESULTS")
        logger.info("=" * 60)

        passed = 0
        total = len(results)

        for test_name, (success, _) in results:
            status = "PASS" if success else "FAIL"
            logger.info(f"{test_name:.<40} {status}")
            if success:
                passed += 1

        logger.info("=" * 60)
        logger.info(f"OVERALL: {passed}/{total} quality tests passed")

        overall_success = passed == total

        if overall_success:
            logger.info("All code quality tests passed!")
        else:
            logger.error("Some code quality tests failed!")

        logger.info("=" * 60)

        return overall_success


def main():
    """Main entry point for code quality testing."""
    parser = argparse.ArgumentParser(
        description="Run code quality tests for Meshroom WebApp"
    )
    parser.add_argument(
        "--project-root", type=Path, help="Path to project root directory"
    )
    parser.add_argument(
        "--output-dir", type=Path, help="Directory to save quality reports"
    )
    parser.add_argument(
        "--fix", action="store_true", help="Automatically fix issues when possible"
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
    level_map = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
    }

    logging.basicConfig(
        level=level_map[args.verbose],
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        force=True,
    )

    # Determine project root
    if args.project_root:
        project_root = args.project_root
    else:
        project_root = Path(__file__).parent.parent.parent

    try:
        tester = QualityTester(project_root, args.output_dir, args.fix)
        success = tester.run_all_quality_tests()

        if success:
            logger.info("All code quality tests passed!")
            sys.exit(0)
        else:
            logger.error("Some code quality tests failed!")
            sys.exit(1)

    except KeyboardInterrupt:
        logger.error("Code quality tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Code quality test execution failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
