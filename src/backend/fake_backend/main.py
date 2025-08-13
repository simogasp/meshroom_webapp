#! /usr/bin/env python
"""
FastAPI backend server for fake photogrammetry processing.

This module provides the main server implementation with endpoints for
image upload, job management, and WebSocket communication for real-time
progress updates.
"""

import logging
import os
import sys
from datetime import datetime
from typing import List

# Add the parent directory to the path for imports when running directly
if __name__ == "__main__":
    sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

try:
    from .jobs import JobManager, generate_dummy_model
    from .models import ImageData, JobResponse, ProcessingJob, UploadRequest
except ImportError:
    # Handle direct execution
    from jobs import JobManager, generate_dummy_model
    from models import ImageData, JobResponse, ProcessingJob, UploadRequest


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Fake Photogrammetry Backend",
    description="Simulated photogrammetry processing backend for testing",
    version="0.1.0"
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

# Create directories for file storage
os.makedirs("uploads", exist_ok=True)
os.makedirs("models", exist_ok=True)


@app.on_event("startup")
async def startup_event():
    """Initialize application on startup."""
    logger.info("Starting Fake Photogrammetry Backend v0.1.0")
    logger.info(f"Upload directory: {os.path.abspath('uploads')}")
    logger.info(f"Models directory: {os.path.abspath('models')}")


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown."""
    logger.info("Shutting down Fake Photogrammetry Backend")


@app.get("/")
async def root():
    """
    Root endpoint with basic server information.

    Returns:
        Basic server status and information
    """
    return {
        "service": "Fake Photogrammetry Backend",
        "version": "0.1.0",
        "status": "running",
        "active_jobs": job_manager.active_jobs_count,
        "total_jobs": job_manager.total_jobs_count,
        "timestamp": datetime.now().isoformat()
    }


@app.get("/health")
async def health_check():
    """
    Health check endpoint.

    Returns:
        Service health status
    """
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }


@app.post("/upload", response_model=JobResponse)
async def upload_images(
    files: List[UploadFile] = File(...),
    quality: str = Form("medium"),
    max_features: int = Form(1000),
    enable_gpu: bool = Form(False)
):
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
            quality=quality,
            max_features=max_features,
            enable_gpu=enable_gpu
        )

        if not files:
            raise HTTPException(status_code=400, detail="No files provided")

        if len(files) > 100:
            raise HTTPException(
                status_code=400,
                detail="Too many files (maximum 100 allowed)"
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
                    status_code=400,
                    detail=f"File {file.filename} too large (max 50MB)"
                )

            # Create image data object
            image_data = ImageData(
                filename=file.filename,
                content=content,
                content_type=file.content_type or "application/octet-stream",
                size=file_size
            )
            images.append(image_data)

            logger.info(f"Uploaded {file.filename}: {file_size} bytes")

        # Check total upload size
        if total_size > 500 * 1024 * 1024:  # 500MB total
            raise HTTPException(
                status_code=400,
                detail="Total upload size too large (max 500MB)"
            )

        if not images:
            raise HTTPException(status_code=400, detail="No valid images provided")

        # Create the processing job
        job = ProcessingJob(
            images=images,
            parameters={
                "quality": request_data.quality,
                "max_features": request_data.max_features,
                "enable_gpu": request_data.enable_gpu
            }
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
            created_at=job.created_at.isoformat()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
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
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "total_images": job.total_images,
        "total_size_mb": round(job.total_size_mb, 2),
        "duration_seconds": job.duration_seconds,
        "error_message": job.error_message,
        "result_file_path": job.result_file_path
    }


@app.get("/jobs/{job_id}/download")
async def download_model(job_id: str):
    """
    Download the generated 3D model.

    Args:
        job_id: The job identifier

    Returns:
        The generated model file

    Raises:
        HTTPException: If the job was not found or not completed
    """
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not job.is_completed:
        raise HTTPException(
            status_code=400,
            detail=f"Job not completed (status: {job.status.value})"
        )

    # Generate the dummy model file
    model_data = generate_dummy_model(job_id)
    model_path = f"models/{job_id}_model.glb"

    # Save model to file
    with open(model_path, "wb") as f:
        f.write(model_data)

    logger.info(f"Generated dummy model for job {job_id}: {len(model_data)} bytes")

    return FileResponse(
        path=model_path,
        filename=f"{job_id}_model.glb",
        media_type="model/gltf-binary"
    )


@app.delete("/jobs/{job_id}")
async def cancel_job(job_id: str):
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
            status_code=400,
            detail="Job not found or cannot be cancelled"
        )

    return {"message": f"Job {job_id} cancelled successfully"}


@app.get("/jobs")
async def list_jobs():
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
            "total_size_mb": round(job.total_size_mb, 2)
        }
        for job in jobs
    ]


@app.websocket("/ws/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
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
        await websocket.send_text(f'{{"job_id": "{job_id}", "progress": {job.progress}, "message": "Connected to job {job_id}"}}')

        # Keep connection alive and handle messages
        while True:
            try:
                # Wait for messages (the client can send heartbeat or disconnect)
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

    # For production, bind to localhost only for security
    # For development/testing, use 0.0.0.0 only if explicitly needed
    host = "127.0.0.1"  # Changed from "0.0.0.0" for security

    uvicorn.run(
        "main:app",
        host=host,
        port=8000,
        reload=True,
        log_level="info"
    )
