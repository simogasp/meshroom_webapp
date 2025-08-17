# Web API Tester

A comprehensive web-based interface for testing the Meshroom WebApp backend API endpoints interactively.

## 🌟 Overview

The Web API Tester provides a visual, point-and-click interface for testing all backend functionality without requiring command-line tools or programming knowledge. It features real-time response logging, WebSocket monitoring, and automatic file handling.

![API Tester Interface](../../../assets/web-tester-screenshot.png)
*Split-screen interface with controls on the left and live response log on the right*

## 🚀 Quick Start

### 1. Start the Backend Server

```bash
# From the project root
cd src/backend/fake_backend
python server.py

# Or with custom options
python server.py --host 0.0.0.0 --port 8080 --real-model
```

### 2. Open the Web Tester

```bash
# From the project root
open src/frontend/web_api_tester/web_test.html

# Or double-click the file in your file manager
```

### 3. Test the Connection

1. Verify the Backend URL is correct (default: `http://localhost:8000`)
2. Click **"Test Connection"** to ensure the backend is reachable
3. You should see a green success message in the response log

## 🔧 Features

### 📊 Server Information

- **GET /** - Server status and configuration
- **GET /health** - Health check endpoint  
- **GET /jobs** - List all jobs with their status

### 📤 File Upload

- **Real File Upload**: Select images from your computer
- **Parameters JSON**: Provide a JSON object in the `parameters` field; leave empty to use server defaults from `parameters.json`
- **Auto Job ID Population**: Automatically fills job ID from successful uploads

### 🔧 Job Management

- **GET /jobs/{id}** - Check individual job status
- **GET /jobs/{id}/download** - Download 3D model (auto-download)
- **DELETE /jobs/{id}** - Cancel running jobs

### 🔄 Real-time WebSocket

- **Progress Monitoring**: Live updates during processing
- **Connection Management**: Connect/disconnect controls
- **Ping Testing**: Test WebSocket connectivity
- **Visual Status Indicators**: Clear connection state display

### ✨ Smart Features

- **Live Response Log**: All API calls and responses with timestamps
- **Error Highlighting**: Failed requests clearly marked in red
- **Automatic Downloads**: 3D models download automatically when ready
- **Configurable Backend**: Easy switching between different server instances
- **Clean Interface**: Split-screen design for efficient workflow

## 📋 Testing Workflow

### Basic Workflow

1. **Test Connection** → Verify backend is running
2. **Upload Images** → Use real files and provide optional parameters JSON
3. **Monitor Progress** → Connect WebSocket to see real-time updates
4. **Download Model** → Get the completed 3D model
5. **Review Logs** → Check all API responses

### Advanced Testing

1. **List Jobs** → See all current and past jobs
2. **Check Job Status** → Monitor specific job details
3. **Cancel Jobs** → Test job cancellation functionality
4. **WebSocket Ping** → Test connection stability
5. **Error Handling** → Try invalid requests to test error responses

## 🎯 API Endpoints Reference

| Method | Endpoint | Purpose | Parameters |
|--------|----------|---------|------------|
| GET | `/` | Server status | None |
| GET | `/health` | Health check | None |
| GET | `/jobs` | List all jobs | None |
| POST | `/upload` | Upload images | `files`, `parameters` (JSON object) |
| GET | `/jobs/{id}` | Job status | `id` (path parameter) |
| GET | `/jobs/{id}/download` | Download model | `id` (path parameter) |
| DELETE | `/jobs/{id}` | Cancel job | `id` (path parameter) |
| WS | `/ws/{id}` | Progress updates | `id` (path parameter) |

## 🔧 Configuration

### Backend URL

- Default: `http://localhost:8000`
- Configurable via the input field at the top
- Supports any host and port combination

### Upload Parameters

- Provide a JSON object in the **Parameters (JSON)** textarea, for example:
  ```json
  {
    "quality": "medium",
    "meshResolution": 1024,
    "optimizeForWeb": true
  }
  ```
- If omitted, the backend uses defaults from its `parameters.json` file.
- The available parameters and defaults can be retrieved via `GET /parameters`.

### WebSocket Settings

- Automatically converts HTTP URL to WebSocket URL
- Requires valid job ID for connection
- Supports heartbeat via ping/pong

## 🐛 Troubleshooting

### Common Issues

#### "Backend is not reachable"

- ✅ Ensure the backend server is running
- ✅ Check the Backend URL is correct
- ✅ Verify no firewall is blocking the connection
- ✅ Try `http://127.0.0.1:8000` instead of `localhost`

#### "WebSocket connection failed"

- ✅ Make sure you have a valid job ID
- ✅ Verify the backend supports WebSocket connections
- ✅ Check that the job hasn't already completed
- ✅ Try refreshing the page and reconnecting

#### "Upload failed"

- ✅ Ensure files are selected
- ✅ Validate the Parameters (JSON) is a valid JSON object
- ✅ Check file sizes aren't too large
- ✅ Verify the backend has proper upload permissions

#### "Download not working"

- ✅ Wait for job to complete (check WebSocket for 100% progress)
- ✅ Ensure browser allows downloads
- ✅ Check the job ID is correct
- ✅ Verify the backend has the model file ready

## 🔍 Response Log

The right panel shows all API interactions with detailed information:

- **Timestamps**: Precise timing of each request
- **Request Details**: Method, endpoint, and parameters
- **Response Status**: HTTP status codes and messages
- **Response Data**: Formatted JSON or file information
- **Error Highlighting**: Failed requests marked in red
- **Auto-scroll**: Automatically shows latest responses

### Log Colors

- **Green Border**: Successful requests (2xx status)
- **Red Border**: Failed requests (4xx, 5xx status)
- **Gray Text**: Timestamps and metadata
- **White Text**: Response content

## 🚀 Development Notes

### Browser Compatibility

- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **JavaScript**: ES6+ features used
- **WebSocket**: Native browser WebSocket API
- **File API**: For file upload handling

### Network Requirements

- **CORS**: Backend must allow cross-origin requests
- **WebSocket**: Backend must support WebSocket connections
- **File Upload**: Backend must handle multipart form data

### Security Considerations

- **Local Testing**: Designed for development/testing environments
- **No Authentication**: Direct API access without security
- **File Access**: Can read local files via browser file picker

## 📝 Tips & Best Practices

### Efficient Testing

1. Provide only the parameters you need in the JSON; the backend fills defaults
2. Keep the **WebSocket connected** during job processing for real-time updates
3. Use **Clear** button to keep the response log manageable
4. Test **error conditions** by providing invalid job IDs or parameters

### Debugging Backend Issues

1. Check the **response log** for detailed error messages
2. Use **Test Connection** regularly when developing
3. Monitor **WebSocket messages** for processing insights
4. Retrieve **available parameters** via `GET /parameters`

## 🔗 Related Documentation

- [Main README](../../../README.md) - Project overview and setup
- [Backend Documentation](../../backend/fake_backend/) - API implementation details
- [CLI Client](../fake_frontend/) - Command-line testing alternative
- [CHANGELOG](../../../CHANGELOG.md) - Version history and updates

## 🤝 Contributing

When modifying the web tester:

1. **Test thoroughly** across different browsers
2. **Update this documentation** for new features
3. **Follow the existing code style** and structure
4. **Consider accessibility** for all users
5. **Validate HTML/CSS/JavaScript** before committing

## 📄 License

This tool is part of the Meshroom WebApp project and is licensed under the same terms (Mozilla Public License 2.0).
