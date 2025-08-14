#!/usr/bin/env python3
"""
Backend startup and management script for testing.

This script handles starting, stopping, and managing the backend server
for integration testing purposes.

Usage:
    python tests/scripts/backend_manager.py start
    python tests/scripts/backend_manager.py stop
    python tests/scripts/backend_manager.py status
    python tests/scripts/backend_manager.py wait --timeout 30
"""

import argparse
import logging
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class BackendManager:
    """Manages backend server lifecycle for testing."""

    def __init__(self, backend_dir: Optional[str] = None, port: int = 8000):
        """
        Initialize the backend manager.

        Args:
            backend_dir: Path to backend directory
            port: Port number for the backend
        """
        if backend_dir is None:
            # Default to project structure
            project_root = Path(__file__).parent.parent.parent
            self.backend_dir = project_root / "src" / "backend" / "fake_backend"
        else:
            self.backend_dir = Path(backend_dir)
        self.port = port
        self.base_url = f"http://localhost:{port}"
        self.pid_file = Path("/tmp") / f"meshroom_backend_{port}.pid"

    def is_running(self) -> bool:
        """
        Check if the backend is currently running.

        Returns:
            True if the backend is responding, False otherwise
        """
        try:
            response = requests.get(f"{self.base_url}/health", timeout=2)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False

    def get_pid(self) -> int | None:
        """
        Get the PID of the running backend process.

        Returns:
            PID if found, None otherwise
        """
        try:
            if self.pid_file.exists():
                with open(self.pid_file, "r") as f:
                    pid = int(f.read().strip())

                # Check if the process is actually running
                try:
                    os.kill(pid, 0)  # Signal 0 just checks if the process exists
                    return pid
                except OSError:
                    # Process doesn't exist, remove the stale PID file
                    self.pid_file.unlink()
                    return None
            return None
        except (ValueError, FileNotFoundError):
            return None

    def start(self) -> bool:
        """
        Start the backend server.

        Returns:
            True if started successfully, False otherwise
        """
        if self.is_running():
            logger.info(f"Backend already running at {self.base_url}")
            return True

        if not self.backend_dir.exists():
            logger.error(f"Backend directory not found: {self.backend_dir}")
            return False

        main_py = self.backend_dir / "server.py"
        if not main_py.exists():
            logger.error(f"server.py not found in: {self.backend_dir}")
            return False

        try:
            logger.info(f"Starting backend at {self.base_url}...")

            # Start the backend process
            process = subprocess.Popen(
                [sys.executable, "server.py"],
                cwd=self.backend_dir,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                preexec_fn=os.setsid,  # Create a new process group
            )

            # Save PID
            with open(self.pid_file, "w") as f:
                f.write(str(process.pid))

            # Wait for the backend to be ready
            for i in range(30):
                if self.is_running():
                    logger.info(f"Backend started successfully (PID: {process.pid})")
                    return True
                time.sleep(1)

            logger.error("Backend failed to start within 30 seconds")
            self.stop()
            return False

        except Exception as e:
            logger.error(f"Failed to start backend: {e}")
            return False

    def stop(self) -> bool:
        """
        Stop the backend server.

        Returns:
            True if stopped successfully, False otherwise
        """
        pid = self.get_pid()

        if pid is None:
            if not self.is_running():
                logger.info("Backend is not running")
                return True
            else:
                logger.warning(
                    "Backend running but PID unknown, trying to stop anyway..."
                )
                return self._force_stop()

        try:
            logger.info(f"Stopping backend (PID: {pid})...")

            # Try a graceful shutdown first
            os.killpg(os.getpgid(pid), signal.SIGTERM)

            # Wait for the process to stop
            for i in range(10):
                try:
                    os.kill(pid, 0)
                    time.sleep(0.5)
                except OSError:
                    # Process stopped
                    break
            else:
                # Force kill if still running
                logger.warning("Graceful shutdown failed, force killing...")
                os.killpg(os.getpgid(pid), signal.SIGKILL)
                time.sleep(1)

            # Clean up PID file
            if self.pid_file.exists():
                self.pid_file.unlink()

            if not self.is_running():
                logger.info("Backend stopped successfully")
                return True
            else:
                logger.error("Backend still running after stop attempt")
                return False

        except Exception as e:
            logger.error(f"Error stopping backend: {e}")
            return False

    def _force_stop(self) -> bool:
        """Force stop any backend processes on the port."""
        try:
            # Try to find and kill processes using the port
            result = subprocess.run(
                ["lsof", "-ti", f":{self.port}"], capture_output=True, text=True
            )

            if result.returncode == 0 and result.stdout.strip():
                pids = result.stdout.strip().split("\n")
                for pid in pids:
                    try:
                        os.kill(int(pid), signal.SIGTERM)
                        time.sleep(1)
                        os.kill(int(pid), signal.SIGKILL)
                    except (OSError, ValueError):
                        pass

                # Clean up PID file
                if self.pid_file.exists():
                    self.pid_file.unlink()

                return not self.is_running()

            return True

        except Exception:
            return False

    def wait_for_ready(self, timeout: int = 30) -> bool:
        """
        Wait for the backend to become ready.

        Args:
            timeout: Maximum time to wait in seconds

        Returns:
            True if the backend becomes ready, False if timeout
        """
        logger.info(f"Waiting for backend at {self.base_url} (max {timeout}s)...")

        for i in range(timeout):
            if self.is_running():
                logger.info(f"Backend ready after {i + 1}s")
                return True
            time.sleep(1)

        logger.error(f"Backend not ready after {timeout}s")
        return False

    def status(self) -> dict:
        """
        Get backend status information.

        Returns:
            Status dictionary
        """
        running = self.is_running()
        pid = self.get_pid()

        status = {
            "running": running,
            "pid": pid,
            "url": self.base_url,
            "pid_file": str(self.pid_file),
        }

        if running:
            try:
                response = requests.get(f"{self.base_url}/", timeout=2)
                if response.status_code == 200:
                    status["info"] = response.json()
            except requests.RequestException:
                pass

        return status


def main():
    """Main entry point for backend management."""
    parser = argparse.ArgumentParser(description="Manage backend server for testing")
    parser.add_argument(
        "action",
        choices=["start", "stop", "status", "wait", "restart"],
        help="Action to perform",
    )
    parser.add_argument("--backend-dir", help="Path to backend directory")
    parser.add_argument(
        "--port", type=int, default=8000, help="Backend port (default: 8000)"
    )
    parser.add_argument(
        "--timeout", type=int, default=30, help="Timeout for wait action (default: 30s)"
    )

    args = parser.parse_args()

    manager = BackendManager(args.backend_dir, args.port)

    if args.action == "start":
        success = manager.start()
        sys.exit(0 if success else 1)

    elif args.action == "stop":
        success = manager.stop()
        sys.exit(0 if success else 1)

    elif args.action == "restart":
        logger.info("Restarting backend...")
        manager.stop()
        time.sleep(2)
        success = manager.start()
        sys.exit(0 if success else 1)

    elif args.action == "wait":
        success = manager.wait_for_ready(args.timeout)
        sys.exit(0 if success else 1)

    elif args.action == "status":
        status = manager.status()
        logger.info("Backend Status:")
        logger.info(f"  Running: {status['running']}")
        logger.info(f"  PID: {status.get('pid', 'Unknown')}")
        logger.info(f"  URL: {status['url']}")

        if status.get("info"):
            logger.info(f"  Service: {status['info'].get('service', 'Unknown')}")
            logger.info(f"  Version: {status['info'].get('version', 'Unknown')}")

        sys.exit(0 if status["running"] else 1)


if __name__ == "__main__":
    main()
