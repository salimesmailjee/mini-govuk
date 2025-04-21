# Admin Route Bugfix Documentation

## Issue Description

The admin page in the mini-govuk project was not rendering properly, resulting in a 404 "Page not found" error when attempting to access the `/admin` route.

## Root Causes

Two main issues were identified:

1. **Router Proxy Implementation Issue**
   - The router service was using low-level Node HTTP requests to proxy admin routes
   - This implementation was inconsistent with the axios-based approach used for other routes
   - The error handling was insufficient, making debugging difficult

2. **Express Route Order Problem in Frontend**
   - In Express, routes are matched in the order they are defined
   - The generic wildcard content route (`/:path`) was defined before specific admin routes
   - Requests to `/admin` were being incorrectly matched as content paths, leading to 404s

## Applied Fixes

### 1. Router Service Fix

Modified the admin route proxy implementation in `router/index.js`:
- Replaced raw HTTP request with axios for consistency
- Added proper async/await handling
- Improved error reporting and logging
- Added explicit content-type handling

```javascript
// Old implementation used low-level http.request
// New implementation uses axios for consistency
app.use(async (req, res, next) => {
  if (req.originalUrl.startsWith('/admin')) {
    try {
      const targetUrl = `http://frontend:3001${req.originalUrl}`;
      console.log(`Proxying to: ${targetUrl}`);
      
      let response;
      if (req.method === 'GET') {
        response = await axios.get(targetUrl, {
          headers: { ...req.headers, host: 'frontend:3001' }
        });
      } else if (req.method === 'POST') {
        response = await axios.post(targetUrl, req.body, {
          headers: { ...req.headers, host: 'frontend:3001' }
        });
      }
      
      res.status(response.status);
      // Copy headers and send response data
      Object.entries(response.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      return res.send(response.data);
    } catch (error) {
      console.error('Proxy error:', error.message);
      return res.status(500).send('Error processing admin request');
    }
  }
  next();
});
```

### 2. Frontend Route Order Fix

Reorganized routes in `frontend/index.js` to ensure proper matching:
- Moved all admin-specific routes before the generic content route
- Added comment explaining the route order importance
- Maintained the same functionality while fixing the ordering issue

```javascript
// Homepage route (specific path)
app.get('/', async (req, res) => { /* ... */ });

// Admin routes defined BEFORE the wildcard content route
app.get('/admin', async (req, res) => { /* ... */ });
app.get('/admin/new', (req, res) => { /* ... */ });
app.get('/admin/new/:type', (req, res) => { /* ... */ });
app.get('/admin/edit/:path', async (req, res) => { /* ... */ });

// Generic content route (should be AFTER more specific routes)
app.get('/:path', async (req, res) => { /* ... */ });
```

## Testing

The fix was verified by:
1. Restarting the affected services: `docker restart mini-govuk-router-1 mini-govuk-frontend-1`
2. Testing admin access: `curl -i http://localhost:3002/admin`
3. Confirming the page renders correctly with HTTP 200 status

## Lessons Learned

1. **Route Order Matters**: In Express, always define more specific routes before generic ones
2. **Consistent API Patterns**: Use consistent approaches for similar functionality across services
3. **Proper Error Handling**: Ensure proxy implementations have proper error handling and logging
4. **Microservice Testing**: Test both direct service access and access through routing layers

## Future Improvements

1. Add integration tests to catch routing issues early
2. Consider implementing a more robust service mesh or API gateway
3. Add health checks to detect and report connectivity issues between services
4. Improve logging to include request IDs for better request tracing