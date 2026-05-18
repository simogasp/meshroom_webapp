"""
Backend package for the Meshroom WebApp.

This package contains various backend implementations for photogrammetry
processing, including fake backends for testing and real Meshroom integration.
"""

try:
    from importlib.metadata import version

    __version__ = version("meshroom-webapp")
except Exception:
    __version__ = "unknown"
