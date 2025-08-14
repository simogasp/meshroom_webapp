# Meshroom WebApp - Photogrammetry Client

A cross-platform photogrammetry application that generates 3D models from images using the Meshroom backend. This project is developed incrementally, starting with a fake backend and frontend for testing the communication workflow.

## 🚀 CI/CD Pipeline

This project includes a comprehensive continuous integration and deployment pipeline with:

- **Automated Testing**: Integration, quality, and security tests
- **Code Quality**: Linting (flake8), formatting (black), type checking (mypy)
- **Security Scanning**: Dependency vulnerabilities (safety) and static analysis (bandit)
- **Cross-Platform**: Tests on Python 3.10-3.13

See [.github/workflows/PIPELINE_GUIDE.md](.github/workflows/PIPELINE_GUIDE.md) for detailed documentation.

### Quick Pipeline Usage

```bash
# Run all tests
python tests/run_tests.py

# Run with auto-fix for formatting issues
python tests/run_tests.py --quality --fix

# Run quick integration tests
python tests/run_tests.py --integration --quick
```

## Project Overview

This application allows users to:

- Upload images from the device gallery, file system, or camera
- Configure processing parameters through a user-friendly interface
- Monitor real-time processing progress
- Download generated 3D models
- Support both web browsers and native mobile apps

## Development Approach

The project follows an incremental development strategy:

### Current Phase: Step 1 - Fake Backend & Frontend (v0.1)

- ✅ **Fake Backend**: FastAPI server simulating photogrammetry processing
- ✅ **Fake Frontend**: Python CLI client for testing workflows
- ✅ **WebSocket Communication**: Real-time progress updates
- ✅ **File Transfer**: Image upload and model download

### Future Phases

- **Step 2**: Web frontend with browser-based UI
- **Step 3**: Integration with real Meshroom photogrammetry engine
- **Step 4**: Mobile camera integration and video frame selection
- **Step 5**: Advanced mobile features with SLAM/AR

## Quick Start

### Prerequisites

- Python 3.9+
- pip package manager

### Installation

1. Clone the repository:

    ```bash
    git clone <repository-url>
    cd meshroom_webapp
    ```

2. Create a virtual environment:

    ```bash
    python -m venv .venv
    source .venv/bin/activate  # On Windows: .venv\Scripts\activate
    ```

3. Install dependencies:

    ```bash
    pip install -r requirements.txt
    ```

### Running the Application

1. **Start the backend server:**

    ```bash
    cd src/backend/fake_backend
    python server.py
    ```

    The server will start at `http://localhost:8000`

2. **Run the frontend client (in a new terminal):**

    ```bash
    cd src/frontend/fake_frontend
    python client.py
    ```

    The client will automatically:

    - Generate test images
    - Upload them to the backend
    - Monitor processing progress via WebSocket
    - Download the generated 3D model

## Architecture

The project follows a modular architecture with clear separation between backend services, frontend clients, and supporting infrastructure:

```none
meshroom_webapp/
├── src/                           # Source code
│   ├── backend/
│   │   └── fake_backend/          # FastAPI simulation server
│   │       ├── server.py          # Main FastAPI application and endpoints
│   │       ├── models.py          # Pydantic models and data structures
│   │       └── jobs.py            # Job management and WebSocket handling
│   └── frontend/
│       └── fake_frontend/         # CLI test client
│           └── client.py          # Complete workflow testing client
├── tests/                         # Test suite
│   ├── integration/               # End-to-end workflow tests
│   ├── quality/                   # Code quality and linting tests
│   ├── security/                  # Security vulnerability tests
│   └── run_tests.py              # Test runner with CI/CD integration
├── assets/                        # Static assets
│   └── avocado.glb               # Real 3D model for testing
├── .github/workflows/             # CI/CD pipeline configuration
├── reports/                       # Generated test and quality reports
├── requirements.txt               # Python dependencies
├── requirements-test.txt          # Testing dependencies
└── pyproject.toml                # Project configuration
```

### Backend Architecture (v0.1)

**FastAPI Application** (`src/backend/fake_backend/server.py`)

- RESTful API endpoints for job management
- WebSocket endpoint for real-time progress updates
- CORS middleware for cross-origin requests
- Command-line configuration with argparse

**Data Models** (`src/backend/fake_backend/models.py`)  

- `ProcessingJob`: Job lifecycle and metadata
- `ImageData`: Image file information and validation
- `UploadRequest`: Request parameter validation
- `JobResponse`: API response structures

**Job Management** (`src/backend/fake_backend/jobs.py`)

- `JobManager`: Thread-safe job orchestration
- Asynchronous processing simulation with realistic stages
- WebSocket connection management for multiple clients
- Model generation (both dummy and real asset loading)

### Frontend Architecture (v0.1)

**CLI Client** (`src/frontend/fake_frontend/client.py`)

- `PhotogrammetryClient`: Complete workflow testing
- Image generation and upload simulation
- WebSocket-based progress monitoring with threading
- Model download with retry logic and error handling

### Development Infrastructure

**Testing Framework** (`tests/`)

- Integration tests for complete workflows
- Quality assurance with automated code formatting
- Security vulnerability scanning
- Cross-platform compatibility testing

**CI/CD Pipeline** (`.github/workflows/`)

- Automated testing on Python 3.10-3.13
- Code quality enforcement (flake8, mypy, black, isort)
- Security analysis (bandit, safety)
- Report generation and artifact collection

### Future Architecture Evolution

- **v0.2**: Web frontend with React/Vue.js browser interface
- **v1.0**: Real Meshroom backend integration with containerized services  
- **v2.0**: Mobile apps with native camera integration
- **v3.0**: AR/SLAM modules with real-time processing capabilities

## API Endpoints

### Backend REST API

- `GET /` - Server status and information
- `GET /health` - Health check
- `POST /upload` - Upload images for processing
- `GET /jobs/{job_id}` - Get job status
- `GET /jobs/{job_id}/download` - Download generated model
- `DELETE /jobs/{job_id}` - Cancel job
- `WS /ws/{job_id}` - WebSocket for progress updates

## Features

### Current Features (v0.1)

- ✅ Simulated photogrammetry processing with realistic progress updates
- ✅ Multi-file image upload with validation
- ✅ Real-time progress monitoring via WebSocket
- ✅ Dummy 3D model generation and download
- ✅ Comprehensive logging and error handling
- ✅ Production-grade code with type hints and documentation

### Planned Features

- 🔄 Web-based user interface
- 🔄 Real Meshroom integration
- 🔄 Mobile camera support
- 🔄 Video frame selection
- 🔄 AR/SLAM integration

## Development

### Code Quality Standards

- Python 3.9+ compatibility
- Google-style docstrings
- Type hints for all functions
- Comprehensive error handling
- Modular, testable design
- PEP 8 code formatting

### Testing

Run the complete workflow test:

```bash
python src/frontend/fake_frontend/client.py
```

### Contributing

This project follows incremental development. Each phase builds upon the previous one while maintaining backward compatibility for testing and validation.

## License

This project is licensed under the Mozilla Public License Version 2.0 (MPL-2.0), see the [LICENSE](LICENSE) file.

### Third-Party Dependencies

This project uses various open-source libraries, each with their own licenses:

- **FastAPI**: MIT License
- **Pydantic**: MIT License  
- **WebSocket-client**: Apache License 2.0
- **Requests**: Apache License 2.0

Run `pip-licenses` to see all dependency licenses:

```bash
pip install pip-licenses
pip-licenses --format=table --with-license-file --no-license-path
```

## Support

For issues and questions, please [create an issue](../../issues) in the repository.
