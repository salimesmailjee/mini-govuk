const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Simple in-memory route cache
const routeCache = {};

// Refresh routes from Publishing API
async function refreshRoutes() {
  console.log('Attempting to refresh routes from Publishing API...');
  try {
    const response = await axios.get('http://publishing-api:3000/published-content');
    const contents = response.data.contents;
    
    // Clear existing cache
    Object.keys(routeCache).forEach(key => delete routeCache[key]);
    
    // Populate cache with new routes
    contents.forEach(content => {
      routeCache[content.path] = {
        contentId: content._id,
        documentType: content.document_type
      };
    });
    
    console.log('Route cache refreshed with', Object.keys(routeCache).length, 'published routes');
  } catch (error) {
    console.error('Failed to refresh routes:', error.message);
  }
}

// Initial route load
refreshRoutes();
// Refresh routes every 5 minutes
setInterval(refreshRoutes, 5 * 60 * 1000);

// Special middleware to handle admin routes
app.use(async (req, res, next) => {
  console.log(`Request: ${req.method} ${req.originalUrl}`);
  
  // Specifically handle /admin path
  if (req.originalUrl.startsWith('/admin')) {
    console.log('Admin route detected, proxying to frontend');
    
    // Use axios for consistency with other routes
    try {
      const targetUrl = `http://frontend:3001${req.originalUrl}`;
      console.log(`Proxying to: ${targetUrl}`);
      
      // Create axios request config with proper headers
      const requestConfig = {
        headers: {
          ...req.headers,
          host: 'frontend:3001'
        },
        // Important: set validateStatus to accept 304 as valid status
        validateStatus: (status) => status >= 200 && status < 500,
        // Important: set responseType to handle both regular and 304 responses
        responseType: 'text'
      };
      
      // Handle different HTTP methods
      let response;
      if (req.method === 'GET') {
        response = await axios.get(targetUrl, requestConfig);
      } else if (req.method === 'POST') {
        // Get the Content-Type header
        const contentType = req.headers['content-type'] || '';
        
        // Create appropriate request options
        let requestConfig = {
          headers: {
            ...req.headers,
            host: 'frontend:3001'
          },
          validateStatus: (status) => status >= 200 && status < 500,
          responseType: 'text'
        };
        
        // If this is a form submission, properly format the data
        if (contentType.includes('application/x-www-form-urlencoded')) {
          console.log('Form submission detected, formatting data properly for frontend');
          // Convert to URLSearchParams format which axios will properly send as form data
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries(req.body)) {
            if (Array.isArray(value)) {
              // Handle array values (like multiple parts in a guide)
              value.forEach(item => params.append(key, item));
            } else {
              params.append(key, value);
            }
          }
          // Send as URLSearchParams which axios will encode properly
          response = await axios.post(targetUrl, params, requestConfig);
        } else {
          // For JSON or other content types, send as is
          response = await axios.post(targetUrl, req.body, requestConfig);
        }
      }
      
      // Set response status and headers
      res.status(response.status);
      Object.entries(response.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      
      // For 304 responses, just end the response without a body
      if (response.status === 304) {
        console.log('Sending 304 Not Modified response');
        return res.end();
      }
      
      // For normal responses, send the data
      return res.send(response.data);
    } catch (error) {
      console.error('Proxy error:', error.message);
      return res.status(500).send('Error processing admin request');
    }
  }
  
  next();
});

// Regular route handling for non-admin routes
// In router/index.js - Replace or simplify the route handler

app.get('/:path(*)', async (req, res) => {
  const path = req.params.path || '';
  console.log(`Router handling GET request for path: "${path}"`);
  
  // Special handling for homepage
  if (path === '') {
    targetUrl = 'http://frontend:3001/';
  } 
  // Special handling for search
  else if (path.startsWith('search')) {
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    targetUrl = `http://frontend:3001/search${queryString}`;
  }
  // Default handling
  else {
    targetUrl = `http://frontend:3001/${path}`;
  }
  
  console.log(`Proxying request to: ${targetUrl}`);
  
  try {
    // Very basic Axios request with minimal configuration
    const response = await axios({
      method: 'get',
      url: targetUrl,
      // Don't transform response data in any way
      transformResponse: [(data) => data],
      // Longer timeout to help debugging
      timeout: 10000,
      // Accept all status codes to handle them manually
      validateStatus: () => true
    });
    
    // Send status code from the proxied response
    res.status(response.status);
    
    // Set basic content-type headers
    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }
    
    // Send the response directly
    return res.send(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    return res.status(500).send('Service communication error');
  }
});

app.listen(3002, () => {
  console.log('Router running on port 3002');
});
