# **Project Requirements Document v0.2 – Web Frontend**

## **1. Overview**

The Web Frontend v0.2 is the next iteration of the application’s user interface.
Its purpose is to provide an interactive, browser-based way for users to upload images, configure processing parameters, send jobs to the backend, monitor progress via WebSockets, and view the resulting 3D model.

This version replaces the purely “fake” front-end of v1.0 with a functional interface integrated with the backend’s REST and WebSocket APIs.

---

## **2. Objectives**

* Provide an intuitive drag-and-drop interface for uploading images.
* Allow users to preview and filter selected images before submission.
* Display a set of placeholder parameters in a configurable panel.
* Communicate with the backend server for image upload, job tracking, and progress reporting.
* Display real-time progress with multiple progress bars (one per stage).
* Visualize the final generated 3D model in an interactive viewer.

---

## **3. APIs Used**

The frontend will communicate with the backend using the following API endpoints:

### REST Endpoints

* `GET /` — Server status and information.
* `GET /health` — Health check.
* `POST /upload` — Upload images for processing; returns a `job_id`.
* `GET /jobs/{job_id}` — Get job status.
* `GET /jobs/{job_id}/download` — Download generated model.
* `DELETE /jobs/{job_id}` — Cancel job.

### WebSocket Endpoint

* `WS /ws/{job_id}` — Receives progress updates from the server in the form:

  ```none
  "{stage_name}... {progress:.1f}%"
  ```

---

## **4. Functional Requirements Table**

| Requirement ID | Description                        | User Story                                                                                                                                      | Expected Behavior/Outcome                                                                                                             |
| -------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| FR001          | Image drag-and-drop upload         | As a user, I want to drag and drop multiple images into a designated area so that I can quickly select files without navigating the filesystem. | User drops images onto a dropzone, and the files are listed in the preview panel.                                                     |
| FR002          | File system image selection        | As a user, I want to select images from my file system so I can upload them without drag-and-drop.                                              | Clicking an "Upload" or "Select Files" button opens a file dialog; selected files appear in preview.                                  |
| FR003          | Image preview grid                 | As a user, I want to see thumbnails of selected images so I can verify and remove incorrect ones before processing.                             | A preview grid shows small versions of each selected image with a delete icon for removal.                                            |
| FR004          | Remove selected image              | As a user, I want to remove an image from the preview so that it is not sent to the server.                                                     | Clicking a delete button/icon removes that image from the selection list.                                                             |
| FR005          | Parameter panel with placeholders  | As a user, I want to adjust parameters for the process before uploading images.                                                                 | A panel displays a checkbox, slider, dropdown, and two editable fields; changes are stored locally for submission.                    |
| FR006          | Start processing images            | As a user, I want to start the server-side processing once I am ready.                                                                          | Clicking "Start Processing" uploads the images, stores the returned `job_id`, and connects to the WebSocket.                          |
| FR007          | Log panel                          | As a user, I want to see real-time logs from the backend so I understand what is happening during processing.                                   | Messages received via WebSocket are appended to a log panel in the order they arrive.                                                 |
| FR008          | Stage-based progress tracking      | As a user, I want to see each processing stage with a progress bar so I can track overall progress.                                             | A new progress bar is created for each stage name; progress updates adjust the bar percentage until 100%, then the next stage begins. |
| FR009          | Download final model               | As a user, I want to download the final processed 3D model once the job completes.                                                              | The system automatically downloads the model from `GET /jobs/{job_id}/download`.                                                      |
| FR010          | View 3D model                      | As a user, I want to view the resulting 3D model in the browser so I can inspect it without external software.                                  | An embedded 3D viewer displays the model, with mouse/touch controls for navigation and rotation.                                      |
| FR011          | Change 3D model visualization mode | As a user, I want to toggle between texture, wireframe, solid, and smooth shading so I can inspect the model’s structure.                       | Buttons or a dropdown switch between the four view modes in real time.                                                                |

---

## **5. Non-Functional Requirements**

* **NFR-01** – Must work on modern browsers (Chrome, Firefox, Safari, Edge).
* **NFR-02** – Must handle large image sets without crashing (progressive rendering).
* **NFR-03** – Responsive design for desktop and mobile.
* **NFR-04** – Graceful handling of server/network errors.
* **NFR-05** – Modular code structure to support future extensions.

---

## **6. Future Extensions (Not in v0.2)**

* **FE-01** – Image masking for object selection.
* **FE-02** – Automatic segmentation using ML (e.g., Segment Anything).
* **FE-03** – Real parameter handling (instead of placeholders).
* **FE-04** – Reordering of uploaded images.
* **FE-05** – Multi-model download and comparison.

---

## **7. Incremental Development Approach**

The frontend will be built incrementally:

1. **Phase 1 (v0.2)** — Implement file upload, preview, parameter panel, server communication, progress tracking, and model visualization.
2. **Phase 2** — Introduce masking tools and automatic segmentation.
3. **Phase 3** — Integrate real reconstruction parameters and advanced visualization features.

---
