#!/usr/bin/env python3
"""
Security testing script for the Meshroom WebApp project.

This script runs security checks including vulnerability scanning with safety
and static analysis with bandit to identify potential security issues.

Usage:
    python tests/security/test_security.py
    python tests/security/test_security.py --output-dir reports/
"""

import argparse
import json
import logging
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class SecurityTester:
    """Runs security tests for the Meshroom WebApp project."""

    def __init__(self, project_root: Path, output_dir: Optional[Path] = None):
        """
        Initialize the security tester.

        Args:
            project_root: Path to the project root directory
            output_dir: Directory to save security reports
        """
        self.project_root = project_root
        self.output_dir = output_dir or (project_root / "reports" / "security")
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def run_safety_check(self) -> Tuple[bool, Optional[Dict]]:
        """
        Run the safety check for known security vulnerabilities in dependencies.

        Returns:
            Tuple of (success, vulnerabilities_data)
        """
        logger.info("Running safety check for dependency vulnerabilities...")

        try:
            # Run safety check with JSON output
            result = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "safety",
                    "check",
                    "--json",
                    "-r",
                    str(self.project_root / "requirements.txt"),
                ],
                capture_output=True,
                text=True,
                cwd=self.project_root,
            )

            # Save raw output
            safety_report = self.output_dir / "safety_report.json"
            with open(safety_report, "w") as f:
                f.write(result.stdout)

            logger.info(f"Safety report saved to: {safety_report}")

            # Parse results
            if result.returncode == 0:
                logger.info("No known security vulnerabilities found in dependencies")
                return True, None
            else:
                try:
                    vulnerabilities = json.loads(result.stdout) if result.stdout else []
                    logger.warning(
                        f"Found {len(vulnerabilities)} security vulnerabilities"
                    )

                    # Log summary of vulnerabilities
                    for vuln in vulnerabilities:
                        package = vuln.get("package", "Unknown")
                        version = vuln.get("installed_version", "Unknown")
                        vulnerability_id = vuln.get("vulnerability_id", "Unknown")
                        logger.warning(
                            f"Vulnerability in {package} {version}: {vulnerability_id}"
                        )

                    return False, vulnerabilities
                except json.JSONDecodeError:
                    logger.error("Failed to parse safety output as JSON")
                    logger.error(f"Safety stderr: {result.stderr}")
                    return False, None

        except Exception as e:
            logger.error(f"Error running safety check: {e}")
            return False, None

    def run_bandit_scan(self) -> Tuple[bool, Optional[Dict]]:
        """
        Run bandit static analysis security scan.

        Returns:
            Tuple of (success, scan_results)
        """
        logger.info("Running bandit security scan...")

        try:
            bandit_report = self.output_dir / "bandit_report.json"

            # Run bandit scan
            subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "bandit",
                    "-r",
                    "src/",
                    "-f",
                    "json",
                    "-o",
                    str(bandit_report),
                ],
                capture_output=True,
                text=True,
                cwd=self.project_root,
            )

            logger.info(f"Bandit report saved to: {bandit_report}")

            # Parse results
            if bandit_report.exists():
                with open(bandit_report, "r") as f:
                    scan_data = json.load(f)

                issues = scan_data.get("results", [])

                # Log summary
                total_issues = len(issues)
                severity_counts = self._count_by_severity(issues)
                confidence_counts = self._count_by_confidence(issues)

                logger.info(f"Bandit scan completed. Total issues: {total_issues}")
                logger.info(f"Severity breakdown: {severity_counts}")
                logger.info(f"Confidence breakdown: {confidence_counts}")

                # Log high-severity issues
                high_severity_issues = [
                    issue
                    for issue in issues
                    if issue.get("issue_severity", "").lower() in ["high", "medium"]
                ]

                for issue in high_severity_issues:
                    filename = issue.get("filename", "Unknown")
                    line_number = issue.get("line_number", "Unknown")
                    test_name = issue.get("test_name", "Unknown")
                    severity = issue.get("issue_severity", "Unknown")
                    logger.warning(
                        f"Security issue in {filename}:{line_number} "
                        f"({test_name}, severity: {severity})"
                    )

                # Consider scan successful if no high-severity issues
                success = (
                    len(
                        [
                            issue
                            for issue in issues
                            if issue.get("issue_severity", "").lower() == "high"
                        ]
                    )
                    == 0
                )

                return success, scan_data
            else:
                logger.error("Bandit report file not created")
                return False, None

        except Exception as e:
            logger.error(f"Error running bandit scan: {e}")
            return False, None

    def _count_by_severity(self, issues: List[Dict]) -> Dict[str, int]:
        """Count issues by severity level."""
        severity_counts = {}
        for issue in issues:
            severity = issue.get("issue_severity", "Unknown").lower()
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
        return severity_counts

    def _count_by_confidence(self, issues: List[Dict]) -> Dict[str, int]:
        """Count issues by confidence level."""
        confidence_counts = {}
        for issue in issues:
            confidence = issue.get("issue_confidence", "Unknown").lower()
            confidence_counts[confidence] = confidence_counts.get(confidence, 0) + 1
        return confidence_counts

    def generate_summary_report(
        self,
        safety_result: Tuple[bool, Optional[Dict]],
        bandit_result: Tuple[bool, Optional[Dict]],
    ) -> bool:
        """
        Generate a summary security report.

        Args:
            safety_result: Results from safety check
            bandit_result: Results from bandit scan

        Returns:
            True if overall security status is acceptable
        """
        logger.info("Generating security summary report...")

        safety_success, safety_data = safety_result
        bandit_success, bandit_data = bandit_result

        summary_report = self.output_dir / "security_summary.json"

        summary = {
            # Would use datetime.now() in real implementation
            "timestamp": "2025-08-13T19:00:00Z",
            "overall_status": (
                "PASS" if (safety_success and bandit_success) else "FAIL"
            ),
            "safety_check": {
                "status": "PASS" if safety_success else "FAIL",
                "vulnerabilities_found": len(safety_data) if safety_data else 0,
            },
            "bandit_scan": {
                "status": "PASS" if bandit_success else "FAIL",
                "total_issues": len(bandit_data.get("results", []))
                if bandit_data
                else 0,
                "high_severity_issues": len(
                    [
                        issue
                        for issue in bandit_data.get("results", [])
                        if issue.get("issue_severity", "").lower() == "high"
                    ]
                )
                if bandit_data
                else 0,
            },
        }

        with open(summary_report, "w") as f:
            json.dump(summary, f, indent=2)

        logger.info(f"Security summary saved to: {summary_report}")

        # Log overall status
        if summary["overall_status"] == "PASS":
            logger.info("Overall security status: PASS")
        else:
            logger.error("Overall security status: FAIL")

        return summary["overall_status"] == "PASS"

    def run_all_security_tests(self) -> bool:
        """
        Run all security tests and generate reports.

        Returns:
            True if all security tests pass
        """
        logger.info("=" * 60)
        logger.info("RUNNING SECURITY TESTS")
        logger.info("=" * 60)
        logger.info(f"Project root: {self.project_root}")
        logger.info(f"Output directory: {self.output_dir}")

        # Run safety check
        safety_result = self.run_safety_check()

        # Run bandit scan
        bandit_result = self.run_bandit_scan()

        # Generate summary
        overall_success = self.generate_summary_report(safety_result, bandit_result)

        logger.info("=" * 60)
        logger.info("SECURITY TEST RESULTS")
        logger.info("=" * 60)
        logger.info(f"Safety check: {'PASS' if safety_result[0] else 'FAIL'}")
        logger.info(f"Bandit scan: {'PASS' if bandit_result[0] else 'FAIL'}")
        logger.info(f"Overall: {'PASS' if overall_success else 'FAIL'}")
        logger.info("=" * 60)

        return overall_success


def main():
    """Main entry point for security testing."""
    parser = argparse.ArgumentParser(
        description="Run security tests for Meshroom WebApp"
    )
    parser.add_argument(
        "--project-root", type=Path, help="Path to project root directory"
    )
    parser.add_argument(
        "--output-dir", type=Path, help="Directory to save security reports"
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
        tester = SecurityTester(project_root, args.output_dir)
        success = tester.run_all_security_tests()

        if success:
            logger.info("All security tests passed!")
            sys.exit(0)
        else:
            logger.error("Some security tests failed!")
            sys.exit(1)

    except KeyboardInterrupt:
        logger.error("Security tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Security test execution failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
