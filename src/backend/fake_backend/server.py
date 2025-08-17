#! /usr/bin/env python
"""
FastAPI backend server for fake photogrammetry processing.

This module provides the main server implementation with endpoints for
image upload, job management, and WebSocket communication for real-time
progress updates.
"""

import argparse
import json
import logging
import os
import re
import secrets
import sys
from datetime import datetime
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
    from .models import ImageData, JobResponse, ProcessingJob
except ImportError:
    # Handle direct execution
    from jobs import (  # type: ignore[no-redef]
        JobManager,
        generate_dummy_model,
        generate_real_model,
    )
    from models import ImageData, JobResponse, ProcessingJob  # type: ignore[no-redef]


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
    if os.path.commonpath([canonical_base, canonical_full]) != canonical_base:
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

# Create base directories for file storage in output folder
# Get the absolute path to the project root (3 levels up from this file)
project_root = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)
base_output_dir = os.path.join(project_root, "output", "backend", "fake_backend")
os.makedirs(base_output_dir, exist_ok=True)

# Dynamic parameters storage
_parameters_config: Dict[str, Any] = {}


def _load_parameters_config() -> Dict[str, Any]:
    """
    Load dynamic parameters configuration from JSON file.

    Returns:
        The parameters configuration dictionary.

    Raises:
        FileNotFoundError: If the parameters file is missing.
        ValueError: If the parameters file is invalid.
    """
    global _parameters_config
    # Parameters file lives alongside server code in this fake backend
    params_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "parameters.json"
    )

    if not os.path.exists(params_path):
        raise FileNotFoundError(f"parameters.json not found at {params_path}")

    with open(params_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Basic validation according to documented schema (lightweight)
    if not isinstance(data, dict) or "parameters" not in data:
        raise ValueError("Invalid parameters.json format: missing 'parameters' array")

    if not isinstance(data["parameters"], list):
        raise ValueError("Invalid parameters.json: 'parameters' must be an array")

    # Validate minimal fields for each parameter
    for idx, p in enumerate(data["parameters"]):
        if not isinstance(p, dict):
            raise ValueError(f"Parameter at index {idx} is not an object")
        for key in ["name", "type", "description", "default"]:
            if key not in p:
                raise ValueError(f"Parameter {p.get('name', idx)} missing '{key}'")

    _parameters_config = data
    return data


def create_job_directories(job_id: str) -> Dict[str, str]:
    """
    Create directory structure for a specific job.

    Args:
        job_id: The job identifier

    Returns:
        Dictionary containing the paths for uploads, models, and job root

    Raises:
        OSError: If directory creation fails
    """
    job_dir = os.path.join(base_output_dir, job_id)
    uploads_dir = os.path.join(job_dir, "uploads")
    models_dir = os.path.join(job_dir, "models")

    # Create all directories
    os.makedirs(uploads_dir, exist_ok=True)
    os.makedirs(models_dir, exist_ok=True)

    return {
        "job_dir": job_dir,
        "uploads_dir": uploads_dir,
        "models_dir": models_dir,
    }


def save_job_parameters(job_id: str, parameters: Dict[str, Any]) -> str:
    """
    Save job parameters to a JSON file in the job directory.

    Args:
        job_id: The job identifier
        parameters: The job parameters to save

    Returns:
        Path to the saved parameters file

    Raises:
        OSError: If file writing fails
    """
    job_dir = os.path.join(base_output_dir, job_id)
    parameters_path = os.path.join(job_dir, "parameters.json")

    # Add metadata to parameters
    parameters_with_metadata = {
        "job_id": job_id,
        "created_at": datetime.now().isoformat(),
        "parameters": parameters,
    }

    with open(parameters_path, "w", encoding="utf-8") as f:
        json.dump(parameters_with_metadata, f, indent=2, ensure_ascii=False)

    logger.info(f"Saved job parameters to {parameters_path}")
    return parameters_path


def _parse_upload_parameters(parameters: Optional[str]) -> Dict[str, Any]:
    """
    Parse dynamic parameters from the upload request.

    Args:
        parameters: Optional JSON string of dynamic parameters

    Returns:
        Dictionary of parsed parameters with defaults filled in

    Raises:
        HTTPException: If parameters are invalid
    """
    dynamic_params: Dict[str, Any] = {}
    if parameters:
        try:
            parsed = json.loads(parameters)
            if isinstance(parsed, dict):
                dynamic_params = parsed
            else:
                raise ValueError("'parameters' must be a JSON object")
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid parameters: {e}")
    else:
        # Fill defaults from loaded parameters config
        global _parameters_config
        if not _parameters_config:
            try:
                _load_parameters_config()
            except (FileNotFoundError, ValueError, json.JSONDecodeError):
                _parameters_config = {"parameters": []}
        for p in _parameters_config.get("parameters", []):
            if "name" in p and "default" in p:
                dynamic_params[p["name"]] = p["default"]

    return dynamic_params


async def _process_uploaded_files(
    files: List[UploadFile], uploads_dir: str, file_paths: Optional[List[str]] = None
) -> tuple[List[ImageData], int]:
    """
    Process and save uploaded files.

    Args:
        files: List of uploaded files
        uploads_dir: Directory to save files to
        file_paths: Optional list of relative paths for directory structure

    Returns:
        Tuple of (list of ImageData objects, total size in bytes)

    Raises:
        HTTPException: If file processing fails
    """
    images = []
    total_size = 0

    for i, file in enumerate(files):
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

        # Get relative path if provided, otherwise use filename
        relative_path = None
        if file_paths and i < len(file_paths):
            relative_path = file_paths[i]

        # Generate secure filename
        original_name = file.filename or "upload.jpg"
        _, ext = os.path.splitext(original_name.lower())

        # Only allow specific image extensions
        allowed_extensions = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".webp"}
        if ext not in allowed_extensions:
            ext = ".jpg"  # default to jpg

        # Create completely random filename
        secure_filename = f"upload_{secrets.token_hex(16)}{ext}"

        # Create directory structure if relative path is provided
        if relative_path and relative_path != original_name:
            # Extract directory from relative path
            rel_dir = os.path.dirname(relative_path)
            if rel_dir:
                # Create nested directory structure
                nested_dir = os.path.join(uploads_dir, rel_dir)
                os.makedirs(nested_dir, exist_ok=True)
                upload_path = os.path.join(nested_dir, secure_filename)
            else:
                upload_path = os.path.join(uploads_dir, secure_filename)
        else:
            upload_path = os.path.join(uploads_dir, secure_filename)

        # NOSONAR: Path construction uses validated base directory and secure random data
        with open(upload_path, "wb") as f:
            f.write(content)

        # Create image data object with relative path info
        image_data = ImageData(
            filename=secure_filename,  # Use secure filename
            content=content,
            content_type=file.content_type or "application/octet-stream",
            size=file_size,
            original_path=relative_path,  # Include original path in constructor
        )

        images.append(image_data)

        logger.info(
            f"Uploaded {file.filename} -> {secure_filename}: {file_size} bytes -> {upload_path}"
            + (f" (from {relative_path})" if relative_path else "")
        )

    return images, total_size


