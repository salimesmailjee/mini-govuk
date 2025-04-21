const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect('mongodb://content-db:27017/content_store', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false
});

// Define content schema validators
const contentSchemas = {
  'simple-page': {
    required: ['title', 'body'],
    validate: (content) => {
      if (!content.title || !content.body) {
        return 'Title and body are required for simple pages';
      }
      return null;
    }
  },
  'guide': {
    required: ['title', 'introduction', 'parts'],
    validate: (content) => {
      if (!content.title || !content.introduction) {
        return 'Title and introduction are required for guides';
      }
      if (!Array.isArray(content.parts) || content.parts.length === 0) {
        return 'Guides must have at least one part';
      }
      for (const part of content.parts) {
        if (!part.title || !part.body) {
          return 'All guide parts must have a title and body';
        }
      }
      return null;
    }
  }
};

// Create a content schema
const ContentSchema = new mongoose.Schema({
  title: String,
  body: String,
  introduction: String,
  parts: [{ title: String, body: String }],
  document_type: { type: String, enum: Object.keys(contentSchemas), required: true },
  path: { type: String, unique: true },
  state: { type: String, enum: ['draft', 'published'], default: 'draft' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  publishedAt: Date
});

const Content = mongoose.model('Content', ContentSchema);

// API to create or update content
app.post('/content', async (req, res) => {
  try {
    const { path, document_type, ...contentData } = req.body;
    
    // Validate against schema
    const schema = contentSchemas[document_type];
    if (!schema) {
      return res.status(400).json({ 
        success: false, 
        error: `Unknown document type: ${document_type}` 
      });
    }
    
    const validationError = schema.validate(contentData);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }
    
    const content = await Content.findOneAndUpdate(
      { path }, 
      { ...contentData, document_type, updatedAt: Date.now() }, 
      { upsert: true, new: true }
    );
    
    res.json({ success: true, content });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API to get content
app.get('/content/:path', async (req, res) => {
  try {
    const path = req.params.path;
    const content = await Content.findOne({ path });
    
    if (!content) {
      return res.status(404).json({ success: false, error: 'Content not found' });
    }
    
    res.json({ success: true, content });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API to list all content
app.get('/content', async (req, res) => {
  try {
    const contents = await Content.find({}).sort('-updatedAt');
    res.json({ success: true, contents });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Separate API to get published content
app.get('/published-content/:path', async (req, res) => {
  try {
    const path = req.params.path;
    const content = await Content.findOne({ path, state: 'published' });
    
    if (!content) {
      return res.status(404).json({ success: false, error: 'Content not found' });
    }
    
    res.json({ success: true, content });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API to list all published content
app.get('/published-content', async (req, res) => {
  try {
    const contents = await Content.find({ state: 'published' }).sort('-publishedAt');
    res.json({ success: true, contents });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API to publish content
app.post('/content/:id/publish', async (req, res) => {
  try {
    const id = req.params.id;
    const content = await Content.findByIdAndUpdate(
      id,
      { state: 'published', publishedAt: Date.now() },
      { new: true }
    );
    
    if (!content) {
      return res.status(404).json({ success: false, error: 'Content not found' });
    }
    
    res.json({ success: true, content });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Publishing API running on port 3000');
});
