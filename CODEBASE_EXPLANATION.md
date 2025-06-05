# Mini GOV.UK Codebase Explanation

## 1. System Architecture

This is a microservices-based content management system with four main components:

- **Publishing API (port 3000)**: Content storage backend using MongoDB
- **Frontend (port 3001)**: User interface with EJS templates
- **Router (port 3002)**: Routes incoming requests to appropriate services
- **Search API (port 3003)**: Provides search functionality
- **Content DB**: MongoDB database for storing content

## 2. Docker Compose (docker-compose.yml)

- Sets up the MongoDB database container
- Configures all four services (Publishing API, Frontend, Router, Search API)
- All services use Node.js 14 with persistent volume mounts
- Each service runs `npm install && npm start` on startup

## 3. Publishing API (publishing-api/index.js)

- Import dependencies and set up Express
- Connect to MongoDB
- Define content schemas for validation
  - Two content types: "simple-page" and "guide"
  - Each has required fields and validation rules
- MongoDB schema definition
  - Content states: "draft" or "published"
  - Content has path, title, and type-specific fields
- POST /content endpoint
  - Creates or updates content
  - Validates against schema
- GET /content/:path endpoint
  - Retrieves content by path
- GET /content endpoint
  - Lists all content
- Published content endpoints
  - Separate endpoints for published-only content
- POST /content/:id/publish endpoint
  - Changes content state to "published"
- Start server on port 3000

## 4. Frontend (frontend/index.js)

- Import dependencies and set up Express with EJS
- Homepage route
  - Fetches published content and renders index.ejs
- Content viewing route
  - Renders different templates based on content type
- Admin dashboard route
  - Lists all content for administration
- New content form routes
  - Creates empty content objects based on type
- Edit content form route
  - Loads existing content for editing
- Content saving route
  - Handles form submission for both content types
  - Processes guide parts from form data
- Content publishing route
  - Calls publishing API to publish content
- Search route
  - Interfaces with search API
- 404 page route
- Start server on port 3001

## 5. Router (router/index.js)

- Import dependencies and set up Express
- Create in-memory route cache
- Route cache management
  - Refreshes routes from Publishing API
  - Updates every 5 minutes
- Admin route handler
  - Proxies admin requests directly to frontend
  - Handles both GET and POST requests
- Regular content routing
  - Special cases for search and homepage
  - Uses route cache for fast lookups
  - Routes requests to frontend
- Start server on port 3002

## 6. Search API (search-api/index.js)

- Import dependencies and set up Express
- Create in-memory search index
- Search index management
  - Builds index from all published content
  - Updates every 5 minutes
  - Creates searchable text based on content type
- Search endpoint
  - Simple text-based search
  - Calculates basic relevance score
  - Returns sorted results
- Start server on port 3003

## 7. Frontend Templates

### index.ejs
- HTML setup with basic styling
- Search form
- List of published content
- Admin dashboard link

### admin.ejs
- Admin dashboard styling
- Content creation button
- Content table with actions
  - Shows title, type, status, and timestamps
  - Provides edit, view, and publish buttons

### content-simple-page.ejs
- Simple layout for basic page content
- Displays title and body

### content-guide.ejs
- More complex layout for guide-type content
- Table of contents with anchor links
- Sections for each guide part

## How It All Works Together:

1. **Router** acts as the entry point for all requests
   - Caches routes for faster lookups
   - Routes admin requests to frontend
   - Routes content requests based on path

2. **Publishing API** handles content management
   - Stores content in MongoDB
   - Validates content against schemas
   - Manages content states (draft/published)

3. **Frontend** provides the user interface
   - Admin interface for creating/editing content
   - Public interface for viewing content
   - Different templates for different content types

4. **Search API** provides search functionality
   - Maintains an in-memory search index
   - Updates index periodically
   - Performs simple text-based search

5. **Data Flow Example**: Creating and viewing content
   - User creates content via frontend admin
   - Frontend submits to publishing API
   - Publishing API validates and stores content
   - User publishes content via admin
   - Router refreshes route cache
   - Search API refreshes search index
   - Content becomes available at its path

This architecture separates concerns in a typical microservices pattern, with each service focused on a specific responsibility, communicating via HTTP APIs.
