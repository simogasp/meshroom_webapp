# **Code Generation Agent Prompt – Step 1 (Fake Backend + Frontend with WebSocket)**

## **Project Goal**

Generate a Python project that simulates the frontend-backend workflow of a photogrammetry application.
The backend is a **FastAPI server** that simulates processing image uploads and sends real-time progress updates over WebSocket.
The frontend is a **Python CLI client** that uploads random images, receives progress updates, and downloads a dummy 3D model.

This setup is intended for **testing the communication and workflow** before integrating the real photogrammetry engine (Meshroom) and real frontend UI.

---

## **Backend Requirements**

* Python 3.9+, using **FastAPI**.
* Expose an endpoint to upload images and parameters (`/upload`).
* Return a **job ID** for each upload.
* Simulate processing:

  * Generate random progress updates (0% → 100%).
  * Delay between updates to simulate processing time.
* Send progress updates over **WebSocket**.
* After completion, respond with a random 3D model file (e.g., `.glb` dummy file).
* Use **dataclasses** for job and image representation.
* Use **pydantic v1** for request validation.
* Implement **robust error handling** for invalid requests and WebSocket issues.
* Include logging for all major events (upload received, progress updates, job completion).

---

## **Frontend Requirements**

* Python CLI application using `requests` for HTTP and `websocket-client` for WebSocket.
* Generate random images (small dummy data, e.g., 1 KB each) and random parameters.
* Upload images and parameters to backend.
* Listen to WebSocket progress updates.
* Log progress updates and job completion.
* Download the dummy 3D model file and store it locally.
* Include example usage in `if __name__ == "__main__":`.

---

## **Python Code Rules**

1. **High-quality, production-grade code**.
2. Python 3.9+ compatibility.
3. Use **well-known OOP design patterns**.
4. **Google style docstrings** for all functions, classes, and modules.
5. Include **input and return type hints**.
6. Use `@property` for getters/setters.
7. Use **dataclasses** for storing data.
8. Use **pydantic v1** for input validation.
9. Use **f-strings** for formatting.
10. Functions should be **small and single-purpose**.
11. Use **list/dictionary comprehensions** where suitable.
12. Use **generators** for handling large datasets.
13. Use **logging** instead of print statements.
14. Implement **robust error handling** for external calls and WebSocket operations.
15. Do not use emojis in code.

---

## **Deliverables**

1. **Backend**

   * `main.py`: FastAPI server with `/upload` endpoint and WebSocket for progress.
   * `models.py`: Pydantic and dataclasses definitions.
   * `jobs.py`: Job manager simulating processing.

2. **Frontend**

   * `client.py`: CLI client generating dummy images, uploading them, listening to progress, and downloading dummy 3D model.
   * Example in `if __name__ == "__main__":`.

---

## **Project Structure**

Use a standard Python project structure separating the source code into `src` and `tests`.
Consider that in the future steps other backends and frontends will be added with the actual features.

---

## **Continuous Integration**

Set up a **GitHub Actions workflow** that runs the tests and builds the project.

---

## **Documentation**

Explain the general context of the project in the REAMDE.md file at the root of the repository but do not bloat it with implementation details.
Use other markdown files for detailed documentation.


## **Testing Notes**

* The backend and frontend must **work together locally**.
* Use **random delays** to simulate processing.
* Ensure **WebSocket messages** are correctly received and logged by the frontend.
* Dummy 3D model can be a small `.glb` placeholder file with random bytes.

---

