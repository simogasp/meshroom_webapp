# 📌 Prompt for the Agent

Extend the existing **image upload feature** to also support uploading entire directories (including subdirectories).

## User Functionality

* The user can already upload images by:

  1. Selecting files from the file manager, or
  2. Dragging and dropping files onto the UI.

* Extend this functionality so that the user can also:

  1. Select a **directory** in the file manager, or
  2. Drag and drop a **directory** (including nested subfolders) onto the existing upload widget.

* When a directory is uploaded:

  * All images are collected recursively from the directory and its subdirectories.
  * The **original folder structure** is preserved and replicated on the server side under the `uploads/` root directory.
  * The system must reuse the **existing discard logic**:

    * Non-image files (or unsupported images) are automatically discarded.
    * At the end of the upload, a **popup message** is shown listing all discarded files, consistent with the current single/multiple file upload behavior.

## Expected Outcome

* Users can seamlessly upload both files and directories through the same UI (file manager selection or drag-and-drop).
* The server stores uploaded directories with the same nested structure as provided by the user.
* Discarded files are handled in the same way as with single file uploads: a popup lists them after the process completes.
* The client receives a confirmation message including the number of successfully uploaded images and the directory root name.

## General rules

* Follow modular design and best practices for maintainable code as defined in `rules.json` and `CONTRIBUTING.md`.
* Keep UI code clean and reusable (small functions/components).
* Update the documentation in the various existing markdown files accordingly.
* Use the existing code style and conventions.
* Apply the same coding style rules already enforced in the project (black, isort, bandit, markdownlint, etc.). For that remember that there is an automatic test script that can be run:

      ```bash
      python tests/run_tests.py --quality
      ```

     which also have a `--fix` option to automatically fix the issues where possible.
* More generally, ensure that the integration tests pass when modifying the server code:

      ```bash
      python tests/run_tests.py --integration
      ```

* Check that after all changes all the front ends still work.
* `./start_fake_backend.sh` allows you to start the fake backend.

---
