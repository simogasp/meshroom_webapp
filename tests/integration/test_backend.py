#!/usr/bin/env python3
"""
Backend integration tests for the Meshroom WebApp.

This script tests backend startup, health checks, and basic API endpoints.
Can be run standalone or called by CI/CD pipelines.

Usage:
    python tests/integration/test_backend.py
    python tests/integration/test_backend.py --backend-url http://localhost:8000
"""

import argparse
import logging
import sys
import time
from typing import Optional

import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class BackendTester:
    """Test suite for backend API endpoints and functionality."""

    def __init__(self, backend_url: str = "http://localhost:8000", timeout: int = 5):
        """
        Initialize the backend tester.

        Args:
            backend_url: Base URL of the backend server
            timeout: Request timeout in seconds
        """
        self.backend_url = backend_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()

    def test_health_endpoint(self) -> bool:
        """
        Test the health check endpoint.

        Returns:
            True if health check passes, False otherwise
        """
        try:
            response = self.session.get(
                f"{self.backend_url}/health", timeout=self.timeout
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    logger.info("Health endpoint test passed")
                    return True
                else:
                    logger.error(f"Health endpoint returned unexpected status: {data}")
                    return False
            else:
                logger.error(f"Health endpoint failed: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Health endpoint test failed: {e}")
            return False

    def test_root_endpoint(self) -> bool:
        """
        Test the root endpoint.

        Returns:
            True if root endpoint works, False otherwise
        """
        try:
            response = self.session.get(f"{self.backend_url}/", timeout=self.timeout)
            if response.status_code == 200:
                data = response.json()
                if "service" in data and "version" in data:
                    logger.info("Root endpoint test passed")
                    return True
                else:
                    logger.error(f"Root endpoint returned unexpected data: {data}")
                    return False
            else:
                logger.error(f"Root endpoint failed: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Root endpoint test failed: {e}")
            return False

    def test_jobs_endpoint(self) -> bool:
        """
        Test the jobs list endpoint.

        Returns:
            True if jobs endpoint works, False otherwise
        """
        try:
            response = self.session.get(
                f"{self.backend_url}/jobs", timeout=self.timeout
            )
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    logger.info("Jobs endpoint test passed")
                    return True
                else:
                    logger.error(
                        f"Jobs endpoint returned unexpected data type: {type(data)}"
                    )
                    return False
            else:
                logger.error(f"Jobs endpoint failed: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Jobs endpoint test failed: {e}")
            return False

    def test_nonexistent_job(self) -> bool:
        """
        Test accessing a non-existent job (should return 404).

        Returns:
            True if returns proper 404, False otherwise
        """
        try:
            fake_job_id = "nonexistent-job-id"
            response = self.session.get(
                f"{self.backend_url}/jobs/{fake_job_id}", timeout=self.timeout
            )
            if response.status_code == 404:
                logger.info("Non-existent job test passed (proper 404)")
                return True
            else:
                logger.error(
                    f"Non-existent job test failed: expected 404, got {response.status_code}"
                )
                return False
        except Exception as e:
            logger.error(f"Non-existent job test failed: {e}")
            return False

    def wait_for_backend(self, max_wait: int = 30) -> bool:
        """
        Wait for backend to become available.

        Args:
            max_wait: Maximum time to wait in seconds

        Returns:
            True if backend becomes available, False if timeout
        """
        logger.info(f"Waiting for backend at {self.backend_url} (max {max_wait}s)...")

        for i in range(max_wait):
            try:
                response = self.session.get(f"{self.backend_url}/health", timeout=2)
                if response.status_code == 200:
                    logger.info(f"Backend available after {i + 1}s")
                    return True
            except requests.exceptions.RequestException:
                pass

            if i < max_wait - 1:  # Don't sleep on the last iteration
                time.sleep(1)

        logger.error(f"Backend not available after {max_wait}s")
        return False

    def run_all_tests(self) -> bool:
        """
        Run all backend tests.

        Returns:
            True if all tests pass, False otherwise
        """
        logger.info("=" * 60)
        logger.info("RUNNING BACKEND INTEGRATION TESTS")
        logger.info("=" * 60)
        logger.info(f"Backend URL: {self.backend_url}")
        logger.info(f"Timeout: {self.timeout}s")

        tests = [
            ("Health Check", self.test_health_endpoint),
            ("Root Endpoint", self.test_root_endpoint),
            ("Jobs Endpoint", self.test_jobs_endpoint),
            ("Non-existent Job", self.test_nonexistent_job),
        ]

        passed = 0
        total = len(tests)

        for test_name, test_func in tests:
            logger.info(f"Running {test_name}...")
            if test_func():
                passed += 1
            else:
                logger.error(f"{test_name} failed")

        logger.info("=" * 60)
        logger.info(f"RESULTS: {passed}/{total} tests passed")
        logger.info("=" * 60)

        return passed == total


def main():
    """Main entry point for the backend integration tests."""
    parser = argparse.ArgumentParser(description="Run backend integration tests")
    parser.add_argument(
        "--backend-url",
        default="http://localhost:8000",
        help="Backend URL to test (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--timeout", type=int, default=5, help="Request timeout in seconds (default: 5)"
    )
    parser.add_argument(
        "--wait-for-backend",
        action="store_true",
        help="Wait for backend to become available before testing",
    )
    parser.add_argument(
        "--max-wait",
        type=int,
        default=30,
        help="Maximum time to wait for backend (default: 30s)",
    )

    args = parser.parse_args()

    tester = BackendTester(args.backend_url, args.timeout)

    # Wait for backend if requested
    if args.wait_for_backend:
        if not tester.wait_for_backend(args.max_wait):
            sys.exit(1)

    # Run tests
    success = tester.run_all_tests()

    if success:
        logger.info("All backend tests passed!")
        sys.exit(0)
    else:
        logger.error("Some backend tests failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()
