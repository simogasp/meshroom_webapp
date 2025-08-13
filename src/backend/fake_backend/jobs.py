"""
Job manager for simulating photogrammetry processing.

This module handles job lifecycle management, progress simulation,
and WebSocket communication for the fake backend.
"""

import asyncio
import logging
import random
from datetime import datetime
from typing import Dict, List, Optional, Set

from fastapi import WebSocket

try:
    from .models import JobStatus, ProcessingJob, ProgressUpdate, WebSocketConnection
except ImportError:
    # Handle direct execution
    from models import JobStatus, ProcessingJob, ProgressUpdate, WebSocketConnection


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
    metadata = f"Generated for job: {job_id}".encode('utf-8')

    return header + len(metadata).to_bytes(4, 'little') + metadata + model_data


class JobManager:
    """
    Manages processing jobs and WebSocket connections.

    Simulates photogrammetry processing with random progress updates
    and manages real-time communication with clients.
    """

    def __init__(self):
        """Initialize the job manager."""
        self._jobs: Dict[str, ProcessingJob] = {}
        self._connections: Dict[str, WebSocket] = {}
        self._job_subscriptions: Dict[str, Set[str]] = {}  # job_id -> connection_ids
        self._processing_tasks: Dict[str, asyncio.Task] = {}

    @property
    def active_jobs_count(self) -> int:
        """Get count of active (non-completed) jobs."""
        return sum(
            1 for job in self._jobs.values()
            if job.status in [JobStatus.PENDING, JobStatus.PROCESSING]
        )

    @property
    def total_jobs_count(self) -> int:
        """Get the total count of all jobs."""
        return len(self._jobs)

    def create_job(self, job: ProcessingJob) -> str:
        """
        Create a new processing job.

        Args:
            job: The processing job to create

        Returns:
            The job ID
        """
        self._jobs[job.job_id] = job
        logger.info(f"Created job {job.job_id} with {job.total_images} images")
        return job.job_id

    def get_job(self, job_id: str) -> Optional[ProcessingJob]:
        """
        Get a job by ID.

        Args:
            job_id: The job identifier

        Returns:
            The processing job or None if not found
        """
        return self._jobs.get(job_id)

    def get_all_jobs(self) -> List[ProcessingJob]:
        """
        Get all jobs.

        Returns:
            List of all processing jobs
        """
        return list(self._jobs.values())

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

    async def unregister_websocket(self, connection_id: str):
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

    async def start_processing(self, job_id: str):
        """
        Start processing a job asynchronously.

        Args:
            job_id: The job identifier
        """
        job = self.get_job(job_id)
        if not job:
            logger.error(f"Job {job_id} not found")
            return

        if job_id in self._processing_tasks:
            logger.warning(f"Job {job_id} is already being processed")
            return

        job.status = JobStatus.PROCESSING
        job.started_at = datetime.now()

        # Start processing task
        task = asyncio.create_task(self._simulate_processing(job_id))
        self._processing_tasks[job_id] = task

        logger.info(f"Started processing job {job_id}")

    async def _simulate_processing(self, job_id: str):
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
                ("Analyzing images", 0, 20),
                ("Extracting features", 20, 45),
                ("Matching features", 45, 65),
                ("Bundle adjustment", 65, 80),
                ("Dense reconstruction", 80, 95),
                ("Mesh generation", 95, 100)
            ]

            for stage_name, start_progress, end_progress in stages:
                # Simulate stage processing
                # nosec B311: Using random for simulation purposes only, not cryptographic
                steps = random.randint(3, 8)
                for step in range(steps + 1):
                    if job.status != JobStatus.PROCESSING:
                        return  # Job was cancelled or failed

                    progress = start_progress + (end_progress - start_progress) * (step / steps)
                    job.progress = int(progress)

                    message = f"{stage_name}... {progress:.1f}%"
                    await self._send_progress_update(job_id, job.progress, message)

                    # Random delay to simulate processing time
                    # nosec B311: Using random for simulation timing only, not cryptographic
                    delay = random.uniform(0.5, 2.0)
                    await asyncio.sleep(delay)

            # Complete the job - update status FIRST before sending the final message
            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.now()
            job.progress = 100
            job.result_file_path = f"output/backend/fake_backend/models/{job_id}_model.glb"

            # Send completion message AFTER the status is updated
            await self._send_progress_update(
                job_id,
                100,
                f"Processing completed! Model saved to {job.result_file_path}"
            )

            logger.info(
                f"Job {job_id} completed in {job.duration_seconds:.1f} seconds"
            )

        except asyncio.CancelledError:
            job.status = JobStatus.FAILED
            job.error_message = "Processing was cancelled"
            logger.warning(f"Job {job_id} was cancelled")

        except Exception as e:
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            logger.error(f"Job {job_id} failed: {e}")

        finally:
            # Clean up processing task
            if job_id in self._processing_tasks:
                del self._processing_tasks[job_id]

    async def _send_progress_update(self, job_id: str, progress: int, message: str):
        """
        Send the progress update to all subscribed WebSocket connections.

        Args:
            job_id: The job identifier
            progress: Progress percentage (0-100)
            message: Progress message
        """
        if job_id not in self._job_subscriptions:
            return

        update = ProgressUpdate(
            job_id=job_id,
            progress=progress,
            message=message
        )

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

        # Cancel processing task
        if job_id in self._processing_tasks:
            self._processing_tasks[job_id].cancel()

        job.status = JobStatus.FAILED
        job.error_message = "Cancelled by user"

        await self._send_progress_update(job_id, job.progress, "Job cancelled")
        logger.info(f"Cancelled job {job_id}")
        return True
