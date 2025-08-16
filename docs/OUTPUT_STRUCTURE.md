# Output Directory Structure

This document describes the job-specific output directory structure for the fake photogrammetry backend and frontend.

## Directory Structure

All data exchanged between the fake backend and frontend is now stored in job-specific organized output directories:

```text
project_root/
├── output/
│   ├── backend/
│   │   └── fake_backend/
│   │       └── {job_id}/           # Job-specific directory
│   │           ├── uploads/        # Uploaded image files for this job
│   │           ├── models/         # Generated 3D model files (.glb) for this job
│   │           └── parameters.json # Job parameters and metadata
│   └── frontend/
│       └── fake_frontend/
│           └── downloads/          # Downloaded model files from backend
└── src/
    ├── backend/
    │   └── fake_backend/           # Backend source code
    └── frontend/
        └── fake_frontend/          # Frontend client source code
```

## Changes Made

### Backend (`src/backend/fake_backend/server.py`)

1. **Job-Specific Directory Configuration**: Modified to use job-specific output directories
   - Each job gets its own folder: `output/backend/fake_backend/{job_id}/`
   - Uploads: `output/backend/fake_backend/{job_id}/uploads/`
   - Models: `output/backend/fake_backend/{job_id}/models/`
   - Parameters: `output/backend/fake_backend/{job_id}/parameters.json`

2. **New Functions**:
   - `create_job_directories(job_id)`: Creates the complete directory structure for a job
   - `save_job_parameters(job_id, parameters)`: Saves job parameters as JSON with metadata

3. **File Handling**:
   - Images uploaded via `/upload` endpoint are saved to the job-specific uploads directory
   - Generated models are saved to the job-specific models directory
   - Job parameters are automatically saved when a job is created
   - Full path logging for better traceability

4. **Path Calculation**: Automatic project root detection using relative paths from the source file

### Job Manager (`src/backend/fake_backend/jobs.py`)

1. **Result Path**: Updated to reflect the new job-specific models directory structure in job completion messages
   - Path format: `output/backend/fake_backend/{job_id}/models/{job_id}_model.glb`

### Frontend Client (`src/frontend/fake_frontend/client.py`)

1. **Download Directory**: Continues to use organized output directory
   - Downloads: `output/frontend/fake_frontend/downloads/`

2. **Automatic Path Detection**: The client automatically calculates the correct project root and uses the appropriate output directory

## Benefits

1. **Job Isolation**: Each job has its own isolated directory structure
2. **Organization**: Clear separation between different jobs and their assets
3. **Traceability**: Easy to track all files associated with a specific job
4. **Development**: Isolated data storage prevents conflicts during development
5. **Testing**: Easy to clean up and verify data for specific jobs
6. **Parameter Tracking**: Job parameters are persisted for debugging and analysis

## Job Directory Contents

Each job directory contains:

### `uploads/` Directory
- Contains all uploaded images for the job
- Files are renamed with secure random names for security
- Original filename mapping is preserved in the job's image data

### `models/` Directory  
- Contains the generated 3D model file(s)
- Model files are named with secure random names
- Currently supports GLB format models

### `parameters.json` File
Contains job metadata and parameters:
```json
{
  "job_id": "7505839f-a33e-4117-9744-b5a1bae4e1e2",
  "created_at": "2025-08-16T19:07:25.123456",
  "parameters": {
    "quality": "medium",
    "max_features": 1000,
    "enable_gpu": false
  }
}
```

## Usage

### Running the Backend

```bash
cd src/backend/fake_backend
python server.py
```

The backend will automatically create job-specific directories as jobs are submitted.

### Running the Frontend Client

```bash
cd src/frontend/fake_frontend
python client.py
```

The client will automatically use the correct output directory for downloads.

## File Flow

1. **Job Creation**: Client submits images → Backend creates job-specific directory structure
2. **Parameter Storage**: Job parameters are saved to `{job_id}/parameters.json`
3. **Upload Storage**: Images saved to `{job_id}/uploads/` directory (backend)
4. **Processing**: Backend processes images and generates models
5. **Model Storage**: Models saved to `{job_id}/models/` directory (backend)
6. **Download**: Client downloads from backend and saves to `downloads/` directory (frontend)

## Example Job Directory

After processing job `7505839f-a33e-4117-9744-b5a1bae4e1e2`, the structure would be:

```text
output/backend/fake_backend/7505839f-a33e-4117-9744-b5a1bae4e1e2/
├── uploads/
│   ├── upload_a1b2c3d4e5f6789012345678.jpg
│   ├── upload_b2c3d4e5f6789012345678a1.png
│   └── upload_c3d4e5f6789012345678a1b2.jpg
├── models/
│   └── model_d4e5f6789012345678a1b2c3.glb
└── parameters.json
```

## Code Quality Features

- **Type Hints**: Proper type annotations using `typing` module
- **Error Handling**: Robust error handling for invalid requests and WebSocket issues
- **Logging**: Comprehensive logging for all major events including file paths
- **Dataclasses**: Clean data representation using dataclasses
- **Pydantic v1**: Request validation using Pydantic models
- **FastAPI**: Modern Python web framework with automatic API documentation
- **Security**: Path traversal protection and secure filename generation

## Testing

You can verify the job-specific output structure by running the backend and client:

```bash
# Terminal 1 - Start backend
cd src/backend/fake_backend
python server.py

# Terminal 2 - Run client test
cd src/frontend/fake_frontend
python client.py
```

After running, you should see job-specific directories created in `output/backend/fake_backend/` with the job ID as the directory name.
