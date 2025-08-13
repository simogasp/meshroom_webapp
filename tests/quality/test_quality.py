#!/usr/bin/env python3
"""
Code quality testing script for the Meshroom WebApp project.

This script runs code quality checks including linting with flake8,
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
from typing import List, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class QualityTester:
    """Runs code quality tests for the Meshroom WebApp project."""

    def __init__(self, project_root: Path, output_dir: Path = None, fix_issues: bool = False):
        """
        Initialize the quality tester.

        Args:
            project_root: Path to the project root directory
            output_dir: Directory to save quality reports
            fix_issues: Whether to automatically fix issues when possible
        """
        self.project_root = project_root
        self.output_dir = output_dir or (project_root / "reports" / "quality")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.fix_issues = fix_issues

    def run_flake8_check(self) -> Tuple[bool, str]:
        """
        Run flake8 linting checks.

        Returns:
            Tuple of (success, output)
        """
        logger.info("Running flake8 linting checks...")

        try:
            # Basic flake8 configuration
            flake8_args = [
                sys.executable, "-m", "flake8",
                "src/", "tests/",
                "--count",
                "--statistics",
                "--max-line-length=88",
                "--extend-ignore=E203,W503",  # Compatible with black formatter
                "--exclude=__pycache__,.git,.tox,dist,*.egg",
                "--format=%(path)s:%(row)d:%(col)d: %(code)s %(text)s"
            ]

            # Save output to file
            output_file = self.output_dir / "flake8_report.txt"

            result = subprocess.run(
                flake8_args,
                capture_output=True,
                text=True,
                cwd=self.project_root
            )

            # Save report
            with open(output_file, 'w') as f:
                f.write(f"Flake8 Report\n")
                f.write(f"=============\n\n")
                f.write(f"Return code: {result.returncode}\n\n")
                f.write(f"STDOUT:\n{result.stdout}\n\n")
                f.write(f"STDERR:\n{result.stderr}\n")

            logger.info(f"Flake8 report saved to: {output_file}")

            if result.returncode == 0:
                logger.info("Flake8 checks passed - no linting issues found")
                return True, result.stdout
            else:
                logger.warning(f"Flake8 found linting issues")
                logger.warning(f"Issues:\n{result.stdout}")
                return False, result.stdout

        except Exception as e:
            logger.error(f"Error running flake8: {e}")
            return False, str(e)

    def run_mypy_check(self) -> Tuple[bool, str]:
        """
        Run mypy type checking.

        Returns:
            Tuple of (success, output)
        """
        logger.info("Running mypy type checking...")

        try:
            mypy_args = [
                sys.executable, "-m", "mypy",
                "src/",
                "--ignore-missing-imports",
                "--strict-optional",
                "--warn-redundant-casts",
                "--warn-unused-ignores",
                "--show-error-codes"
            ]

            # Save output to file
            output_file = self.output_dir / "mypy_report.txt"

            result = subprocess.run(
                mypy_args,
                capture_output=True,
                text=True,
                cwd=self.project_root
            )

            # Save report
            with open(output_file, 'w') as f:
                f.write(f"MyPy Report\n")
                f.write(f"===========\n\n")
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

    def run_black_check(self) -> Tuple[bool, str]:
        """
        Run black code formatting check.

        Returns:
            Tuple of (success, output)
        """
        action = "Fixing" if self.fix_issues else "Checking"
        logger.info(f"{action} code formatting with black...")

        try:
            black_args = [
                sys.executable, "-m", "black",
                "src/", "tests/",
                "--line-length=88",
                "--target-version=py39"
            ]

            if not self.fix_issues:
                black_args.extend(["--check", "--diff"])

            # Save output to file
            output_file = self.output_dir / "black_report.txt"

            result = subprocess.run(
                black_args,
                capture_output=True,
                text=True,
                cwd=self.project_root
            )

            # Save report
            with open(output_file, 'w') as f:
                f.write(f"Black Report\n")
                f.write(f"============\n\n")
                f.write(f"Return code: {result.returncode}\n\n")
                f.write(f"STDOUT:\n{result.stdout}\n\n")
                f.write(f"STDERR:\n{result.stderr}\n")

            logger.info(f"Black report saved to: {output_file}")

            if result.returncode == 0:
                if self.fix_issues:
                    logger.info("Code formatting applied successfully")
                else:
                    logger.info("Code formatting checks passed")
                return True, result.stdout
            else:
                if self.fix_issues:
                    logger.warning("Black encountered errors while formatting")
                else:
                    logger.warning("Code formatting issues found")
                logger.warning(f"Output:\n{result.stdout}")
                return False, result.stdout

        except Exception as e:
            logger.error(f"Error running black: {e}")
            return False, str(e)

    def run_isort_check(self) -> Tuple[bool, str]:
        """
        Run isort import sorting check.

        Returns:
            Tuple of (success, output)
        """
        action = "Fixing" if self.fix_issues else "Checking"
        logger.info(f"{action} import sorting with isort...")

        try:
            isort_args = [
                sys.executable, "-m", "isort",
                "src/", "tests/",
                "--profile=black",
                "--line-length=88"
            ]

            if not self.fix_issues:
                isort_args.extend(["--check-only", "--diff"])

            # Save output to file
            output_file = self.output_dir / "isort_report.txt"

            result = subprocess.run(
                isort_args,
                capture_output=True,
                text=True,
                cwd=self.project_root
            )

            # Save report
            with open(output_file, 'w') as f:
                f.write(f"isort Report\n")
                f.write(f"============\n\n")
                f.write(f"Return code: {result.returncode}\n\n")
                f.write(f"STDOUT:\n{result.stdout}\n\n")
                f.write(f"STDERR:\n{result.stderr}\n")

            logger.info(f"isort report saved to: {output_file}")

            if result.returncode == 0:
                if self.fix_issues:
                    logger.info("Import sorting applied successfully")
                else:
                    logger.info("Import sorting checks passed")
                return True, result.stdout
            else:
                if self.fix_issues:
                    logger.warning("isort encountered errors while sorting")
                else:
                    logger.warning("Import sorting issues found")
                logger.warning(f"Output:\n{result.stdout}")
                return False, result.stdout

        except Exception as e:
            logger.error(f"Error running isort: {e}")
            return False, str(e)

    def run_all_quality_tests(self) -> bool:
        """
        Run all code quality tests.

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
        results.append(("Flake8 Linting", self.run_flake8_check()))
        results.append(("MyPy Type Checking", self.run_mypy_check()))
        results.append(("Black Formatting", self.run_black_check()))
        results.append(("isort Import Sorting", self.run_isort_check()))

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
    parser = argparse.ArgumentParser(description="Run code quality tests for Meshroom WebApp")
    parser.add_argument(
        "--project-root",
        type=Path,
        help="Path to project root directory"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="Directory to save quality reports"
    )
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Automatically fix issues when possible"
    )
    parser.add_argument(
        "--verbose",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Set the verbosity level"
    )

    args = parser.parse_args()

    # Setup logging
    level_map = {
        'DEBUG': logging.DEBUG,
        'INFO': logging.INFO,
        'WARNING': logging.WARNING,
        'ERROR': logging.ERROR
    }

    logging.basicConfig(
        level=level_map[args.verbose],
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        force=True
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
