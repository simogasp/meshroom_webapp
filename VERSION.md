# Version Management

This project uses **git tags** as the single source of truth for versioning.

## How It Works

The version is automatically derived from git tags using `hatch-vcs`:

- **Tagged commit**: Version matches the tag (e.g., `v0.2.0` → `0.2.0`)
- **Development**: Version includes distance from tag and commit hash
  - Example: `0.2.1.dev164+g494afc3b5.d20260518`
  - Format: `{next_version}.dev{distance}+g{commit_hash}.d{date}`

## Creating a New Release

1. **Update CHANGELOG.md** with the new version's changes

2. **Create and push a version tag:**

   ```bash
   git tag -a v0.3.0 -m "Release version 0.3.0"
   git push origin v0.3.0
   ```

3. **Build and verify:**

   ```bash
   uv sync --all-extras
   uv run python -c "from src.backend import __version__; print(__version__)"
   ```

## Checking Current Version

From code:

```python
from src.backend import __version__
print(__version__)
```

From command line:

```bash
uv run python -c "from src.backend import __version__; print(__version__)"
```

From git:

```bash
git describe --tags
```

## Configuration

Version configuration is in [pyproject.toml](pyproject.toml):

- `dynamic = ["version"]` - Version is not hardcoded
- `[tool.hatch.version] source = "vcs"` - Use git tags
- `hatch-vcs` build dependency - Implements VCS versioning

## Benefits

✅ **Single source of truth**: Git tags control the version  
✅ **No manual updates**: Version automatically derived  
✅ **Development versions**: Clear distinction between releases and dev builds  
✅ **Traceable**: Each build includes git commit hash  
✅ **PEP 440 compliant**: Standard Python version format
