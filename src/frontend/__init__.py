"""
Frontend package for the Meshroom WebApp.

This package contains various frontend implementations for the photogrammetry
application, including CLI clients and future web interfaces.
"""

try:
    from importlib.metadata import version

    __version__ = version("meshroom-webapp")
except Exception:
    __version__ = "unknown"
