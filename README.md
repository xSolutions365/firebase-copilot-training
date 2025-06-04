# Task Manager Frontend

A modern, responsive task management application built with vanilla JavaScript, featuring a space-themed UI and backend API integration. This app supports both online and offline functionality with automatic data synchronization.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 
- **npm** (comes with Node.js)
- **A backend API server** running on port 8080 (see API Requirements section)

## Quick Start

### 1. Clone and Install

```bash
# Clone the repository (or download the files)
cd firebase-test-project

# Install dependencies
npm install
```

### 2. Start the Development Server

```bash
# Start the frontend application
npm start
```

This will:
- Start the webpack development server on port 8081
- Automatically open your browser to http://localhost:8081
- Enable hot reloading for development

### 3. Verify API Connection

The application expects a backend API server to be running on `http://localhost:8080`. You can test the API connection by:

```bash
# Test if the API is available
curl http://localhost:8080/api/tasks

# Should return an empty array [] if no tasks exist
```

## API Requirements

This frontend application is designed to work with a backend API that follows the OpenAPI specification defined in `guidance/openapi.yaml`. The API should provide the following endpoints:

### Required Endpoints

- **GET** `/api/tasks` - Retrieve all tasks
- **POST** `/api/tasks` - Create a new task
- **DELETE** `/api/tasks/{id}` - Delete a task by ID

### Expected Task Object Format

```json
{
  "id": 1,
  "title": "Sample task title"
}
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the development server with hot reloading |
| `npm run build` | Build the application for production |
| `npm run dev` | Build the application in development mode |
| `npm test` | Run tests (currently placeholder) |

## Project Structure

```
firebase-test-project/
├── README.md                 # This file
├── INTEGRATION_PLAN.md      # Detailed integration plan and checklist
├── package.json             # Project dependencies and scripts
├── webpack.config.js        # Webpack configuration
├── firebase.json           # Firebase configuration
├── guidance/
│   └── openapi.yaml        # API specification
├── src/
│   ├── index.html          # Main HTML file
│   ├── css/
│   │   └── styles.css      # Custom styles and animations
│   └── js/
│       ├── index.js        # Main application logic
│       └── test-api.js     # API connectivity test script
└── dist/                   # Built files (generated)
```

## Configuration

### Environment Variables

The application automatically detects the environment:

- **Development**: API calls go to `http://localhost:8081/api/tasks` (proxied to port 8080)
- **Production**: API calls go to your production API URL (update in `src/js/index.js`)

### Webpack Proxy

The webpack development server is configured to proxy API requests from port 8081 to port 8080, avoiding CORS issues during development.

## How It Works

### Online Mode
- Tasks are fetched from and saved to the backend API
- Real-time synchronization with the server
- Visual API status indicator shows connection status

### Offline Mode
- Tasks are automatically saved to browser localStorage
- Full functionality available without internet connection
- Automatic sync when connection is restored
- Visual indicator shows offline status

### Data Flow
1. **Load**: App attempts to fetch tasks from API, falls back to localStorage if offline
2. **Create**: New tasks are sent to API, saved locally as backup
3. **Toggle**: Task completion status changes are synced with API
4. **Sync**: When connection is restored, local changes are synchronized with the API

## API Integration

The application integrates with a RESTful API using the following strategy:

### Task Completion Logic
Due to the API specification, task completion is handled as follows:
- **Mark as Complete**: Sends DELETE request to remove task from active list
- **Mark as Active**: Sends POST request to re-add the task
- Local state maintains completion status for UI purposes

### Error Handling
- Automatic retry with exponential backoff for failed requests
- Graceful fallback to local storage when API is unavailable
- User-friendly error messages with context

## Customization

### Styling
The application uses Tailwind CSS classes with custom CSS for animations. Modify `src/css/styles.css` to customize:
- Color scheme
- Animations
- Typography
- Layout

### API Configuration
To change the API endpoint, update the `API_BASE_URL` constant in `src/js/index.js`:

```javascript
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-production-api-url.com/api/tasks' 
  : 'http://localhost:8081/api/tasks';
```

## Troubleshooting

### Common Issues

**404 API Errors**
- Ensure the backend API server is running on port 8080
- Check that the API endpoints match the OpenAPI specification
- Verify the proxy configuration in `webpack.config.js`

**CORS Issues**
- The webpack proxy should handle CORS in development
- For production, ensure your API server allows requests from your frontend domain

**Tasks Not Persisting**
- Check browser console for API errors
- Verify localStorage is enabled in your browser
- Check the API status indicator in the footer

**Application Won't Start**
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for port conflicts
lsof -i :8081
```

### Testing API Connectivity

Use the included test script to verify API connectivity:

```bash
# Make the test script executable
chmod +x test-api.sh

# Run the API test
./test-api.sh
```

Or run the test directly with Node.js:

```bash
node src/js/test-api.js
```

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

The application uses modern JavaScript features and requires a recent browser version.

## Contributing

1. Follow the integration plan in `INTEGRATION_PLAN.md`
2. Test both online and offline functionality
3. Ensure API integration works correctly
4. Maintain the space theme and user experience

## License

This project is licensed under the ISC License - see the package.json file for details.
