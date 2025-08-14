# Project Prompt for AI Code Generation

## Project Context

This project is a cross-platform photogrammetry UI for interacting with a Meshroom backend.  
We follow a **step-by-step incremental development approach**.  
Step 1: Build a **fake backend** and **fake frontend** for local testing using WebSockets.  
The backend simulates processing by discarding uploaded images, sending random progress updates, and returning a random 3D model.  
The fake frontend sends random image data to the backend and logs progress and results.  

## Code Requirements

When generating Python code for this project, you must follow these rules:

1. **Code Quality**
   - Clean, production-grade, high-quality code.
   - Python 3.9+.
   - Use well-known Python design patterns and OOP principles.

2. **Documentation**
   - Google style docstrings.
   - Type hints for all parameters and return values.

3. **Coding Conventions**
   - Use `@property` for getters/setters.
   - Use list/dict comprehensions where appropriate.
   - Use generators for large datasets.
   - Use `logging` instead of `print`.
   - Use f-strings for formatting.
   - Keep functions small and focused.

4. **Data Structures**
   - Use `@dataclass` for storing structured data.
   - Use Pydantic v1 for validation and configuration.

5. **Error Handling**
   - Implement robust error handling when calling external dependencies.

6. **Example Entry Point**
   - Always include an example usage in:

     ```python
     if __name__ == "__main__":
         ...
     ```

7. **Code Quality Tools Compliance**
   - Generated code must pass all repository quality checks by running:

     ```bash
     python tests/run_tests.py --quality
     ```

   - This includes:
     - **Black** formatting (line length 88, Python 3.9–3.12)
     - **isort** import sorting (`profile=black`)
     - **mypy** static type checking
     - **bandit** security checks

   - Code should be ready to commit without manual fixes after generation.

## Expected Output

When generating code, output it as a **complete, runnable Python module** in a single code block, following all above rules.
