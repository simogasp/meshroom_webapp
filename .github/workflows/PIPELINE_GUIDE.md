# CI/CD Pipeline Usage Guide

This document provides comprehensive information about the CI/CD pipeline for the Meshroom WebApp project.

## Overview

The project includes a robust CI/CD pipeline with automated testing, code quality checks, and security scanning. The pipeline is designed to ensure high code quality, security, and reliability.

## Pipeline Components

### 🔧 Unified Test Runner

The main entry point is `tests/run_tests.py`, which provides:

- **Integration Tests**: End-to-end backend and client communication testing
- **Code Quality Tests**: Linting, formatting, and type checking
- **Security Tests**: Vulnerability scanning and static security analysis

### 🎯 Code Quality Tools

#### Linting and Formatting with Ruff

- **Tool**: Ruff (replaces flake8, black, and isort)
- **Configuration**: `pyproject.toml` [tool.ruff]
- **Standards**: PEP 8 compliance, import sorting, code formatting
- **Features**: Extremely fast (10-100x faster), single tool for all checks
- **Line length**: 88 characters
- **Exclusions**: Build artifacts, reports, virtual environments

#### Type Checking with MyPy

- **Configuration**: `pyproject.toml` (includes [tool.ruff], [tool.mypy], [tool.bandit])
- **Features**: Strict optional checking, redundant cast warnings
- **Target**: Python 3.9+

- **Features**: Automatic import organization

### 🛡️ Security Tools

#### Dependency Vulnerability Scanning (Safety)

- **Tool**: `safety` - PyPI vulnerability database
- **Features**: Known vulnerability detection in dependencies
- **Network handling**: Graceful degradation on connectivity issues

#### Static Security Analysis (Bandit)

- **Configuration**: `[tool.bandit]` in `pyproject.toml`
- **Features**: AST-based security issue detection
- **Focus**: High and medium severity issues
- **Exclusions**: Test code, low-severity demo issues

### ⚙️ Backend Management

#### Backend Manager (`tests/scripts/backend_manager.py`)

- **Features**: Automated lifecycle management
- **Functions**: Start, stop, status, health checks
- **PID tracking**: Reliable process management

## Usage

### Local Development

#### Run All Tests

```bash
uv run tests/run_tests.py
```

#### Run Specific Test Types

```bash
# Integration tests only (quick mode)
uv run tests/run_tests.py --integration --quick

# Full integration tests
uv run tests/run_tests.py --integration

# Code quality tests only
uv run tests/run_tests.py --quality

# Security tests only
uv run tests/run_tests.py --security
```

#### Auto-fix Code Quality Issues

```bash
# Fix formatting and import issues automatically
uv run tests/run_tests.py --quality --fix
```

#### Verbose Output

```bash
uv run tests/run_tests.py --verbose DEBUG
```

### Manual Tool Usage

#### Format Code

```bash
# Check and fix with ruff
ruff check --fix src/ tests/

# Format with ruff
ruff format src/ tests/
```

#### Run Individual Quality Checks

```bash
# Linting and formatting
ruff check src/ tests/
ruff format --check src/ tests/

# Auto-fix issues
ruff check --fix src/ tests/
ruff format src/ tests/

# Type checking
mypy src/

# Security scan
bandit -r src/ -f json -c pyproject.toml
```

#### Backend Management

```bash
# Start backend
python tests/scripts/backend_manager.py start

# Check status
python tests/scripts/backend_manager.py status

# Stop backend
python tests/scripts/backend_manager.py stop
```

## CI/CD Integration

### GitHub Actions

The pipeline runs on:

- **Push**: to `master`, `develop`, `dev/ci` branches
- **Pull Request**: to `master`

#### Matrix Testing

- **Python versions**: 3.10, 3.11, 3.12, 3.13
- **OS**: Ubuntu Latest

#### Jobs

1. **Integration Tests**: Cross-version compatibility testing
2. **Quality Tests**: Code quality enforcement
3. **Security Tests**: Vulnerability and security scanning

### Artifacts and Reports

#### Generated Reports

- **Location**: `reports/` directory (excluded from version control)
- **Quality Reports**: `reports/quality/`
  - `ruff_report.txt`
  - `ruff_format_report.txt`
  - `mypy_report.txt`
- **Security Reports**: `reports/security/`
  - `safety_report.json`
  - `bandit_report.json`
  - `security_summary.json`

#### GitHub Actions Artifacts

- **Quality Reports**: 30-day retention
- **Security Reports**: 30-day retention (internal), 90-day retention (summary)

## Configuration Files

### Quality Tools Configuration

- **`pyproject.toml`**: Ruff, mypy, bandit, coverage settings

### Security Configuration

- **`[tool.bandit]`**: Bandit security scanner settings in pyproject.toml
- **Exclusions**: Test code, demo implementations
- **Focus**: High/medium severity security issues

### Project Configuration

- **`.gitignore`**: Excludes reports, build artifacts, temporary files

## Quality Standards

The pipeline enforces:

- ✅ **Zero linting errors** (flake8)
- ✅ **Clean type checking** (mypy)
- ✅ **Consistent formatting** (black)
- ✅ **Organized imports** (isort)
- ✅ **No high-severity security issues** (bandit)
- ✅ **No known vulnerable dependencies** (safety)

## Troubleshooting

### Common Issues

#### Network Connectivity

- **Safety check failures**: The pipeline gracefully handles network issues when safety cannot reach the PyPI vulnerability database
- **Solution**: The tests will pass with a warning if network connectivity is the only issue

#### Backend Startup Issues

```bash
# Check if backend is already running
python tests/scripts/backend_manager.py status

# Force stop any hanging processes
python tests/scripts/backend_manager.py stop

# Start fresh
python tests/scripts/backend_manager.py start
```

#### Code Quality Failures

```bash
# Auto-fix most formatting issues
uv run tests/run_tests.py --quality --fix

# Check specific tool output in reports/quality/
```

### Environment Setup

#### Development Dependencies

```bash
uv sync --all-extras
```

#### Environment Variables

No special environment variables required for basic usage.

## Security Considerations

- **Dependency scanning**: Automated detection of known vulnerabilities
- **Static analysis**: Code-level security issue detection
- **Safe defaults**: Security-first configuration choices
- **Network safety**: Graceful handling of external service dependencies

## Performance

### Test Execution Times

- **Quick integration tests**: ~10 seconds
- **Full integration tests**: ~45 seconds
- **Quality tests**: ~5 seconds
- **Security tests**: ~3 seconds
- **Complete suite**: ~60 seconds

### Optimization Options

- Use `--quick` flag for faster integration testing during development
- Run specific test types (`--quality`, `--security`, `--integration`) for focused testing

## Contributing

When contributing to the project:

1. **Run tests locally**: `python tests/run_tests.py`
2. **Fix quality issues**: `python tests/run_tests.py --quality --fix`
3. **Ensure security standards**: Address any high-severity security findings
4. **Verify integration**: Test with both quick and full integration modes

## Support

For issues with the CI/CD pipeline:

1. Check the generated reports in `reports/` directory
2. Run individual tools manually for detailed output
3. Use verbose mode (`--verbose DEBUG`) for detailed logging
4. Review GitHub Actions logs for CI-specific issues
