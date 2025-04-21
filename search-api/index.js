const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// Enhanced search index structure
const searchIndex = {
  documents: {},
  tokenizedIndex: {}, // For faster lookup by token
};

let lastIndexedTime = null;

// Helper function to tokenize text for better search
function tokenizeText(text) {
  // Convert to lowercase, remove punctuation, and split into words
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1); // Filter out short tokens
}

// Function to generate a snippet of text containing search terms
function generateSnippet(text, queryTokens, maxLength = 160) {
  if (!text || !queryTokens || queryTokens.length === 0) {
    return text.substring(0, maxLength) + '...';
  }
  
  const lowerText = text.toLowerCase();
  
  // Find the position of the first query token in the text
  let bestPosition = -1;
  for (const token of queryTokens) {
    const position = lowerText.indexOf(token);
    if (position !== -1 && (bestPosition === -1 || position < bestPosition)) {
      bestPosition = position;
    }
  }
  
  // If no token found, return the beginning of the text
  if (bestPosition === -1) {
    return text.substring(0, maxLength) + '...';
  }
  
  // Calculate snippet start and end positions
  let startPos = Math.max(0, bestPosition - 60);
  let endPos = Math.min(text.length, startPos + maxLength);
  
  // Adjust to avoid cutting words
  while (startPos > 0 && text[startPos] !== ' ') {
    startPos--;
  }
  
  while (endPos < text.length && text[endPos] !== ' ') {
    endPos++;
  }
  
  let snippet = text.substring(startPos, endPos);
  
  // Add ellipsis if needed
  if (startPos > 0) {
    snippet = '...' + snippet;
  }
  
  if (endPos < text.length) {
    snippet += '...';
  }
  
  return snippet;
}

// Build initial search index
async function buildSearchIndex() {
  try {
    console.log('Building complete search index...');
    const response = await axios.get('http://publishing-api:3000/published-content');
    const contents = response.data.contents;
    
    // Clear existing index
    searchIndex.documents = {};
    searchIndex.tokenizedIndex = {};
    
    // Build new index
    contents.forEach(content => {
      indexDocument(content);
    });
    
    lastIndexedTime = new Date();
    console.log('Search index built with', Object.keys(searchIndex.documents).length, 'documents');
  } catch (error) {
    console.error('Failed to build search index:', error.message);
  }
}

// Helper to add or update a document in the index
function indexDocument(content) {
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
  
  // Remove old document from tokenized index if it exists
  if (searchIndex.documents[content._id]) {
    const oldTokens = tokenizeText(searchIndex.documents[content._id].text);
    oldTokens.forEach(token => {
      if (searchIndex.tokenizedIndex[token]) {
        searchIndex.tokenizedIndex[token].delete(content._id);
        
        // Clean up empty token entries
        if (searchIndex.tokenizedIndex[token].size === 0) {
          delete searchIndex.tokenizedIndex[token];
        }
      }
    });
  }
  
  // Store the document
  searchIndex.documents[content._id] = {
    id: content._id,
    path: content.path,
    title: content.title,
    type: content.document_type,
    text: searchableText.toLowerCase(),
    updatedAt: content.updatedAt
  };
  
  // Tokenize the text and add to inverted index
  const tokens = tokenizeText(searchableText);
  const uniqueTokens = [...new Set(tokens)];
  
  uniqueTokens.forEach(token => {
    if (!searchIndex.tokenizedIndex[token]) {
      searchIndex.tokenizedIndex[token] = new Set();
    }
    searchIndex.tokenizedIndex[token].add(content._id);
  });
}

// Incremental index update
async function incrementalIndexUpdate() {
  try {
    if (!lastIndexedTime) {
      return buildSearchIndex();
    }
    
    console.log('Performing incremental index update...');
    
    // Query for content updated since last indexing
    const timeQuery = lastIndexedTime.toISOString();
    const response = await axios.get(`http://publishing-api:3000/content`);
    const allContent = response.data.contents;
    
    // Filter locally by updatedAt (since publishing API doesn't support query params)
    const updatedContents = allContent.filter(content => {
      return new Date(content.updatedAt) > lastIndexedTime && content.state === 'published';
    });
    
    if (updatedContents.length === 0) {
      console.log('No new or updated content to index');
      return;
    }
    
    console.log(`Updating index with ${updatedContents.length} changed documents`);
    
    // Update index for each changed document
    updatedContents.forEach(content => {
      indexDocument(content);
    });
    
    lastIndexedTime = new Date();
    console.log('Index incrementally updated');
  } catch (error) {
    console.error('Failed to update search index:', error.message);
  }
}

// Search API endpoint
app.get('/search', (req, res) => {
  const query = (req.query.q || '').toLowerCase();
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;
  const type = req.query.type || null;
  
  if (!query) {
    return res.json({ 
      results: [], 
      total: 0, 
      page, 
      pageSize, 
      totalPages: 0 
    });
  }
  
  // Break the query into tokens
  const queryTokens = tokenizeText(query);
  if (queryTokens.length === 0) {
    return res.json({ 
      results: [], 
      total: 0, 
      page, 
      pageSize, 
      totalPages: 0 
    });
  }
  
  // Find matching document IDs from the token index
  let matchingIds = new Set();
  let isFirstToken = true;
  
  queryTokens.forEach(token => {
    const matchingDocsForToken = searchIndex.tokenizedIndex[token] || new Set();
    
    if (isFirstToken) {
      matchingIds = new Set(matchingDocsForToken);
      isFirstToken = false;
    } else {
      // Intersection with previous results (AND logic)
      matchingIds = new Set(
        [...matchingIds].filter(id => matchingDocsForToken.has(id))
      );
    }
  });
  
  // Convert to array of documents and calculate relevance
  let results = [...matchingIds]
    .map(id => {
      const doc = searchIndex.documents[id];
      
      // Skip if type filter doesn't match
      if (type && doc.type !== type) {
        return null;
      }
      
      // Calculate relevance score
      const titleText = doc.title.toLowerCase();
      let relevance = 0;
      
      // Title matches are more important
      queryTokens.forEach(token => {
        if (titleText.includes(token)) {
          relevance += 3;
          if (titleText.startsWith(token)) {
            relevance += 2;
          }
        }
        
        // Full text matches
        if (doc.text.includes(token)) {
          relevance += 1;
        }
      });
      
      if (relevance === 0) {
        return null;
      }
      
      // Generate text snippet with context around search terms
      const snippet = generateSnippet(doc.text, queryTokens);
      
      return {
        id: doc.id,
        title: doc.title,
        path: doc.path,
        type: doc.type,
        snippet,
        updatedAt: doc.updatedAt,
        relevance
      };
    })
    .filter(item => item !== null) // Remove null items (non-matching type filter)
    .sort((a, b) => b.relevance - a.relevance); // Sort by relevance score
  
  // Apply pagination
  const total = results.length;
  const startIndex = (page - 1) * pageSize;
  const paginatedResults = results.slice(startIndex, startIndex + pageSize);
  
  res.json({ 
    results: paginatedResults, 
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    documents: Object.keys(searchIndex.documents).length,
    lastIndexed: lastIndexedTime?.toISOString() || null
  });
});

// Initial setup
async function initializeSearchAPI() {
  // Build initial index
  await buildSearchIndex();
  
  // Schedule incremental updates every minute
  setInterval(incrementalIndexUpdate, 1 * 60 * 1000);
  
  // Schedule full rebuild every hour
  setInterval(buildSearchIndex, 60 * 60 * 1000);
  
  // Start the server
  app.listen(3003, () => {
    console.log('Search API running on port 3003');
  });
}

// Start the application
initializeSearchAPI();