# **Application Description for Code Generation Agent**

## **Project Overview**

The application is a **cross-platform photogrammetry client** that allows users to generate 3D models from images captured on their devices or selected from existing files. It communicates with a backend photogrammetry engine (Meshroom) that performs 3D reconstruction from images.

**Key high-level features:**

1. **Image Acquisition**

   * From device gallery or file system.
   * From camera (mobile devices):

     * Single shots.
     * Video capture with automatic frame selection.
     * Optional SLAM/AR mode for better coverage (mobile-only).

2. **Parameter Configuration**

   * User-friendly UI to configure a few processing parameters.

3. **Backend Communication**

   * Upload images and parameters.
   * Monitor progress in real time.
   * Retrieve completed 3D models.

4. **Cross-Platform Support**

   * Browser-based web frontend (desktop and mobile).
   * Native mobile app for Android/iOS for camera and AR features.

---

## **Development Approach**

The project will be developed incrementally in **steps**, starting with a minimal, testable setup and gradually adding complexity:

### **Step 1 – Fake Backend and Frontend (v0.1)**

* **Purpose:** Validate communication, workflow, and frontend logic before integrating real photogrammetry.
* **Fake Backend (FastAPI)**:

  * Receives image uploads and parameters.
  * Generates a unique job ID.
  * Simulates processing with random delays.
  * Sends progress updates via WebSocket (`PROGRESS:<value>`).
  * Sends a random 3D model (GLB file) when “done”.
* **Fake Frontend (Python CLI)**:

  * Generates random images and parameters.
  * Uploads to fake backend.
  * Receives progress updates via WebSocket.
  * Downloads the final “model” and logs events to console.

**Goal:** Ensure end-to-end communication, WebSocket updates, and file transfers work in a controlled environment.

---

### **Step 2 – Web Frontend (v0.2)**

* Replace the fake CLI frontend with a **real web UI**.
* Features:

  * File selection from desktop or mobile browser.
  * Parameter input via simple forms.
  * Upload images to backend.
  * Display progress bar and result preview.
* Backend may still be fake at this stage.

---

### **Step 3 – Real Photogrammetry Backend (v1.0)**

* Replace the fake backend with a real Meshroom server.
* Integrate actual 3D reconstruction processing.
* Ensure results are correctly returned and displayed in the frontend.
* 
---

### **Step 4 – Mobile Camera Integration (v2.0)**

* Enable mobile devices to capture images or videos.
* Implement **basic video frame selection**:

  * Capture video frames in real time.
  * Apply simple image processing criteria (blur detection, etc.) to select frames.
* Optional: Start integration with native AR/SLAM APIs.

---

### **Step 5 – Advanced Mobile Features (v3.0)**

* Full SLAM/AR-based frame selection.
* Integration with device IMU for movement estimation.
* Support real-time frame selection covering the object from all angles.

---

## **Notes for Code Generation Agent**

* Start by generating the **fake backend and frontend (Step 1)**.
* Use Python 3.9+, FastAPI for backend, and `websocket-client` + `requests` for CLI frontend.
* Backend and frontend should communicate through HTTP + WebSocket.
* Simulated data: random images (1 KB each), random progress, random model (dummy GLB).
* Provide clear console logs for testing the workflow.
* Ensure code is modular to allow replacement with real frontend and backend later.

---