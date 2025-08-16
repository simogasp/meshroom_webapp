# Model Selection Feature

## Overview

The backend server now supports dynamic selection between fake (generated) and real 3D models through a command-line flag.

## New Functions

### `generate_real_model(job_id: str) -> bytes`

- **Location**: `src/backend/fake_backend/jobs.py`
- **Purpose**: Loads the real monstree.glb model from the assets folder
- **Signature**: Same as `generate_dummy_model(job_id: str)`
- **Returns**: Binary GLB model data (8.3MB monstree model)
- **Error Handling**: Raises FileNotFoundError or IOError with detailed messages

## Command Line Usage

### Start with fake models (default)

```bash
python3 src/backend/fake_backend/server.py
```

### Start with real models

```bash
python3 src/backend/fake_backend/server.py --real-model
```

### Full options

```bash
python3 src/backend/fake_backend/server.py --host 0.0.0.0 --port 8080 --real-model --reload
```

### Available flags

- `--host`: Host to bind server to (default: 127.0.0.1)
- `--port`: Port to bind server to (default: 8000)
- `--real-model`: Use real monstree.glb model instead of generated fake models
- `--reload`: Enable auto-reload for development

## API Changes

### `/download/{job_id}` endpoint

- Now dynamically selects between `generate_dummy_model()` and `generate_real_model()` based on the `--real-model` flag
- Returns appropriate FileResponse with correct model data
- Logs which model type was used for each request
- Error handling for missing asset files

### Root endpoint `/`

- Now displays which model mode the server is running in
- Shows "real (monstree.glb)" or "fake (generated)" in the response

## Asset Requirements

- **File**: `assets/monstree.glb`
- **Size**: ~8.3MB
- **Format**: Binary GLB (valid glTF 2.0)
- **Status**: ✅ Present and working

## Testing

All functionality tested with:

- Unit test for both model generation modes
- CLI argument parsing verification
- Server startup in both modes
- Quality assurance (flake8, mypy, black, isort): ✅ All passed

## Implementation Details

- Global `USE_REAL_MODEL` flag set during server startup
- Conditional model selection in the download endpoint
- Proper error handling and logging for asset loading
- Maintains backward compatibility (fake models remain default)
