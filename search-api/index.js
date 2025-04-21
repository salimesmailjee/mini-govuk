const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// Simple in-memory search index
let searchIndex = {};

// Build search index from content
async function buildSearchIndex() {
  try {
    const response = await axios.get('http://publishing-api:3000/published-content');
    const contents = response.data.contents;
    
    // Clear existing index
    searchIndex = {};
    
    // Build new index
    contents.forEach(content => {
      // Create searchable text based on content type
      let searchableText = content.title + ' ';
      
      if (content.document_type === 'simple-page') {
        searchableText += content.body;
      } else if (content.document_type === 'guide') {
        searchableText += content.introduction + ' ';
        content.parts.forEach(part => {
          searchableText += part.title + ' ' + part.body + ' ';
        });
      }
      
      // Store in search index with lowercase for easier searching
      searchIndex[content._id] = {
        id: content._id,
        path: content.path,
        title: content.title,
        type: content.document_type,
        text: searchableText.toLowerCase()
      };
    });
    
    console.log('Search index built with', Object.keys(searchIndex).length, 'documents');
  } catch (error) {
    console.error('Failed to build search index:', error.message);
  }
}

// Initial index build
buildSearchIndex();
// Rebuild index every 5 minutes
setInterval(buildSearchIndex, 5 * 60 * 1000);

// Search API endpoint
app.get('/search', (req, res) => {
  const query = (req.query.q || '').toLowerCase();
  
  if (!query) {
    return res.json({ results: [] });
  }
  
  // Simple search implementation
  const results = Object.values(searchIndex)
    .filter(item => item.text.includes(query))
    .map(item => ({
      id: item.id,
      title: item.title,
      path: item.path,
      type: item.type,
      // Calculate simple relevance score based on how early the term appears
      relevance: item.text.indexOf(query) === 0 ? 2 : 1
    }))
    // Sort by relevance
    .sort((a, b) => b.relevance - a.relevance);
  
  res.json({ results });
});

app.listen(3003, () => {
  console.log('Search API running on port 3003');
});
