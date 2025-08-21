"""
Job manager for simulating photogrammetry processing.

This module handles job lifecycle management, progress simulation,
and WebSocket communication for the fake backend.
"""

import asyncio
import logging
import os
import random
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from fastapi import WebSocket

try:
    from .models import JobStatus, ProcessingJob, ProgressUpdate, WebSocketConnection
except ImportError:
    # Handle direct execution
    from models import (  # type: ignore[no-redef]
        JobStatus,
        ProcessingJob,
        ProgressUpdate,
        WebSocketConnection,
    )


logger = logging.getLogger(__name__)


def generate_dummy_model(job_id: str) -> bytes:
    """
    Generate a dummy GLB model file.

    Args:
        job_id: The job identifier

    Returns:
        Dummy GLB file content as bytes
    """
    # Create a simple dummy GLB file header
    # This is not a real GLB file, just dummy data for testing
    header = b"glTF" + b"\x02\x00\x00\x00"  # GLB version 2.0

    # Generate some random binary data to simulate a model
    # nosec B311: Using random for test data generation only, not cryptographic
    model_data = bytes([random.randint(0, 255) for _ in range(1024)])

    # Add job ID as metadata (for identification)
    metadata = f"Generated for job: {job_id}".encode("utf-8")

    return header + len(metadata).to_bytes(4, "little") + metadata + model_data


def generate_real_model(job_id: str) -> bytes:
    """
    Load a real GLB model file from the assets folder.

    Args:
        job_id: The job identifier (used for logging, not file selection)

    Returns:
        Real GLB file content as bytes from assets/monstree.glb

    Raises:
        FileNotFoundError: If the monstree.glb file is not found
        IOError: If there's an error reading the file
    """
    # Get the project root path (4 levels up from this file)
    current_file = os.path.abspath(__file__)
    project_root = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.dirname(current_file)))
    )
    asset_path = os.path.join(project_root, "assets", "monstree.glb")

    try:
        with open(asset_path, "rb") as f:
            model_data = f.read()

        logger.info(
            f"Loaded real model for job {job_id}: {len(model_data)} bytes from {asset_path}"
        )
        return model_data

    except FileNotFoundError as e:
        logger.error(f"Real model file not found: {asset_path}")
        raise FileNotFoundError(f"Asset file not found: {asset_path}") from e

    except IOError as e:
        logger.error(f"Error reading real model file: {e}")
        raise IOError(f"Error reading asset file: {asset_path}") from e


