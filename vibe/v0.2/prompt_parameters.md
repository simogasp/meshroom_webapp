# Prompt for Agent – Dynamic Parameters Feature

We want to extend the existing fake backend (v0.1) and web frontend (v0.2) with a new feature: **dynamic job parameters loaded from a JSON config file**.

### Requirements

1. **Parameter Specification File**

   * Add a file `parameters.json` in the server root.
   * The file defines available parameters with their metadata (name, type, default, allowed values, min/max, etc.).
   * Example:

     ```json
        {
          "version": "1.0",
          "parameters" : [
          {
            "name": "quality",
            "type": "enum",
            "description": "Processing quality level affects speed and output detail",
            "values": ["draft", "medium", "high", "ultra"],
            "default": "medium",
            "required": true,
            "advanced": false
          },
          {
            "name": "meshResolution",
            "type": "integer",
            "description": "Higher resolution creates more detailed geometry",
            "min": 512,
            "max": 4096,
            "step": 256,
            "default": 1024,
            "required": true,
            "advanced": false
          },
          {
            "name": "textureSize",
            "type": "enum",
            "description": "Texture resolution affects visual quality",
            "values": [512, 1024, 2048, 4096],
            "default": 2048,
            "required": true,
            "advanced": false
          },
          {
            "name": "smoothing",
            "type": "boolean",
            "description": "Apply smoothing to reduce noise in the mesh",
            "default": true,
            "advanced": false
          },
          {
            "name": "removeBackground",
            "type": "boolean",
            "description": "Automatically remove background from the input image",
            "default": false,
            "advanced": false
          },
          {
            "name": "optimizeForWeb",
            "type": "boolean",
            "description": "Optimize model for web display (smaller file size)",
            "default": true,
            "advanced": false
          },
          {
            "name": "depthEstimation",
            "type": "enum",
            "description": "Algorithm for estimating depth information",
            "values": ["auto", "midas", "dpt", "zoe"],
            "default": "auto",
            "advanced": true
          },
          {
            "name": "meshAlgorithm",
            "type": "enum",
            "description": "Algorithm for generating 3D mesh",
            "values": ["marching_cubes", "poisson", "alpha_shape"],
            "default": "marching_cubes",
            "advanced": true
          },
          {
            "name": "simplification",
            "type": "integer",
            "description": "Reduce mesh complexity (0 = no simplification)",
            "min": 0,
            "max": 90,
            "step": 5,
            "default": 0,
            "advanced": true
          }
          ]
        }
     ```
   
   * The json file follows the schema specified in this `parameters.schema.json`:
    ```json
       {
          "$schema":"http://json-schema.org/draft-07/schema#",
          "title":"Parameters Schema",
          "description":"Schema for the specification of the parameters of the 3d reconstruction",
          "type":"object",
          "properties":{
            "version":{
              "type":"string"
            },
            "parameters":{
              "type":"array",
              "items":{
                "type":"object",
                "properties":{
                  "name":{
                    "type":"string"
                  },
                  "type":{
                    "type":"string",
                    "enum":[
                      "boolean",
                      "integer",
                      "float",
                      "string",
                      "enum"
                    ]
                  },
                  "description":{
                    "type":"string"
                  },
                  "values":{
                    "type":"array",
                    "items":{
        
                    }
                  },
                  "default":{
        
                  },
                  "required":{
                    "type":"boolean"
                  },
                  "advanced":{
                    "type":"boolean"
                  },
                  "min":{
                    "type":"number"
                  },
                  "max":{
                    "type":"number"
                  },
                  "step":{
                    "type":"number"
                  }
                },
                "required":[
                  "name",
                  "type",
                  "description",
                  "default",
                  "advanced"
                ],
                "dependentRequired":{
                  "min":[
                    "max"
                  ]
                }
              }
            }
          },
          "required":[
            "version",
            "parameters"
          ]
        }
    ```

2. **Server changes**

   * Remove the current hardcoded parameters from the server.
   * On startup, the server loads and validates `parameters.json`.
   * Add endpoint `GET /parameters` → returns the parameters JSON to the client.
   * Extend `POST /upload` to accept an additional JSON field `"parameters"` containing user-selected values (matching the schema).
   * Store the parameters in the fake job state (they don’t have to affect computation yet, just be logged).

3. **Web Client v0.2 changes**

   * On page load, the client requests `GET /parameters`.
   * Dynamically generate UI widgets based on the parameter definitions:

     * **boolean** → checkbox
     * **int/float** → slider (using min, max, step)
     * **enum** → dropdown
     * **string** → text input
   * Pre-fill widgets with default values.
   * When the user clicks "Start Processing", send selected parameter values in the same `POST /upload` request (together with the images).

4. **General rules**

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