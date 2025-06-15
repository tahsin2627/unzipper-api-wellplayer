// FILE: server.js
// This is the actual proxy server code.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
// Render sets the PORT environment variable for us.
const PORT = process.env.PORT || 3000; 

// Use the cors middleware to allow requests from any origin.
// This is important so your Netlify app can talk to your Render app.
app.use(cors());

// A simple endpoint to check if the server is running
app.get('/', (req, res) => {
  console.log("Health check endpoint was hit.");
  res.send('WellPlayer Unzipper API is active and running!');
});

// The main proxy endpoint
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    console.log("Request failed: URL parameter is missing.");
    return res.status(400).send('Error: "url" query parameter is required.');
  }

  console.log(`[${new Date().toISOString()}] - Received proxy request for: ${targetUrl}`);

  try {
    const response = await axios({
      method: 'get',
      url: targetUrl,
      responseType: 'stream',
      // Adding a timeout to prevent requests from hanging indefinitely
      timeout: 30000, // 30 seconds
      // It's important to pass on the user-agent of a real browser
      // as some sites block requests from servers.
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': targetUrl // Some sites require a referer header
      }
    });

    console.log(`[${new Date().toISOString()}] - Successfully connected to target. Streaming response...`);

    // Pass the original headers to the client
    res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    if (response.headers['content-disposition']) {
        res.setHeader('Content-Disposition', response.headers['content-disposition']);
    }
    
    // Pipe the file stream to the response
    response.data.pipe(res);

    // Handle errors on the stream
    response.data.on('error', (err) => {
        console.error(`[${new Date().toISOString()}] - Stream error while proxying:`, err.message);
        if (!res.headersSent) {
            res.status(500).send('Error during file stream.');
        }
        res.end();
    });


  } catch (error) {
    console.error(`[${new Date().toISOString()}] - Proxy Error:`, error.message);
    // Provide more specific error messages
    if (error.code === 'ECONNABORTED') {
        res.status(504).send(`Error: The request to the target server timed out.`);
    } else {
        res.status(502).send(`Error fetching the file via proxy: ${error.message}`);
    }
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