class JobManager:
    """
    Manages processing jobs and WebSocket connections with FIFO queue processing.

    Simulates photogrammetry processing with random progress updates,
    manages real-time communication with clients, and processes jobs
    one at a time in a first-in-first-out queue.
    """

    def __init__(self) -> None:
        """Initialize the job manager."""
        self._jobs: Dict[str, ProcessingJob] = {}
        self._connections: Dict[str, WebSocket] = {}
        self._job_subscriptions: Dict[str, Set[str]] = {}  # job_id -> connection_ids
        self._job_queue: List[str] = []  # FIFO queue of job IDs
        self._current_processing_job: Optional[str] = None
        self._processing_task: Optional[asyncio.Task] = None
        self._queue_processor_running = False
        self._queue_event = asyncio.Event()  # Event to wake queue processor

    @property
    def active_jobs_count(self) -> int:
        """Get count of active (non-completed) jobs."""
        return sum(
            1
            for job in self._jobs.values()
            if job.status in [JobStatus.QUEUED, JobStatus.PENDING, JobStatus.PROCESSING]
        )

    @property
    def total_jobs_count(self) -> int:
        """Get the total count of all jobs."""
        return len(self._jobs)

    @property
    def queue_length(self) -> int:
        """Get the current queue length."""
        return len(self._job_queue)

    @property
    def is_processing(self) -> bool:
        """Check if a job is currently being processed."""
        return self._current_processing_job is not None

    def create_job(self, job: ProcessingJob) -> str:
        """
        Create a new processing job and add it to the queue.

        Args:
            job: The processing job to create

        Returns:
            The job ID
        """
        # Add job to storage
        self._jobs[job.job_id] = job

        # Transition from PENDING to QUEUED (maintaining backward compatibility)
        job.status = JobStatus.QUEUED

        # Add to queue and set queue position
        self._job_queue.append(job.job_id)
        job.queue_position = len(self._job_queue)

        logger.info(
            f"Created job {job.job_id} with {job.total_images} images, queue position: {job.queue_position}"
        )

        # Start queue processor if not running
        if not self._queue_processor_running:
            asyncio.create_task(self._process_queue())
        else:
            # Wake up queue processor for new job
            self._queue_event.set()

        return job.job_id

    def get_job(self, job_id: str) -> Optional[ProcessingJob]:
        """
        Get a job by ID.

        Args:
            job_id: The job identifier

        Returns:
            The processing job or None if not found
        """
        job = self._jobs.get(job_id)
        if job and job.status == JobStatus.QUEUED:
            # Update queue position
            job.queue_position = self._get_queue_position(job_id)
        return job

    def get_all_jobs(self) -> List[ProcessingJob]:
        """
        Get all jobs with updated queue positions.

        Returns:
            List of all processing jobs
        """
        jobs = list(self._jobs.values())
        # Update queue positions for queued jobs
        for job in jobs:
            if job.status == JobStatus.QUEUED:
                job.queue_position = self._get_queue_position(job.job_id)
        return jobs

    def _get_queue_position(self, job_id: str) -> Optional[int]:
        """
        Get the current queue position for a job.

        Args:
            job_id: The job identifier

        Returns:
            Queue position (1-based) or None if not in queue
        """
        try:
            return self._job_queue.index(job_id) + 1
        except ValueError:
            return None

    def get_queue_status(self) -> Dict[str, Any]:
        """
        Get current queue status information.

        Returns:
            Dictionary with queue statistics
        """
        return {
            "queue_length": self.queue_length,
            "current_processing_job": self._current_processing_job,
            "is_processing": self.is_processing,
            "queued_jobs": [
                {
                    "job_id": job_id,
                    "position": idx + 1,
                    "created_at": (
                        self._jobs[job_id].created_at.isoformat()
                        if job_id in self._jobs
                        else None
                    ),
                }
                for idx, job_id in enumerate(self._job_queue)
            ],
        }

    async def register_websocket(self, websocket: WebSocket, job_id: str) -> str:
        """
        Register a WebSocket connection for job updates.

        Args:
            websocket: The WebSocket connection
            job_id: The job ID to subscribe to

        Returns:
            Connection ID
        """
        connection = WebSocketConnection(job_id=job_id)
        connection_id = connection.connection_id

        self._connections[connection_id] = websocket

        if job_id not in self._job_subscriptions:
            self._job_subscriptions[job_id] = set()
        self._job_subscriptions[job_id].add(connection_id)

        logger.info(f"Registered WebSocket {connection_id} for job {job_id}")
        return connection_id

    async def unregister_websocket(self, connection_id: str) -> None:
        """
        Unregister a WebSocket connection.

        Args:
            connection_id: The connection identifier
        """
        if connection_id in self._connections:
            del self._connections[connection_id]

            # Remove from job subscriptions
            for job_id, conn_ids in self._job_subscriptions.items():
                conn_ids.discard(connection_id)

            logger.info(f"Unregistered WebSocket {connection_id}")

    async def start_processing(self, job_id: str) -> None:
        """
        Deprecated: Jobs are now automatically queued and processed.
        This method is kept for backward compatibility.

        Args:
            job_id: The job identifier
        """
        logger.warning(
            f"start_processing called for job {job_id} - jobs are now automatically queued"
        )

    async def _process_queue(self) -> None:
        """
        Process jobs from the queue one at a time in FIFO order.
        """
        if self._queue_processor_running:
            return

        self._queue_processor_running = True
        logger.info("Started queue processor")

        try:
            while True:
                # Check if there are jobs to process
                if not self._job_queue or self._current_processing_job is not None:
                    # Wait for new jobs to be added to the queue
                    await self._queue_event.wait()
                    self._queue_event.clear()
                    continue

                # Get next job from queue
                job_id = self._job_queue.pop(0)  # FIFO - take from front
                job = self._jobs.get(job_id)

                if not job or job.status != JobStatus.QUEUED:
                    logger.warning(f"Skipping invalid job {job_id} from queue")
                    continue

                # Update queue positions for remaining jobs
                self._update_queue_positions()

                # Start processing this job
                self._current_processing_job = job_id
                job.status = JobStatus.PROCESSING
                job.started_at = datetime.now()

                logger.info(
                    f"Started processing job {job_id} (queue length: {len(self._job_queue)})"
                )

                # Send queue update to job
                await self._send_progress_update(
                    job_id, 0, "Started processing (removed from queue)"
                )

                # Process the job
                try:
                    await self._simulate_processing(job_id)
                except Exception as e:
                    logger.error(f"Error processing job {job_id}: {e}")
                    job.status = JobStatus.FAILED
                    job.error_message = str(e)
                finally:
                    self._current_processing_job = None
                    # Wake up processor to check for next job
                    self._queue_event.set()

        except Exception as e:
            logger.error(f"Queue processor error: {e}")
        finally:
            self._queue_processor_running = False
            logger.info("Queue processor stopped")

    def _update_queue_positions(self) -> None:
        """Update queue positions for all queued jobs."""
        for idx, job_id in enumerate(self._job_queue):
            if job_id in self._jobs:
                self._jobs[job_id].queue_position = idx + 1

    async def _simulate_processing(self, job_id: str) -> None:
        """
        Simulate photogrammetry processing with progress updates.

        Args:
            job_id: The job identifier
        """
        job = self.get_job(job_id)
        if not job:
            return

        try:
            # Simulate processing stages
            stages = [
                "Analyzing images",
                "Extracting features",
                "Matching features",
                "Bundle adjustment",
                "Dense reconstruction",
                "Mesh generation",
            ]

            num_stages = len(stages)
            steps_per_stage = 10

            for stage_idx, stage_name in enumerate(stages, 1):
                # Simulate stage processing with fixed steps
                for step in range(steps_per_stage + 1):
                    if job.status != JobStatus.PROCESSING:
                        return  # Job was cancelled or failed

                    # Calculate stage-specific progress (0-100% for each stage)
                    stage_percentage = (step / steps_per_stage) * 100

                    # Calculate overall job progress for the progress bar
                    overall_progress = ((stage_idx - 1) + (step / steps_per_stage)) * (
                        100 / num_stages
                    )
                    job.progress = int(overall_progress)

                    message = f"{stage_idx}/{num_stages} {stage_name}... {stage_percentage:.1f}%"
                    await self._send_progress_update(job_id, job.progress, message)

                    # Shorter delay for faster simulation
                    # nosec B311: Using random for simulation timing only
                    delay = random.uniform(0.05, 0.5)
                    await asyncio.sleep(delay)

            # Complete the job - update status FIRST before sending message
            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.now()
            job.progress = 100
            result_path = (
                f"output/backend/fake_backend/{job_id}/models/{job_id}_model.glb"
            )
            job.result_file_path = result_path

            # Send completion message AFTER the status is updated
            completion_msg = (
                f"Processing completed! Model saved to {job.result_file_path}"
            )
            await self._send_progress_update(job_id, 100, completion_msg)

            logger.info(f"Job {job_id} completed in {job.duration_seconds:.1f} seconds")

        except asyncio.CancelledError:
            job.status = JobStatus.FAILED
            job.error_message = "Processing was cancelled"
            logger.warning(f"Job {job_id} was cancelled")

        except Exception as e:
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            logger.error(f"Job {job_id} failed: {e}")

        finally:
            # No cleanup needed - queue processor handles job completion
            pass

    async def _send_progress_update(
        self, job_id: str, progress: int, message: str
    ) -> None:
        """
        Send the progress update to all subscribed WebSocket connections.

        Args:
            job_id: The job identifier
            progress: Progress percentage (0-100)
            message: Progress message
        """
        if job_id not in self._job_subscriptions:
            return

        update = ProgressUpdate(job_id=job_id, progress=progress, message=message)

        # Send it to all subscribed connections
        connection_ids = list(self._job_subscriptions[job_id])
        disconnected_connections = []

        for connection_id in connection_ids:
            if connection_id not in self._connections:
                disconnected_connections.append(connection_id)
                continue

            websocket = self._connections[connection_id]
            try:
                await websocket.send_text(update.model_dump_json())
                logger.debug(f"Sent progress update to {connection_id}: {progress}%")
            except Exception as e:
                logger.warning(f"Failed to send update to {connection_id}: {e}")
                disconnected_connections.append(connection_id)

        # Clean up disconnected connections
        for connection_id in disconnected_connections:
            await self.unregister_websocket(connection_id)

    async def cancel_job(self, job_id: str) -> bool:
        """
        Cancel a processing job.

        Args:
            job_id: The job identifier

        Returns:
            True if the job was canceled, False if not found or already completed
        """
        job = self.get_job(job_id)
        if not job or job.status in [JobStatus.COMPLETED, JobStatus.FAILED]:
            return False

        # Handle different cancellation scenarios
        if job.status == JobStatus.QUEUED:
            # Remove from queue
            try:
                self._job_queue.remove(job_id)
                self._update_queue_positions()
                logger.info(f"Removed job {job_id} from queue")
            except ValueError:
                logger.warning(f"Job {job_id} not found in queue")

        elif (
            job.status == JobStatus.PROCESSING
            and job_id == self._current_processing_job
        ):
            # Cancel the currently processing job
            # The processing task will handle the cancellation gracefully
            logger.info(f"Cancelling currently processing job {job_id}")

        job.status = JobStatus.FAILED
        job.error_message = "Cancelled by user"

        await self._send_progress_update(job_id, job.progress, "Job cancelled")
        logger.info(f"Cancelled job {job_id}")
        return True
