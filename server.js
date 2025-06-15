const express = require('express');
const axios = require('axios');
const cors = require('cors');
const url = require('url');

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(cors());

app.get('/', (req, res) => {
  res.send('WellPlayer Unzipper API is active and running!');
});

app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send('Error: "url" query parameter is required.');
  }

  console.log(`[${new Date().toISOString()}] - Received proxy request for: ${targetUrl}`);

  try {
    // We will now spoof the 'Referer' header to make the request look more legitimate.
    const referer = new URL(targetUrl).origin + '/';

    const response = await axios({
      method: 'get',
      url: targetUrl,
      responseType: 'stream',
      timeout: 45000, // Increased timeout to 45 seconds
      headers: {
        // A more modern User-Agent string
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        // Adding the Referer header
        'Referer': referer
      }
    });
    
    console.log(`[${new Date().toISOString()}] - Successfully connected. Streaming response...`);

    res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    
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
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Error Data:', error.response.data);
      console.error('Error Status:', error.response.status);
      console.error('Error Headers:', error.response.headers);
      res.status(error.response.status).send(`Target server responded with error: ${error.response.status}`);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Error Request:', error.request);
      res.status(504).send('No response received from target server. It may be down or blocking the proxy.');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error Message:', error.message);
      res.status(500).send(`Error setting up the request: ${error.message}`);
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
