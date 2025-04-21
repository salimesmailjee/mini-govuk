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
        response = await axios.post(targetUrl, req.body, requestConfig);
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
app.get('/:path(*)', async (req, res) => {
  const path = req.params.path || '';
  
  // Special case for search
  if (path.startsWith('search')) {
    try {
      const query = req.query.q ? `?q=${encodeURIComponent(req.query.q)}` : '';
      const response = await axios.get(`http://frontend:3001/search${query}`);
      return res.send(response.data);
    } catch (error) {
      return res.status(500).send('Error processing search request');
    }
  }
  
  // Special case for the homepage
  if (path === '') {
    try {
      const response = await axios.get('http://frontend:3001/');
      return res.send(response.data);
    } catch (error) {
      return res.status(500).send('Error processing homepage request');
    }
  }
  
  // Check if path exists in our route cache
  const route = routeCache[path];
  if (!route) {
    try {
      const response = await axios.get('http://frontend:3001/404');
      return res.status(404).send(response.data);
    } catch (error) {
      return res.status(404).send('Page not found');
    }
  }
  
  // Route the request to the appropriate frontend
  try {
    const response = await axios.get(`http://frontend:3001/${path}`);
    return res.send(response.data);
  } catch (error) {
    return res.status(500).send('Error processing content request');
  }
});

app.listen(3002, () => {
  console.log('Router running on port 3002');
});
