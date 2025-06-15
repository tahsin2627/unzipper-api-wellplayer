// FILE: server.js
// Final version with robust error handling for the GoFile API.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(cors());

// Get the GoFile Token from the environment variables for security.
// Make sure this is set in your Render dashboard!
const GOFILE_TOKEN = process.env.GOFILE_TOKEN;

// A simple endpoint to check if the server is running
app.get('/', (req, res) => {
  res.send('WellPlayer Smart Unzipper API is running!');
});

// The main proxy endpoint
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send('Error: "url" query parameter is required.');
  }

  // --- GoFile Specific Logic ---
  if (targetUrl.includes('gofile.io/d/')) {
    if (!GOFILE_TOKEN) {
        console.error("[GoFile] Server is missing the GOFILE_TOKEN environment variable.");
        return res.status(500).send('Server configuration error: GoFile API token is not set.');
    }

    const contentId = targetUrl.split('/').pop();
    console.log(`[GoFile] Detected GoFile link. Content ID: ${contentId}`);

    try {
      // Step 1: Call the GoFile API to get the file details.
      const apiResponse = await axios.get(`https://api.gofile.io/getContent?contentId=${contentId}`, {
        headers: {
          'Authorization': `Bearer ${GOFILE_TOKEN}`
        }
      });

      // Step 1a: Check if the API call was successful.
      if (apiResponse.data.status !== 'ok') {
        // This handles errors like "Content not found" or "Invalid token".
        const errorMessage = apiResponse.data.data.message || 'GoFile API returned an unknown error.';
        console.error(`[GoFile] API Error: ${errorMessage}`);
        throw new Error(`GoFile says: ${errorMessage}`);
      }
      
      // Step 2: Find the direct download link from the response.
      const contents = apiResponse.data.data.contents;
      const firstFileKey = Object.keys(contents)[0];
      const directLink = contents[firstFileKey].directLink;

      if (!directLink) {
        throw new Error('Could not find a direct download link in the GoFile API response.');
      }
      
      console.log(`[GoFile] Found direct link. Attempting to stream: ${directLink}`);

      // Step 3: Fetch the file from the direct link.
      const fileResponse = await axios({
        method: 'get',
        url: directLink,
        responseType: 'stream',
        headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
        }
      });

      // Step 3a: Stream the file back to the user.
      console.log(`[GoFile] Streaming file to user.`);
      res.setHeader('Content-Type', fileResponse.headers['content-type'] || 'application/zip');
      fileResponse.data.pipe(res);

    } catch (error) {
      // This will catch any error from the try block, including the 404 from GoFile.
      console.error('[GoFile] Proxy failed:', error.message);
      res.status(502).send(`Error processing GoFile link: ${error.message}`);
    }

  } else {
    // Fallback for other generic URLs (less reliable).
    console.log(`[Generic] Attempting to proxy: ${targetUrl}`);
    try {
      const response = await axios({
        method: 'get',
        url: targetUrl,
        responseType: 'stream'
      });
      response.data.pipe(res);
    } catch (error) {
       console.error('[Generic] Proxy failed:', error.message);
       res.status(502).send('Error fetching the file. The server may be blocking the proxy.');
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
