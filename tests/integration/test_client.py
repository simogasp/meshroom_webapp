#!/usr/bin/env python3
"""
Client integration tests for the Meshroom WebApp.

This script tests the full client workflow including image upload,
progress monitoring, and model download functionality.

Usage:
    python tests/integration/test_client.py
    python tests/integration/test_client.py --backend-url http://localhost:8000 --quick
"""

import argparse
import json
import logging
import random
import sys
import time
from typing import Optional

import requests
import websocket

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class ClientIntegrationTester:
    """Integration test suite for the client workflow."""

    def __init__(self, backend_url: str = "http://localhost:8000", timeout: int = 10):
        """
        Initialize the client integration tester.

        Args:
            backend_url: Base URL of the backend server
            timeout: Request timeout in seconds
        """
        self.backend_url = backend_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        self.websocket_url = self.backend_url.replace("http://", "ws://").replace(
            "https://", "wss://"
        )

    def generate_test_image(self, filename: str, size_kb: int = 1) -> bytes:
        """
        Generate a small test image for upload testing.

        Args:
            filename: Name of the test image
            size_kb: Size in KB

        Returns:
            Dummy image data as bytes
        """
        # Create minimal JPEG-like header
        jpeg_header = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00"

        # Generate random data
        target_size = size_kb * 1024
        remaining_size = max(0, target_size - len(jpeg_header) - 2)
        random_data = bytes([random.randint(0, 255) for _ in range(remaining_size)])

        # Add JPEG end marker
        jpeg_end = b"\xff\xd9"

        return jpeg_header + random_data + jpeg_end

    def test_image_upload(self, num_images: int = 3) -> Optional[str]:
        """
        Test uploading images to the backend using dynamic parameters JSON.

        Args:
            num_images: Number of test images to upload

        Returns:
            Job ID if successful, None otherwise
        """
        try:
            logger.info(f"Testing image upload with {num_images} images...")

            # Generate test images
            files = []
            for i in range(num_images):
                filename = f"test_image_{i+1:03d}.jpg"
                size_kb = random.randint(1, 5)  # Small test images
                content = self.generate_test_image(filename, size_kb)
                files.append(("files", (filename, content, "image/jpeg")))

            # Dynamic parameters JSON (minimal example); server will use defaults if omitted
            params = {"quality": "medium"}
            data = {"parameters": json.dumps(params)}

            response = self.session.post(
                f"{self.backend_url}/upload",
                files=files,
                data=data,
                timeout=self.timeout,
            )

            if response.status_code == 200:
                result = response.json()
                job_id = result.get("job_id")
                if job_id:
                    logger.info(f"Image upload successful, job ID: {job_id}")
                    return job_id
                else:
                    logger.error("Upload response missing job_id")
                    return None
            else:
                logger.error(
                    f"Image upload failed: {response.status_code} - {response.text}"
                )
                return None

        except Exception as e:
            logger.error(f"Image upload test failed: {e}")
            return None

    def test_job_status_polling(self, job_id: str) -> bool:
        """
        Test polling job status endpoint.

        Args:
            job_id: Job identifier

        Returns:
            True if status polling works, False otherwise
        """
        try:
            logger.info("Testing job status polling...")

            response = self.session.get(
                f"{self.backend_url}/jobs/{job_id}", timeout=self.timeout
            )

            if response.status_code == 200:
                status_data = response.json()
                required_fields = ["job_id", "status", "progress", "created_at"]

                for field in required_fields:
                    if field not in status_data:
                        logger.error(
                            f"Missing required field in status response: {field}"
                        )
                        return False

                logger.info(
                    f"Job status polling works, status: {status_data['status']}"
                )
                return True
            else:
                logger.error(f"Job status polling failed: {response.status_code}")
                return False

        except Exception as e:
            logger.error(f"Job status polling test failed: {e}")
            return False

    def test_websocket_connection(self, job_id: str, quick_test: bool = True) -> bool:
        """
        Test WebSocket connection for progress updates.

        Args:
            job_id: Job identifier
            quick_test: If True, just test connection and first message

        Returns:
            True if WebSocket test passes, False otherwise
        """
        try:
            logger.info("Testing WebSocket connection...")

            ws_url = f"{self.websocket_url}/ws/{job_id}"
            received_messages = []
            connection_successful = False

            def on_message(ws, message):
                nonlocal connection_successful
                try:
                    data = json.loads(message)
                    received_messages.append(data)

                    if "job_id" in data and data["job_id"] == job_id:
                        connection_successful = True

                    if quick_test and connection_successful:
                        ws.close()

                except json.JSONDecodeError:
                    logger.error(f"Invalid WebSocket message: {message}")

            def on_error(ws, error):
                logger.error(f"WebSocket error: {error}")

            def on_close(ws, close_status_code, close_msg):
                pass  # Normal close

            def on_open(ws):
                pass  # Connection opened

            # Create WebSocket connection
            ws = websocket.WebSocketApp(
                ws_url,
                on_open=on_open,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close,
            )

            # Run WebSocket with timeout
            import threading

            def run_websocket():
                ws.run_forever()

            ws_thread = threading.Thread(target=run_websocket)
            ws_thread.daemon = True
            ws_thread.start()

            # Wait for test completion
            max_wait = 10 if quick_test else 60
            for _ in range(max_wait):
                if connection_successful:
                    break
                time.sleep(1)

            ws.close()

            if connection_successful:
                logger.info(
                    f"WebSocket test passed, received {len(received_messages)} messages"
                )
                return True
            else:
                logger.error("WebSocket test failed - no valid messages received")
                return False

        except Exception as e:
            logger.error(f"WebSocket test failed: {e}")
            return False

    def test_model_download_when_ready(self, job_id: str, max_wait: int = 120) -> bool:
        """
        Test model download when job is completed.

        Args:
            job_id: Job identifier
            max_wait: Maximum time to wait for completion

        Returns:
            True if download test passes, False otherwise
        """
        try:
            logger.info("Testing model download (waiting for job completion)...")

            # Wait for job to complete
            for i in range(max_wait):
                response = self.session.get(
                    f"{self.backend_url}/jobs/{job_id}", timeout=self.timeout
                )
                if response.status_code == 200:
                    status_data = response.json()
                    if status_data.get("status") == "completed":
                        logger.info(f"Job completed after {i + 1}s")
                        break
                    elif status_data.get("status") == "failed":
                        logger.error("Job failed during processing")
                        return False

                if i < max_wait - 1:
                    time.sleep(1)
            else:
                logger.error(f"Job did not complete within {max_wait}s")
                return False

            # Test download
            response = self.session.get(
                f"{self.backend_url}/jobs/{job_id}/download", timeout=self.timeout
            )

            if response.status_code == 200:
                content = response.content
                if len(content) > 0:
                    logger.info(f"Model download successful ({len(content)} bytes)")
                    return True
                else:
                    logger.error("Downloaded model is empty")
                    return False
            else:
                logger.error(f"Model download failed: {response.status_code}")
                return False

        except Exception as e:
            logger.error(f"Model download test failed: {e}")
            return False

    def run_quick_tests(self) -> bool:
        """
        Run quick integration tests (upload + basic checks).

        Returns:
            True if all quick tests pass, False otherwise
        """
        logger.info("=" * 60)
        logger.info("RUNNING QUICK CLIENT INTEGRATION TESTS")
        logger.info("=" * 60)

        # Test upload
        job_id = self.test_image_upload(num_images=2)
        if not job_id:
            return False

        # Test status polling
        if not self.test_job_status_polling(job_id):
            return False

        # Test WebSocket connection
        if not self.test_websocket_connection(job_id, quick_test=True):
            return False

        logger.info("Quick tests completed successfully!")
        return True

    def run_full_tests(self) -> bool:
        """
        Run full integration tests (complete workflow).

        Returns:
            True if all tests pass, False otherwise
        """
        logger.info("=" * 60)
        logger.info("RUNNING FULL CLIENT INTEGRATION TESTS")
        logger.info("=" * 60)

        # Test upload
        job_id = self.test_image_upload(num_images=3)
        if not job_id:
            return False

        # Test status polling
        if not self.test_job_status_polling(job_id):
            return False

        # Test WebSocket with longer monitoring
        if not self.test_websocket_connection(job_id, quick_test=False):
            return False

        # Test model download when ready
        if not self.test_model_download_when_ready(job_id):
            return False

        logger.info("Full integration tests completed successfully!")
        return True


def main():
    """Main entry point for client integration tests."""
    parser = argparse.ArgumentParser(description="Run client integration tests")
    parser.add_argument(
        "--backend-url",
        default="http://localhost:8000",
        help="Backend URL to test (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=10,
        help="Request timeout in seconds (default: 10)",
    )
    parser.add_argument(
        "--quick", action="store_true", help="Run quick tests only (no full workflow)"
    )

    args = parser.parse_args()

    tester = ClientIntegrationTester(args.backend_url, args.timeout)

    try:
        if args.quick:
            success = tester.run_quick_tests()
        else:
            success = tester.run_full_tests()

        if success:
            logger.info("All client integration tests passed!")
            sys.exit(0)
        else:
            logger.error("Some client integration tests failed!")
            sys.exit(1)

    except KeyboardInterrupt:
        logger.error("Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Test execution failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
