#! /usr/bin/env python
"""
CLI client for testing the fake photogrammetry backend.

This module provides a command-line interface for testing the backend
workflow, including image upload, progress monitoring via WebSocket,
and model download.
"""

import json
import logging
import os
import random
import time
from typing import Any, Dict, List, Optional

import requests
import websocket

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class PhotogrammetryClient:
    """
    Client for communicating with the fake photogrammetry backend.

    Handles image upload, WebSocket communication for progress updates,
    and model download functionality.
    """

    def __init__(self, base_url: str = "http://localhost:8000"):
        """
        Initialize the client.

        Args:
            base_url: Base URL of the backend server
        """
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        ws_url = self.base_url.replace("http://", "ws://").replace("https://", "wss://")
        self.websocket_url = ws_url

    def generate_dummy_image(self, filename: str, size_kb: int = 1) -> bytes:
        """
        Generate dummy image data for testing.

        Args:
            filename: Name of the image file
            size_kb: Size of the dummy image in KB

        Returns:
            Dummy image data as bytes
        """
        # Create the dummy JPEG-like header
        jpeg_header = (
            b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01" b"\x00H\x00H\x00\x00"
        )

        # Generate random data to reach desired size
        target_size = size_kb * 1024
        remaining_size = max(0, target_size - len(jpeg_header) - 2)
        # Account for end marker

        # nosec B311: Using random for test data generation only
        random_data = bytes([random.randint(0, 255) for _ in range(remaining_size)])

        # Add JPEG end marker
        jpeg_end = b"\xff\xd9"

        return jpeg_header + random_data + jpeg_end

    def generate_test_images(self, count: int = 5) -> List[Dict[str, Any]]:
        """
        Generate a set of test images.

        Args:
            count: Number of images to generate

        Returns:
            List of image data dictionaries
        """
        images = []
        for i in range(count):
            filename = f"test_image_{i+1:03d}.jpg"
            # nosec B311: Using random for test data generation only
            size_kb = random.randint(1, 10)  # Random size between 1-10 KB
            content = self.generate_dummy_image(filename, size_kb)

            images.append(
                {"filename": filename, "content": content, "size_kb": size_kb}
            )

        logger.info(f"Generated {count} test images")
        return images

    def upload_images(
        self,
        images: List[Dict[str, Any]],
        quality: str = "medium",
        max_features: int = 1000,
        enable_gpu: bool = False,
    ) -> Optional[str]:
        """
        Upload images to the backend for processing.

        Args:
            images: List of image data dictionaries
            quality: Processing quality level
            max_features: Maximum number of features to extract
            enable_gpu: Whether to enable GPU acceleration

        Returns:
            Job ID if successful, None otherwise
        """
        try:
            # Prepare files for upload
            files = []
            for image in images:
                files.append(
                    ("files", (image["filename"], image["content"], "image/jpeg"))
                )

            # Prepare the form data
            data = {
                "quality": quality,
                "max_features": max_features,
                "enable_gpu": enable_gpu,
            }

            logger.info(f"Uploading {len(images)} images to {self.base_url}/upload")
            logger.info(
                f"Parameters: quality={quality}, "
                f"max_features={max_features}, enable_gpu={enable_gpu}"
            )

            # Send upload request
            response = self.session.post(
                f"{self.base_url}/upload", files=files, data=data, timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                job_id: str = result["job_id"]
                logger.info(f"Upload successful! Job ID: {job_id}")
                return job_id
            else:
                logger.error(f"Upload failed: {response.status_code} - {response.text}")
                return None

        except Exception as e:
            logger.error(f"Upload error: {e}")
            return None

    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get job status from the backend.

        Args:
            job_id: The job identifier

        Returns:
            Job status data or None if failed
        """
        try:
            response = self.session.get(f"{self.base_url}/jobs/{job_id}")
            if response.status_code == 200:
                result: Dict[str, Any] = response.json()
                return result
            else:
                logger.error(f"Failed to get job status: {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"Error getting job status: {e}")
            return None

    def download_model(
        self, job_id: str, output_dir: Optional[str] = None
    ) -> Optional[str]:
        """
        Download the generated 3D model.

        Args:
            job_id: The job identifier
            output_dir: Directory to save the model (defaults to project
                        output directory)

        Returns:
            Path to downloaded file or None if failed
        """
        try:
            # Use the project's output directory if not specified
            if output_dir is None:
                # Get the project root - need to go up 5 levels from this file
                # client.py -> fake_frontend -> frontend -> src -> project_root
                current_file = os.path.abspath(__file__)
                project_root = os.path.dirname(
                    os.path.dirname(os.path.dirname(os.path.dirname(current_file)))
                )
                output_dir = os.path.join(
                    project_root, "output", "frontend", "fake_frontend", "downloads"
                )

            # Create output directory
            os.makedirs(output_dir, exist_ok=True)

            # Retry mechanism for download (handles race condition)
            max_retries = 5
            retry_delay = 1.0

            for attempt in range(max_retries):
                try:
                    # Download model
                    response = self.session.get(
                        f"{self.base_url}/jobs/{job_id}/download"
                    )

                    if response.status_code == 200:
                        filename = f"{job_id}_model.glb"
                        filepath = os.path.join(output_dir, filename)

                        with open(filepath, "wb") as f:
                            f.write(response.content)

                        logger.info(
                            f"Model downloaded: {filepath} "
                            f"({len(response.content)} bytes)"
                        )
                        return filepath
                    elif (
                        response.status_code == 400 and "not completed" in response.text
                    ):
                        # Job status race condition - wait and retry
                        if attempt < max_retries - 1:
                            msg = (
                                f"Job not yet marked as completed, "
                                f"retrying in {retry_delay}s... "
                                f"(attempt {attempt + 1}/{max_retries})"
                            )
                            logger.info(msg)
                            time.sleep(retry_delay)
                            continue
                        else:
                            logger.error(
                                f"Download failed after {max_retries} "
                                f"attempts: {response.status_code} - "
                                f"{response.text}"
                            )
                            return None
                    else:
                        logger.error(
                            f"Download failed: {response.status_code} - "
                            f"{response.text}"
                        )
                        return None

                except Exception as e:
                    if attempt < max_retries - 1:
                        logger.warning(
                            f"Download attempt {attempt + 1} failed: {e}, "
                            f"retrying..."
                        )
                        time.sleep(retry_delay)
                        continue
                    else:
                        raise e

            # If we get here, all retry attempts failed
            return None

        except Exception as e:
            logger.error(f"Download error: {e}")
            return None

    def monitor_progress_websocket(self, job_id: str, timeout: int = 300) -> bool:
        """
        Monitor job progress via WebSocket.

        Args:
            job_id: The job identifier
            timeout: Maximum time to wait for completion (seconds)

        Returns:
            True if the job completed successfully, False otherwise
        """
        ws_url = f"{self.websocket_url}/ws/{job_id}"
        logger.info(f"Connecting to WebSocket: {ws_url}")

        completed = False
        start_time = time.time()

        def on_message(ws, message):
            nonlocal completed
            try:
                data = json.loads(message)

                if "error" in data:
                    logger.error(f"WebSocket error: {data['error']}")
                    ws.close()
                    return

                progress = data.get("progress", 0)
                msg = data.get("message", "")

                logger.info(f"Progress: {progress}% - {msg}")

                if progress >= 100:
                    completed = True
                    ws.close()

            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON message: {message}")
            except Exception as e:
                logger.error(f"Message handling error: {e}")

        def on_error(ws, error):
            logger.error(f"WebSocket error: {error}")

        def on_close(ws, close_status_code, close_msg):
            logger.info("WebSocket connection closed")

        def on_open(ws):
            logger.info("WebSocket connection established")

        try:
            # Create WebSocket connection
            ws = websocket.WebSocketApp(
                ws_url,
                on_open=on_open,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close,
            )

            # Run WebSocket in a separate thread
            import threading

            def run_websocket():
                ws.run_forever()

            ws_thread = threading.Thread(target=run_websocket)
            ws_thread.daemon = True
            ws_thread.start()

            # Wait for completion or timeout
            while not completed and (time.time() - start_time) < timeout:
                time.sleep(1)

            ws.close()

            if completed:
                logger.info("Job completed successfully!")
                return True
            else:
                logger.warning("Timeout waiting for job completion")
                return False

        except Exception as e:
            logger.error(f"WebSocket monitoring error: {e}")
            return False

    def run_test_workflow(
        self, image_count: int = 5, quality: str = "medium", max_features: int = 1000
    ) -> bool:
        """
        Run a complete test workflow.

        Args:
            image_count: Number of test images to generate
            quality: Processing quality level
            max_features: Maximum number of features to extract

        Returns:
            True if workflow completed successfully, False otherwise
        """
        logger.info("=" * 60)
        logger.info("STARTING PHOTOGRAMMETRY TEST WORKFLOW")
        logger.info("=" * 60)

        try:
            # Step 1: Generate test images
            logger.info("Step 1: Generating test images...")
            images = self.generate_test_images(image_count)
            total_size_kb = sum(img["size_kb"] for img in images)
            logger.info(f"Generated {len(images)} images ({total_size_kb} KB total)")

            # Step 2: Upload images
            logger.info("Step 2: Uploading images...")
            job_id = self.upload_images(images, quality, max_features)
            if not job_id:
                logger.error("Upload failed!")
                return False

            # Step 3: Monitor progress
            logger.info("Step 3: Monitoring progress...")
            success = self.monitor_progress_websocket(job_id)
            if not success:
                logger.error("Progress monitoring failed!")
                return False

            # Step 4: Get final job status
            logger.info("Step 4: Getting final job status...")
            status = self.get_job_status(job_id)
            if status:
                logger.info(f"Final status: {status['status']}")
                duration = status.get("duration_seconds", "N/A")
                logger.info(f"Processing time: {duration} seconds")

            # Step 5: Download model
            logger.info("Step 5: Downloading 3D model...")
            model_path = self.download_model(job_id)
            if not model_path:
                logger.error("Model download failed!")
                return False

            logger.info("=" * 60)
            logger.info("WORKFLOW COMPLETED SUCCESSFULLY!")
            logger.info(f"Model saved to: {model_path}")
            logger.info("=" * 60)

            return True

        except Exception as e:
            logger.error(f"Workflow failed: {e}")
            return False


def main():
    """Main entry point for the CLI client."""

    logger.info("Fake Photogrammetry Client v0.1.0")
    logger.info("=" * 50)

    # Check if backend is running
    client = PhotogrammetryClient()
    try:
        response = requests.get(f"{client.base_url}/health", timeout=5)
        if response.status_code != 200:
            logger.error(f"Backend health check failed: {response.status_code}")
            return
    except Exception as e:
        logger.error(f"Cannot connect to backend at {client.base_url}")
        logger.error(f"Error: {e}")
        logger.info("\nPlease ensure the backend server is running:")
        logger.info("  cd src/backend/fake_backend")
        logger.info("  python main.py")
        return

    logger.info("Backend is running and healthy!")
    logger.info("")

    # Run test workflow
    success = client.run_test_workflow(image_count=8, quality="high", max_features=2000)

    if success:
        logger.info("\n✅ All tests passed!")
    else:
        logger.error("\n❌ Some tests failed!")


if __name__ == "__main__":
    main()
