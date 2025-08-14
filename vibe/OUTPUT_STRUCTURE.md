# Output Directory Structure

This document describes the modified output directory structure for the fake photogrammetry backend and frontend.

## Directory Structure

All data exchanged between the fake backend and frontend is now stored in organized output directories:

```text
project_root/
├── output/
│   ├── backend/
│   │   └── fake_backend/
│   │       ├── uploads/     # Uploaded image files from clients
│   │       └── models/      # Generated 3D model files (.glb)
│   └── frontend/
│       └── fake_frontend/
│           └── downloads/   # Downloaded model files from backend
└── src/
    ├── backend/
    │   └── fake_backend/    # Backend source code
    └── frontend/
        └── fake_frontend/   # Frontend client source code
```

## Changes Made

### Backend (`src/backend/fake_backend/main.py`)

1. **Directory Configuration**: Modified to use organized output directories
   - Uploads: `output/backend/fake_backend/uploads/`
   - Models: `output/backend/fake_backend/models/`

2. **File Handling**:
   - Images uploaded via `/upload` endpoint are saved to the uploads directory
   - Generated models are saved to the models directory
   - Full path logging for better traceability

3. **Path Calculation**: Automatic project root detection using relative paths from the source file

### Frontend Client (`src/frontend/fake_frontend/client.py`)

1. **Download Directory**: Modified to use organized output directory
   - Downloads: `output/frontend/fake_frontend/downloads/`

2. **Automatic Path Detection**: The client automatically calculates the correct project root and uses the appropriate output directory

3. **Path Calculation**: Improved path traversal logic to correctly identify project root from the client source file location

### Job Manager (`src/backend/fake_backend/jobs.py`)

1. **Result Path**: Updated to reflect the new models directory structure in job completion messages

## Benefits

1. **Organization**: Clear separation between backend and frontend data
2. **Traceability**: Easy to track data flow between components
3. **Development**: Isolated data storage prevents conflicts during development
4. **Testing**: Easy to clean up and verify data exchange

## Usage

### Running the Backend

```bash
cd src/backend/fake_backend
python server.py
```

The backend will automatically create and use the output directories.

### Running the Frontend Client

```bash
cd src/frontend/fake_frontend
python client.py
```

The client will automatically use the correct output directory for downloads.

## File Flow

1. **Upload**: Client → `uploads/` directory (backend)
2. **Processing**: Backend processes images and generates models
3. **Storage**: Models saved to `models/` directory (backend)
4. **Download**: Client downloads from backend and saves to `downloads/` directory (frontend)

## Code Quality Features

- **Type Hints**: Proper type annotations using `typing` module
- **Error Handling**: Robust error handling for invalid requests and WebSocket issues
- **Logging**: Comprehensive logging for all major events including file paths
- **Dataclasses**: Clean data representation using dataclasses
- **Pydantic v1**: Request validation using Pydantic models
- **FastAPI**: Modern Python web framework with automatic API documentation

## Testing

You can verify the output structure by running the backend and client:

```bash
# Terminal 1 - Start backend
cd src/backend/fake_backend
python server.py

# Terminal 2 - Run client test
cd src/frontend/fake_frontend
python client.py
```

After running, you should see files in the appropriate output directories.
