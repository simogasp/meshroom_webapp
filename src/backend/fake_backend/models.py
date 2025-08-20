"""
Data models and structures for the fake photogrammetry backend.

This module contains Pydantic models for request validation and dataclasses
for internal data representation used in the fake backend simulation.
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class JobStatus(Enum):
    """Job processing status enumeration."""

    QUEUED = "queued"
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class JobResponse(BaseModel):
    """Response model for job creation."""

    job_id: str = Field(description="Unique job identifier")
    status: str = Field(description="Current job status")
    created_at: str = Field(description="Job creation timestamp")


class ProgressUpdate(BaseModel):
    """WebSocket progress update message."""

    job_id: str = Field(description="Job identifier")
    progress: int = Field(description="Progress percentage (0-100)", ge=0, le=100)
    message: str = Field(description="Progress status message")


@dataclass
class ImageData:
    """Represents an uploaded image with metadata."""

    filename: str
    content: bytes
    content_type: str
    size: int
    original_path: Optional[str] = None  # For directory structure preservation
    upload_time: datetime = field(default_factory=datetime.now)

    @property
    def size_mb(self) -> float:
        """Get image size in megabytes."""
        return self.size / (1024 * 1024)


@dataclass
class ProcessingJob:
    """Represents a photogrammetry processing job."""

    job_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    status: JobStatus = JobStatus.QUEUED
    images: List[ImageData] = field(default_factory=list)
    parameters: Dict[str, Any] = field(default_factory=dict)
    progress: int = 0
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    result_file_path: Optional[str] = None
    queue_position: Optional[int] = None

    @property
    def total_images(self) -> int:
        """Get total number of images in the job."""
        return len(self.images)

    @property
    def total_size_mb(self) -> float:
        """Get total size of all images in megabytes."""
        return sum(image.size_mb for image in self.images)

    @property
    def is_completed(self) -> bool:
        """Check if the job has completed processing."""
        return self.status == JobStatus.COMPLETED

    @property
    def is_failed(self) -> bool:
        """Check if the job has failed."""
        return self.status == JobStatus.FAILED

    @property
    def is_queued(self) -> bool:
        """Check if the job is queued."""
        return self.status == JobStatus.QUEUED

    @property
    def is_processing(self) -> bool:
        """Check if the job is currently processing."""
        return self.status == JobStatus.PROCESSING

    @property
    def duration_seconds(self) -> Optional[float]:
        """Get job duration in seconds if completed."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None


@dataclass
class WebSocketConnection:
    """Represents an active WebSocket connection."""

    connection_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    job_id: Optional[str] = None
    connected_at: datetime = field(default_factory=datetime.now)
    last_message_at: Optional[datetime] = None

    @property
    def is_subscribed(self) -> bool:
        """Check if connection is subscribed to a job."""
        return self.job_id is not None