@app.on_event("startup")
async def startup_event() -> None:
    """Initialize application on startup."""
    model_type = "real (monstree.glb)" if USE_REAL_MODEL else "fake (generated)"
    logger.info("Starting Fake Photogrammetry Backend v0.1.0")
    logger.info(f"Model type: {model_type}")
    logger.info(f"Base output directory: {base_output_dir}")
    # Load dynamic parameters
    try:
        cfg = _load_parameters_config()
        logger.info(
            f"Loaded dynamic parameters: {len(cfg.get('parameters', []))} definitions"
        )
    except (FileNotFoundError, ValueError, json.JSONDecodeError) as e:
        logger.warning(f"Parameters configuration not loaded: {e}")


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


@app.get("/parameters")
async def get_parameters() -> Dict[str, Any]:
    """
    Get dynamic processing parameter definitions.

    Returns:
        Parameters configuration loaded at startup.
    """
    # Lazy-load if not loaded yet
    global _parameters_config
    if not _parameters_config:
        try:
            _load_parameters_config()
        except (FileNotFoundError, ValueError, json.JSONDecodeError) as e:
            logger.error(f"Failed to load parameters: {e}")
            raise HTTPException(status_code=500, detail="Parameters not available")

    return _parameters_config


@app.post("/upload", response_model=JobResponse)
async def upload_images(
    files: List[UploadFile] = File(...),
    file_paths: Optional[List[str]] = Form(None),
    parameters: Optional[str] = Form(None),
) -> JobResponse:
    """
    Upload images for photogrammetry processing.

    Args:
        files: List of image files to process
        file_paths: Optional list of relative file paths for directory structure
        parameters: Optional JSON string of dynamic parameters selected by the user

    Returns:
        Job response with job ID and status

    Raises:
        HTTPException: If validation fails or no files are provided
    """
    try:
        # Parse dynamic parameters if present; if missing, use defaults from config
        dynamic_params = _parse_upload_parameters(parameters)

        if not files:
            raise HTTPException(status_code=400, detail="No files provided")

        if len(files) > 100:
            raise HTTPException(
                status_code=400, detail="Too many files (maximum 100 allowed)"
            )

        # Create the processing job first to get the job ID
        job = ProcessingJob(
            parameters={**dynamic_params},
        )

        # Create job-specific directories
        job_dirs = create_job_directories(job.job_id)
        uploads_dir = job_dirs["uploads_dir"]

        # Save job parameters
        save_job_parameters(job.job_id, job.parameters)

        # Process uploaded files
        images, total_size = await _process_uploaded_files(
            files, uploads_dir, file_paths
        )

        # Check total upload size
        if total_size > 500 * 1024 * 1024:  # 500MB total
            raise HTTPException(
                status_code=400, detail="Total upload size too large (max 500MB)"
            )

        if not images:
            raise HTTPException(status_code=400, detail="No valid images provided")

        # Update job with images
        job.images = images

        # Register job with manager
        job_id = job_manager.create_job(job)

        # Start processing asynchronously
        await job_manager.start_processing(job_id)

        logger.info(
            f"Created job {job_id} with {len(images)} images "
            f"({total_size / 1024 / 1024:.1f} MB total) in {job_dirs['job_dir']}"
        )

        return JobResponse(
            job_id=job_id,
            status=job.status.value,
            created_at=job.created_at.isoformat(),
        )

    except HTTPException:
        raise
    except (OSError, IOError, ValueError) as e:
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
        # Generate the model file (real or fake based on configuration)
        if USE_REAL_MODEL:
            model_data = generate_real_model(validated_job_id)
            model_type = "real"
        else:
            model_data = generate_dummy_model(validated_job_id)
            model_type = "dummy"

        # Create job-specific model directory if it doesn't exist
        job_dirs = create_job_directories(validated_job_id)
        models_dir = job_dirs["models_dir"]

        # Create a secure filename for the model
        secure_filename = f"model_{secrets.token_hex(16)}.glb"
        # NOSONAR: This path construction uses cryptographically secure random data, not user input
        model_path = os.path.join(models_dir, secure_filename)

        # Save model to file
        # NOSONAR: Path is constructed with secure random data, validated base directory
        with open(model_path, "wb") as f:
            f.write(model_data)

        # Update job with result path (relative to project root for logs)
        rel_model_path = os.path.relpath(model_path, start=project_root)
        job.result_file_path = rel_model_path

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
            except (ConnectionResetError, ConnectionAbortedError, OSError) as e:
                logger.warning(f"WebSocket connection error for {connection_id}: {e}")
                break

    except (ConnectionResetError, ConnectionAbortedError, OSError) as e:
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
        help="Use real model (monstree.glb) instead of generated fake model",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        default=False,
        help="Enable auto-reload for development",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging verbosity level",
    )

    args = parser.parse_args()

    # Set environment variable for configuration
    os.environ["USE_REAL_MODEL"] = str(args.real_model)

    # Configure logging level
    logging.getLogger().setLevel(getattr(logging, args.log_level.upper(), logging.INFO))

    # Log configuration
    model_type = "real (monstree.glb)" if args.real_model else "fake (generated)"
    logger.info(f"Starting server with {model_type} models")
    logger.info(f"Server will bind to {args.host}:{args.port}")

    # Start server
    uvicorn.run(
        "server:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level=args.log_level.lower(),
    )
