// FILE: server.js
// Final, most robust version with enhanced headers to mimic a real browser.

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const url = require('url'); // Import the URL module

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(cors());

// A simple endpoint to check if the server is running
app.get('/', (req, res) => {
  res.send('WellPlayer Unzipper API is active and running!');
});

// The main proxy endpoint
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send('Error: "url" query parameter is required.');
  }

  console.log(`[${new Date().toISOString()}] - Attempting to proxy: ${targetUrl}`);

  try {
    // Make the request look as much like a real browser as possible
    const response = await axios({
      method: 'get',
      url: targetUrl,
      responseType: 'stream',
      timeout: 60000, // Increased timeout to 60 seconds for large files
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        'Referer': new URL(targetUrl).origin + '/', // Act like the request is coming from the site itself
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    console.log(`[${new Date().toISOString()}] - Successfully connected. Streaming response...`);

    // Pass the original headers from the target server back to the client
    res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
     if (response.headers['content-disposition']) {
        res.setHeader('Content-Disposition', response.headers['content-disposition']);
    }
    
    // Pipe the file stream from the target server directly to the user
    response.data.pipe(res);

    response.data.on('error', (err) => {
        console.error(`[${new Date().toISOString()}] - Stream error:`, err.message);
        if (!res.headersSent) {
            res.status(500).send('Error during file stream.');
        }
        res.end();
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] - Proxy Error: ${error.message}`);
    if (error.response) {
      res.status(error.response.status).send(`Target server responded with error: ${error.response.status}`);
    } else if (error.request) {
      res.status(504).send('No response received from target server. It may be down or blocking the proxy.');
    } else {
      res.status(500).send(`Error setting up the request: ${error.message}`);
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
