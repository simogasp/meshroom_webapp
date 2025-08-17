# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Web API Tester**: Interactive HTML-based testing interface (`src/frontend/web_api_tester/web_test.html`)
  - Point-and-click testing for all backend API endpoints
  - Real-time WebSocket progress monitoring with visual feedback
  - File upload support with both real files and dummy image generation
  - Auto-population of job IDs from upload responses
  - Live response logging with timestamps and error highlighting
  - Automatic model download handling for completed jobs
  - Connection testing and configurable backend URL
  - Split-screen design for efficient testing workflow

- **Job-Specific File Storage System**: Complete overhaul of file organization
  - Individual directory structure for each job: `output/backend/fake_backend/{job_id}/`
  - Isolated storage with dedicated subdirectories:
    - `uploads/`: Uploaded image files with secure random filenames
    - `models/`: Generated 3D model files (.glb format)
    - `parameters.json`: Job parameters and metadata with creation timestamps
  - Enhanced traceability with full path logging for all file operations
  - Automatic directory creation during job initialization

- **Job Parameter Persistence**: Enhanced job metadata management
  - `save_job_parameters()` function for structured parameter storage
  - JSON serialization with job metadata including creation timestamps
  - Parameter validation and storage during job creation

- **Enhanced Directory Management Functions**:
  - `create_job_directories()`: Automated job-specific directory structure creation
  - Project root path detection with relative path calculation
  - OSError handling for robust directory operations

- Dynamic Parameters feature (server and web client) [PR#8](https://github.com/simogasp/meshroom_webapp/pull/8):
  - Server now loads and validates `parameters.json` at startup and exposes `GET /parameters`.
  - `POST /upload` accepts an additional `parameters` JSON field with dynamic user-selected values.
  - Parameters are persisted per job under `output/backend/fake_backend/{job_id}/parameters.json`.
  - Web client v0.2 fetches `/parameters` on load and dynamically renders the parameter UI from the schema.
  - Full parameter payload is sent with uploads.
- Logging verbosity options:
  - Backend: `--log-level {DEBUG,INFO,WARNING,ERROR}`.
  - CLI client: `--verbose {DEBUG,INFO,WARNING,ERROR}`.
- Output structure utilities:
  - Helpers to create job folders and persist parameters.
  - Job result file path is recorded after model generation.

- **Directory Upload Support** [PR#9](https://github.com/simogasp/meshroom_webapp/pull/9)
  - Directory Selection: Users can select entire folders using the 'Select Folder' button
  - Drag & Drop Folders: Full support for dragging and dropping directories
  - Recursive File Collection: Automatically finds all image files in nested subdirectories

### Changed

- Standardized output structure under `output/backend/fake_backend/{job_id}/(uploads|models)`.
- Frontend web v0.2 now uses dynamic parameters instead of hardcoded definitions when available.

### Fixed

- Improved robustness of model download flow by ensuring the server records the generated model path when serving the file and the client retries on transient readiness races.

## [v0.1] - 2025-08-14

### Added

#### Core Backend Infrastructure

- **FastAPI Backend Server**: Production-grade photogrammetry simulation server
  - RESTful API endpoints for job management and file operations
  - Real-time WebSocket communication for progress updates
  - Robust error handling and comprehensive logging
  - CORS middleware for cross-origin requests

#### Job Management System

- **ProcessingJob Model**: Complete dataclass-based job representation
  - Image metadata tracking with size and content type validation
  - Job lifecycle management (queued → processing → completed/failed)
  - Progress tracking with detailed status updates
- **JobManager Class**: Centralized job orchestration
  - Asynchronous job processing simulation
  - WebSocket connection management for multiple clients
  - Thread-safe job storage and retrieval

#### API Endpoints

- `GET /` - Server status with health information
- `GET /health` - Health check endpoint
- `POST /upload` - Multi-file image upload with parameter validation
- `GET /jobs/{job_id}` - Job status retrieval with detailed metadata
- `GET /jobs/{job_id}/download` - 3D model download with retry mechanism
- `DELETE /jobs/{job_id}` - Job cancellation
- `GET /jobs` - List all jobs with filtering capabilities
- `WS /ws/{job_id}` - WebSocket endpoint for real-time progress updates

#### Model Generation Features

- **Dummy Model Generation**: Realistic GLB file simulation
  - Binary GLB format with proper headers
  - Variable file sizes based on processing parameters
- **Real Model Support**: Asset-based model serving
  - `generate_real_model()` function for loading actual GLB files
  - Command-line flag `--real-model` for dynamic model selection
  - Support for avocado.glb asset (8.3MB high-quality model)

#### CLI Client Application

- **PhotogrammetryClient**: Full-featured test client
  - Image generation and upload simulation
  - WebSocket-based progress monitoring
  - Model download with automatic retry logic
  - Complete workflow testing capabilities

#### Processing Simulation

- **Realistic Processing Stages**: Multi-stage photogrammetry simulation
  - Image analysis, feature extraction, matching
  - Bundle adjustment, dense reconstruction, mesh generation
  - Random but realistic processing times and progress updates
- **WebSocket Progress Updates**: Real-time communication
  - JSON-formatted progress messages
  - Connection management with automatic cleanup
  - Heartbeat support for connection monitoring

#### Command Line Interface

- **Server Configuration**: Flexible startup options
  - `--host` and `--port` configuration
  - `--real-model` flag for asset-based models
  - `--reload` flag for development mode
- **Client Test Workflow**: Comprehensive testing capabilities
  - Configurable image count and processing parameters
  - End-to-end workflow validation
  - Detailed logging and progress reporting

#### File Management

- **Upload Handling**: Robust file processing
  - Multi-file upload support with size validation
  - Content type detection and validation
  - Automatic directory creation and cleanup
- **Download System**: Reliable model retrieval
  - FileResponse with proper MIME types
  - Race condition handling for job completion
  - Retry mechanism for temporary failures

#### Development Infrastructure

- **Code Quality Tools**: Production-ready codebase
  - Type hints throughout (mypy validation)
  - Code formatting with black and isort
  - Linting with flake8
  - Security analysis with bandit
- **Testing Framework**: Comprehensive validation
  - Integration tests for all major workflows
  - Quality assurance automation
  - Security vulnerability scanning

### Technical Specifications

- **Python 3.9+** with modern async/await patterns
- **FastAPI** framework with Pydantic v1 validation
- **WebSocket** support for real-time communication
- **Dataclass-based** models for type safety
- **Production-grade logging** with structured output
- **Cross-platform compatibility** (macOS, Linux, Windows)

### Documentation

- Complete API documentation with endpoint specifications
- Model selection feature guide with usage examples
- Development setup instructions and workflow guides
- Incremental development roadmap for future phases
