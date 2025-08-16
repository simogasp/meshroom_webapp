#! /usr/bin/env python
"""
FastAPI backend server for fake photogrammetry processing.

This module provides the main server implementation with endpoints for
image upload, job management, and WebSocket communication for real-time
progress updates.
"""

import argparse
import logging
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

# Add the parent directory to the path for imports when running directly
if __name__ == "__main__":
    sys.path.append(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    )

from fastapi import (
    FastAPI,
    File,
    Form,
    HTTPException,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

try:
    from .jobs import JobManager, generate_dummy_model, generate_real_model
    from .models import ImageData, JobResponse, ProcessingJob, UploadRequest
except ImportError:
    # Handle direct execution
    from jobs import (  # type: ignore[no-redef]
        JobManager,
        generate_dummy_model,
        generate_real_model,
    )
    from models import (  # type: ignore[no-redef]
        ImageData,
        JobResponse,
        ProcessingJob,
        UploadRequest,
    )


# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename to prevent path traversal attacks.

    Args:
        filename: The original filename

    Returns:
        A sanitized filename safe for filesystem operations

    Raises:
        ValueError: If the filename is invalid or potentially malicious
    """
    if not filename:
        raise ValueError("Filename cannot be empty")

    # Remove any directory components and path separators
    safe_name = os.path.basename(filename)

    # Remove any remaining path traversal attempts
    safe_name = safe_name.replace("..", "")
    safe_name = safe_name.replace("/", "")
    safe_name = safe_name.replace("\\", "")

    # Only allow alphanumeric characters, dots, hyphens, and underscores
    safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", safe_name)

    # Ensure the filename doesn't start with a dot (hidden file)
    if safe_name.startswith("."):
        safe_name = "file_" + safe_name

    # Ensure minimum length
    if len(safe_name) < 1:
        raise ValueError("Filename results in empty string after sanitization")

    # Limit length to reasonable size
    if len(safe_name) > 255:
        name, ext = os.path.splitext(safe_name)
        safe_name = name[: 255 - len(ext)] + ext

    return safe_name


def validate_job_id(job_id: str) -> str:
    """
    Validate and sanitize a job ID to prevent path traversal attacks.

    Args:
        job_id: The job identifier

    Returns:
        A validated job ID safe for filesystem operations

    Raises:
        ValueError: If the job ID is invalid or potentially malicious
    """
    if not job_id:
        raise ValueError("Job ID cannot be empty")

    # Job IDs should be UUID-like strings - only allow alphanumeric and hyphens
    if not re.match(r"^[a-zA-Z0-9-]+$", job_id):
        raise ValueError("Job ID contains invalid characters")

    # Limit length
    if len(job_id) > 100:
        raise ValueError("Job ID is too long")

    # Prevent path traversal attempts
    if ".." in job_id or "/" in job_id or "\\" in job_id:
        raise ValueError("Job ID contains path traversal sequences")

    return job_id


def safe_join(
    base_dir: str, filename: str, sanitize_func: Optional[Callable[[str], str]] = None
) -> str:
    """
    Safely join a base directory with a filename, preventing path traversal.

    Args:
        base_dir: The base directory path
        filename: The filename to join
        sanitize_func: Optional function to sanitize the filename

    Returns:
        A safe path within the base directory

    Raises:
        ValueError: If the resulting path would escape the base directory
    """
    if sanitize_func:
        filename = sanitize_func(filename)

    # Create the full path
    full_path = os.path.join(base_dir, filename)

    # Get the canonical (absolute) paths to prevent traversal
    canonical_base = os.path.realpath(base_dir)
    canonical_full = os.path.realpath(full_path)

    # Ensure the full path is within the base directory
    if not canonical_full.startswith(canonical_base + os.sep):
        raise ValueError(f"Path traversal detected: {filename}")

    return full_path


# Global configuration for model generation (set by command line args)
USE_REAL_MODEL = os.getenv("USE_REAL_MODEL", "false").lower() == "true"

# Initialize FastAPI app
app = FastAPI(
    title="Fake Photogrammetry Backend",
    description="Simulated photogrammetry processing backend for testing",
    version="0.1.0",
)

# Add CORS middleware for web frontend compatibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize job manager
job_manager = JobManager()

# Create directories for file storage in output folder
# Get the absolute path to the project root (3 levels up from this file)
project_root = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)
uploads_dir = os.path.join(project_root, "output", "backend", "fake_backend", "uploads")
models_dir = os.path.join(project_root, "output", "backend", "fake_backend", "models")

os.makedirs(uploads_dir, exist_ok=True)
os.makedirs(models_dir, exist_ok=True)


@app.on_event("startup")
async def startup_event() -> None:
    """Initialize application on startup."""
    model_type = "real (avocado.glb)" if USE_REAL_MODEL else "fake (generated)"
    logger.info("Starting Fake Photogrammetry Backend v0.1.0")
    logger.info(f"Model type: {model_type}")
    logger.info(f"Upload directory: {uploads_dir}")
    logger.info(f"Models directory: {models_dir}")


@app.on_event("shutdown")
async def shutdown_event() -> None:
    """Clean up resources on shutdown."""
    logger.info("Shutting down Fake Photogrammetry Backend")


@app.get("/")
async def root() -> Dict[str, Any]:
    """
    Root endpoint with basic server information.

    Returns:
        Basic server status and information
    """
    return {
        "service": "Fake Photogrammetry Backend",
        "version": "0.1.0",
        "status": "running",
        "model_type": "real" if USE_REAL_MODEL else "fake",
        "active_jobs": job_manager.active_jobs_count,
        "total_jobs": job_manager.total_jobs_count,
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/health")
async def health_check() -> Dict[str, str]:
    """
    Health check endpoint.

    Returns:
        Service health status
    """
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.post("/upload", response_model=JobResponse)
async def upload_images(
    files: List[UploadFile] = File(...),
    quality: str = Form("medium"),
    max_features: int = Form(1000),
    enable_gpu: bool = Form(False),
) -> JobResponse:
    """
    Upload images for photogrammetry processing.

    Args:
        files: List of image files to process
        quality: Processing quality level (low, medium, high)
        max_features: Maximum number of features to extract
        enable_gpu: Whether to enable GPU acceleration

    Returns:
        Job response with job ID and status

    Raises:
        HTTPException: If validation fails or no files are provided
    """
    try:
        # Validate request parameters
        request_data = UploadRequest(
            quality=quality, max_features=max_features, enable_gpu=enable_gpu
        )

        if not files:
            raise HTTPException(status_code=400, detail="No files provided")

        if len(files) > 100:
            raise HTTPException(
                status_code=400, detail="Too many files (maximum 100 allowed)"
            )

        # Process uploaded files
        images = []
        total_size = 0

        for file in files:
            if not file.filename:
                continue

            # Read file content
            content = await file.read()
            file_size = len(content)
            total_size += file_size

            # Check file size limits
            if file_size > 50 * 1024 * 1024:  # 50MB per file
                raise HTTPException(
                    status_code=400, detail=f"File {file.filename} too large (max 50MB)"
                )

            # Generate a completely secure filename without any user-controlled data
            import secrets

            # Get file extension safely from original filename
            original_name = file.filename or "upload.jpg"
            _, ext = os.path.splitext(original_name.lower())

            # Only allow specific image extensions
            allowed_extensions = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".webp"}
            if ext not in allowed_extensions:
                ext = ".jpg"  # default to jpg

            # Create completely random filename
            secure_filename = f"upload_{secrets.token_hex(16)}{ext}"

            # NOSONAR: Path construction uses cryptographically secure random data, not user input
            upload_path = uploads_dir + os.sep + secure_filename

            # NOSONAR: Path is constructed with secure random data, validated base directory
            with open(upload_path, "wb") as f:
                f.write(content)

            # Create image data object
            image_data = ImageData(
                filename=secure_filename,  # Use secure filename
                content=content,
                content_type=file.content_type or "application/octet-stream",
                size=file_size,
            )
            images.append(image_data)

            logger.info(
                f"Uploaded {file.filename} -> {secure_filename}: {file_size} bytes -> {upload_path}"
            )

        # Check total upload size
        if total_size > 500 * 1024 * 1024:  # 500MB total
            raise HTTPException(
                status_code=400, detail="Total upload size too large (max 500MB)"
            )

        if not images:
            raise HTTPException(status_code=400, detail="No valid images provided")

        # Create the processing job
        job = ProcessingJob(
            images=images,
            parameters={
                "quality": request_data.quality,
                "max_features": request_data.max_features,
                "enable_gpu": request_data.enable_gpu,
            },
        )

        # Register job with manager
        job_id = job_manager.create_job(job)

        # Start processing asynchronously
        await job_manager.start_processing(job_id)

        logger.info(
            f"Created job {job_id} with {len(images)} images "
            f"({total_size / 1024 / 1024:.1f} MB total)"
        )

        return JobResponse(
            job_id=job_id,
            status=job.status.value,
            created_at=job.created_at.isoformat(),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/jobs/{job_id}")
async def get_job_status(job_id: str) -> Dict[str, Any]:
    """
    Get job status and information.

    Args:
        job_id: The job identifier

    Returns:
        Job status information

    Raises:
        HTTPException: If the job is not found
    """
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "job_id": job.job_id,
        "status": job.status.value,
        "progress": job.progress,
        "created_at": job.created_at.isoformat(),
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": (job.completed_at.isoformat() if job.completed_at else None),
        "total_images": job.total_images,
        "total_size_mb": round(job.total_size_mb, 2),
        "duration_seconds": job.duration_seconds,
        "error_message": job.error_message,
        "result_file_path": job.result_file_path,
    }


@app.get("/jobs/{job_id}/download")
async def download_model(job_id: str) -> FileResponse:
    """
    Download the generated 3D model.

    Args:
        job_id: The job identifier

    Returns:
        The generated model file

    Raises:
        HTTPException: If the job was not found or not completed
    """
    # Validate job_id immediately to prevent any security issues
    try:
        validated_job_id = validate_job_id(job_id)
    except ValueError as e:
        logger.warning(f"Invalid job ID rejected: {job_id} - {e}")
        raise HTTPException(status_code=400, detail=f"Invalid job ID: {e}")

    job = job_manager.get_job(validated_job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not job.is_completed:
        raise HTTPException(
            status_code=400, detail=f"Job not completed (status: {job.status.value})"
        )

    try:
        # Validate job_id for security
        try:
            validated_job_id = validate_job_id(job_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid job ID: {e}")

        # Generate the model file (real or fake based on configuration)
        if USE_REAL_MODEL:
            model_data = generate_real_model(validated_job_id)
            model_type = "real"
        else:
            model_data = generate_dummy_model(validated_job_id)
            model_type = "dummy"

        # Instead of using any user-controlled data in paths, use a secure lookup approach
        # Generate a cryptographically secure filename that doesn't depend on user input
        import secrets
        import tempfile

        # Create a secure temporary filename
        secure_filename = f"model_{secrets.token_hex(16)}.glb"
        # NOSONAR: This path construction uses cryptographically secure random data, not user input
        model_path = models_dir + os.sep + secure_filename

        # Note: In production, store the filename mapping in database
        # For this demo, we rely on the job_id being properly validated above

        # Save model to file
        # NOSONAR: Path is constructed with secure random data, validated base directory
        with open(model_path, "wb") as f:
            f.write(model_data)

        logger.info(
            f"Generated {model_type} model for job {validated_job_id}: {len(model_data)} bytes -> "
            f"{model_path}"
        )

        return FileResponse(
            path=model_path,
            filename=secure_filename,
            media_type="model/gltf-binary",
        )

    except FileNotFoundError as e:
        logger.error(f"Model generation failed for job {job_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Real model file not found. Server may be misconfigured.",
        )
    except IOError as e:
        logger.error(f"Model file I/O error for job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Error reading model file.")
    except ValueError as e:
        # This catches our validation errors which are already handled above
        # But we include it here for completeness
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/jobs/{job_id}")
async def cancel_job(job_id: str) -> Dict[str, str]:
    """
    Cancel a processing job.

    Args:
        job_id: The job identifier

    Returns:
        Cancellation status

    Raises:
        HTTPException: If the job was not found
    """
    success = await job_manager.cancel_job(job_id)
    if not success:
        raise HTTPException(
            status_code=400, detail="Job not found or cannot be cancelled"
        )

    return {"message": f"Job {job_id} cancelled successfully"}


@app.get("/jobs")
async def list_jobs() -> List[Dict[str, Any]]:
    """
    List all jobs with their status.

    Returns:
        List of all jobs with basic information
    """
    jobs = job_manager.get_all_jobs()
    return [
        {
            "job_id": job.job_id,
            "status": job.status.value,
            "progress": job.progress,
            "created_at": job.created_at.isoformat(),
            "total_images": job.total_images,
            "total_size_mb": round(job.total_size_mb, 2),
        }
        for job in jobs
    ]


@app.websocket("/ws/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str) -> None:
    """
    WebSocket endpoint for real-time job progress updates.

    Args:
        websocket: The WebSocket connection
        job_id: The job identifier to subscribe to
    """
    await websocket.accept()
    connection_id = None

    try:
        # Check if the job exists
        job = job_manager.get_job(job_id)
        if not job:
            await websocket.send_text('{"error": "Job not found"}')
            await websocket.close(code=4004)
            return

        # Register WebSocket connection
        connection_id = await job_manager.register_websocket(websocket, job_id)
        logger.info(f"WebSocket connected for job {job_id}: {connection_id}")

        # Send initial status
        initial_msg = (
            f'{{"job_id": "{job_id}", "progress": {job.progress}, '
            f'"message": "Connected to job {job_id}"}}'
        )
        await websocket.send_text(initial_msg)

        # Keep connection alive and handle messages
        while True:
            try:
                # Wait for messages (client can send heartbeat or disconnect)
                message = await websocket.receive_text()
                logger.debug(f"Received WebSocket message: {message}")

                # Echo back for heartbeat
                if message == "ping":
                    await websocket.send_text("pong")

            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.warning(f"WebSocket error for {connection_id}: {e}")
                break

    except Exception as e:
        logger.error(f"WebSocket connection failed: {e}")

    finally:
        if connection_id:
            await job_manager.unregister_websocket(connection_id)
            logger.info(f"WebSocket disconnected: {connection_id}")


if __name__ == "__main__":
    import uvicorn

    # Parse command line arguments
    parser = argparse.ArgumentParser(
        description="Fake Photogrammetry Backend Server",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--host", type=str, default="127.0.0.1", help="Host to bind the server to"
    )
    parser.add_argument(
        "--port", type=int, default=8000, help="Port to bind the server to"
    )
    parser.add_argument(
        "--real-model",
        action="store_true",
        help="Use real model (avocado.glb) instead of generated fake model",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        default=False,
        help="Enable auto-reload for development",
    )

    args = parser.parse_args()

    # Set environment variable for configuration
    os.environ["USE_REAL_MODEL"] = str(args.real_model)

    # Update global configuration
    globals()["USE_REAL_MODEL"] = args.real_model

    # Log configuration
    model_type = "real (avocado.glb)" if args.real_model else "fake (generated)"
    logger.info(f"Starting server with {model_type} models")
    logger.info(f"Server will bind to {args.host}:{args.port}")

    # Start server
    uvicorn.run(
        "server:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info",
    )
