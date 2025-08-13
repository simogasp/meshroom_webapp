# Meshroom WebApp - Photogrammetry Client

A cross-platform photogrammetry application that generates 3D models from images using the Meshroom backend. This project is developed incrementally, starting with a fake backend and frontend for testing the communication workflow.

## 🚀 CI/CD Pipeline

This project includes a comprehensive continuous integration and deployment pipeline with:

- **Automated Testing**: Integration, quality, and security tests
- **Code Quality**: Linting (flake8), formatting (black), type checking (mypy)
- **Security Scanning**: Dependency vulnerabilities (safety) and static analysis (bandit)
- **Cross-Platform**: Tests on Python 3.10-3.13

See [PIPELINE_GUIDE.md](PIPELINE_GUIDE.md) for detailed documentation.

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
python main.py
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

```
meshroom_webapp/
├── src/
│   ├── backend/
│   │   └── fake_backend/          # Simulated processing backend
│   │       ├── main.py            # FastAPI server
│   │       ├── models.py          # Data models and validation
│   │       └── jobs.py            # Job management and WebSocket
│   └── frontend/
│       └── fake_frontend/         # CLI test client
│           └── client.py          # Test workflow implementation
├── requirements.txt               # Python dependencies
└── README.md                     # This file
```

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

[Add your license information here]

## Support

For issues and questions, please [create an issue](../../issues) in the repository.
