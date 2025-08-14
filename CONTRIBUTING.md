# Contributing Guidelines

This project follows strict Python coding standards to ensure consistency, maintainability, and production-grade quality.

## General Principles

- Write **clean, production-grade, high-quality code**.
- Assume **Python 3.9+** for all code.
- Prefer **object-oriented programming** and **well-known Python design patterns**.
- Keep functions **small and single-purpose**.
- Always add **robust error handling** for any external dependency or I/O operation.

## Documentation

- Use **Google style docstrings** for all functions, classes, and modules.
- Every public function must document:
  - Args: parameter names, types, and descriptions.
  - Returns: type and description.
  - Raises: possible exceptions.

## Code Quality Tools

All contributed code must pass the following automated checks without modification:

- **Black** (line length: 88, Python targets: 3.9–3.12)
- **isort** with `profile=black` for import sorting
- **bandit** security checks (high severity issues must be fixed)
- **mypy** for static type checking (no type errors allowed)

These rules are enforced via CI. Contributors should run the quality test before committing:

```bash
python tests/run_tests.py --quality
```

## Type Hints

- Use **Python type hints** for all function parameters and return values.
- Use `Optional` where applicable.
- Always type annotate class attributes.

## Coding Style

- **F-strings** for all string formatting.
- Use `@property` for getters and setters instead of direct access methods.
- Use **list/dict comprehensions** for cleaner and more efficient loops.
- Use **generators** for large datasets to save memory.
- Use `logging` instead of `print` for any output.

## Data Structures

- Use `@dataclass` for structured data containers.
- Use **Pydantic v1** for data validation and settings management.

## Testing

- Write small, targeted unit tests.
- Cover both normal and edge cases.

## Example Code Pattern

```python
from dataclasses import dataclass
from typing import List, Optional
import logging

logging.basicConfig(level=logging.INFO)

@dataclass
class ImageData:
    filename: str
    resolution: Optional[tuple] = None

    @property
    def is_hd(self) -> bool:
        return self.resolution is not None and self.resolution[0] >= 1920

def process_images(images: List[ImageData]) -> None:
    """Process a list of images.

    Args:
        images (List[ImageData]): List of image metadata.

    Returns:
        None
    """
    for img in images:
        if img.is_hd:
            logging.info(f"Processing HD image: {img.filename}")
        else:
            logging.info(f"Skipping non-HD image: {img.filename}")

if __name__ == "__main__":
    imgs = [ImageData("photo1.jpg", (1920, 1080)), ImageData("photo2.jpg")]
    process_images(imgs)
