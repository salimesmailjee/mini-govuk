# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands
- Start the entire application: `docker-compose up`
- Start specific service: `cd <service-dir> && npm start`
- Test changes locally: Run individual services with `node index.js`

## Code Style Guidelines
- Indentation: 2 spaces
- Quotes: Single quotes for strings
- JavaScript: Use ES6 features (arrow functions, async/await)
- Imports: Group Node built-ins first, then 3rd party modules
- Error handling: Use try/catch blocks with specific error messages
- Naming: camelCase for variables/functions, PascalCase for schemas
- API responses: Follow {success: boolean, data/error: any} pattern
- REST endpoints: Consistent RESTful patterns (/resource/:id)
- Comments: Use for API endpoint documentation and logic explanations

## Architecture
- Microservices: frontend, publishing-api, router, search-api
- Database: MongoDB for content storage
- Frontend: EJS templates with consistent styling
- Content types: "simple-page" and "guide" with validation rules