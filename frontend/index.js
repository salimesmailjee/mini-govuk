const express = require('express');
const axios = require('axios');

const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Homepage - list all content
app.get('/', async (req, res) => {
  try {
    const response = await axios.get('http://publishing-api:3000/published-content');
    res.render('index', { contents: response.data.contents });
  } catch (error) {
    res.render('error', { error: error.message });
  }
});

// Admin routes should be defined before the wildcard content route
// Admin page - list all content with edit links
app.get('/admin', async (req, res) => {
  try {
    const response = await axios.get('http://publishing-api:3000/content');
    res.render('admin', { 
      contents: response.data.contents,
      // Add a simple helper to format dates
      formatDate: (date) => date ? new Date(date).toLocaleString() : 'Not published'
    });
  } catch (error) {
    res.render('error', { error: error.message });
  }
});

// New content form with document type selection
app.get('/admin/new', (req, res) => {
  res.render('select-type');
});

// New content form for specific document type
app.get('/admin/new/:type', (req, res) => {
  const type = req.params.type;
  let content = { document_type: type, path: '' };
  
  if (type === 'simple-page') {
    content.title = '';
    content.body = '';
  } else if (type === 'guide') {
    content.title = '';
    content.introduction = '';
    content.parts = [{ title: '', body: '' }];
  }
  
  res.render(`edit-${type}`, { content, isNew: true });
});

// Edit content form
app.get('/admin/edit/:path', async (req, res) => {
  try {
    const path = req.params.path;
    const response = await axios.get(`http://publishing-api:3000/content/${path}`);
    const content = response.data.content;
    
    if (content.document_type === 'simple-page') {
      res.render('edit-simple-page', { content, isNew: false });
    } else if (content.document_type === 'guide') {
      res.render('edit-guide', { content, isNew: false });
    } else {
      res.render('error', { error: 'Unknown content type' });
    }
  } catch (error) {
    res.render('error', { error: error.message });
  }
});

// View content page
app.get('/:path', async (req, res) => {
  try {
    const path = req.params.path;
    const response = await axios.get(`http://publishing-api:3000/published-content/${path}`);
    const content = response.data.content;
    
    // Render different templates based on document_type
    if (content.document_type === 'simple-page') {
      res.render('content-simple-page', { content });
    } else if (content.document_type === 'guide') {
      res.render('content-guide', { content });
    } else {
      res.render('error', { error: 'Unknown content type' });
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).render('error', { error: 'Page not found' });
    }
    res.render('error', { error: error.message });
  }
});

// Admin page - list all content with edit links
app.get('/admin', async (req, res) => {
  try {
    const response = await axios.get('http://publishing-api:3000/content');
    res.render('admin', { 
      contents: response.data.contents,
      // Add a simple helper to format dates
      formatDate: (date) => date ? new Date(date).toLocaleString() : 'Not published'
    });
  } catch (error) {
    res.render('error', { error: error.message });
  }
});

// New content form with document type selection
app.get('/admin/new', (req, res) => {
  res.render('select-type');
});

// New content form for specific document type
app.get('/admin/new/:type', (req, res) => {
  const type = req.params.type;
  let content = { document_type: type, path: '' };
  
  if (type === 'simple-page') {
    content.title = '';
    content.body = '';
  } else if (type === 'guide') {
    content.title = '';
    content.introduction = '';
    content.parts = [{ title: '', body: '' }];
  }
  
  res.render(`edit-${type}`, { content, isNew: true });
});

// Edit content form
app.get('/admin/edit/:path', async (req, res) => {
  try {
    const path = req.params.path;
    const response = await axios.get(`http://publishing-api:3000/content/${path}`);
    const content = response.data.content;
    
    if (content.document_type === 'simple-page') {
      res.render('edit-simple-page', { content, isNew: false });
    } else if (content.document_type === 'guide') {
      res.render('edit-guide', { content, isNew: false });
    } else {
      res.render('error', { error: 'Unknown content type' });
    }
  } catch (error) {
    res.render('error', { error: error.message });
  }
});

// Save content based on document type
app.post('/admin/save/:type', async (req, res) => {
  try {
    const type = req.params.type;
    let contentData = {};
    
    if (type === 'simple-page') {
      const { title, body, path } = req.body;
      contentData = { title, body, path, document_type: type };
    } else if (type === 'guide') {
      const { title, introduction, path, partTitles, partBodies } = req.body;
      const parts = [];
      
      // Convert form data to parts array
      const titles = Array.isArray(partTitles) ? partTitles : [partTitles];
      const bodies = Array.isArray(partBodies) ? partBodies : [partBodies];
      
      for (let i = 0; i < titles.length; i++) {
        parts.push({
          title: titles[i],
          body: bodies[i]
        });
      }
      
      contentData = { title, introduction, parts, path, document_type: type };
    }
    
    await axios.post('http://publishing-api:3000/content', contentData);
    res.redirect('/admin');
  } catch (error) {
    res.render('error', { error: error.message });
  }
});

// Publish content
app.post('/admin/publish/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await axios.post(`http://publishing-api:3000/content/${id}/publish`);
    res.redirect('/admin');
  } catch (error) {
    res.render('error', { error: error.message });
  }
});

// Search
app.get('/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    
    if (!query) {
      return res.render('search-results', { query, results: [] });
    }
    
    const response = await axios.get(`http://search-api:3003/search?q=${encodeURIComponent(query)}`);
    res.render('search-results', { query, results: response.data.results });
  } catch (error) {
    res.render('error', { error: error.message });
  }
});

app.get('/404', (req, res) => {
  res.status(404).render('error', { error: 'Page not found' });
});

app.listen(3001, () => {
  console.log('Frontend running on port 3001');
});
