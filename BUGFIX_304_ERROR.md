# Bugfix: 304 Status Code Handling in Router Proxy

## Issue Description

After fixing the initial admin page routing issue, a new problem appeared: When a user clicks to go back to the admin page, the request would result in a 304 (Not Modified) status code that was being mishandled by the router's proxy implementation, causing an error. The page would load correctly on subsequent requests.

## Technical Background

HTTP 304 (Not Modified) is actually not an error but a valid response code. When browsers make conditional requests with headers like `If-None-Match` (ETag) or `If-Modified-Since`, servers can respond with 304 to indicate the content hasn't changed, allowing the browser to use its cached version.

The issue occurred because our router was:
1. Not properly handling 304 status codes returned by the frontend service
2. Treating them as errors instead of valid responses
3. Attempting to send response bodies when 304 responses should have empty bodies

## Root Cause

In our proxy implementation:
1. Axios was configured to treat any non-2xx status as an error (default behavior)
2. When a 304 response was received, it triggered the error handler
3. The proxy attempted to send a 500 error instead of properly forwarding the 304

## Fix Implementation

The fix involved three key changes to the router's admin proxy code:

1. Configure axios to accept 304 as a valid status:
```javascript
validateStatus: (status) => status >= 200 && status < 500,
```

2. Set appropriate response type to handle both regular and 304 responses:
```javascript
responseType: 'text'
```

3. Add special handling for 304 responses:
```javascript
// For 304 responses, just end the response without a body
if (response.status === 304) {
  console.log('Sending 304 Not Modified response');
  return res.end();
}
```

## Complete Code Change

```javascript
// Before: Didn't handle 304 responses properly
try {
  const targetUrl = `http://frontend:3001${req.originalUrl}`;
  console.log(`Proxying to: ${targetUrl}`);
  
  let response;
  if (req.method === 'GET') {
    response = await axios.get(targetUrl, {
      headers: {
        ...req.headers,
        host: 'frontend:3001'
      }
    });
  } else if (req.method === 'POST') {
    // POST handling
  }
  
  res.status(response.status);
  Object.entries(response.headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  return res.send(response.data);
} catch (error) {
  console.error('Proxy error:', error.message);
  return res.status(500).send('Error processing admin request');
}

// After: Properly handles 304 responses
try {
  const targetUrl = `http://frontend:3001${req.originalUrl}`;
  console.log(`Proxying to: ${targetUrl}`);
  
  const requestConfig = {
    headers: {
      ...req.headers,
      host: 'frontend:3001'
    },
    validateStatus: (status) => status >= 200 && status < 500,
    responseType: 'text'
  };
  
  let response;
  if (req.method === 'GET') {
    response = await axios.get(targetUrl, requestConfig);
  } else if (req.method === 'POST') {
    // POST handling with requestConfig
  }
  
  res.status(response.status);
  Object.entries(response.headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  // Special handling for 304
  if (response.status === 304) {
    console.log('Sending 304 Not Modified response');
    return res.end();
  }
  
  return res.send(response.data);
} catch (error) {
  console.error('Proxy error:', error.message);
  return res.status(500).send('Error processing admin request');
}
```

## Testing

The fix was verified by:
1. Restarting the router service: `docker restart mini-govuk-router-1`
2. Loading the admin page
3. Navigating away from the admin page
4. Using the browser back button to return to the admin page
5. Confirming that the admin page loads correctly without errors

## Web Caching Lesson

This issue demonstrates the importance of properly handling HTTP caching mechanisms:

1. **304 Not Modified**: This is an important optimization that allows browsers to reuse cached content
2. **ETag/If-None-Match**: These headers enable conditional requests to avoid transferring unchanged content
3. **Proxy Implementation**: When building proxies, all valid HTTP status codes must be properly handled

## Recommendations

1. When implementing proxies, always handle all valid HTTP status codes (including 304)
2. For Node.js applications, explicitly configure axios to accept non-2xx status codes as needed
3. Test proxy implementations with cached content and back-button scenarios
4. Use the Network tab in browser developer tools to verify proper caching behavior