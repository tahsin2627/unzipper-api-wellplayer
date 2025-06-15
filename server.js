// FILE: server.js
// Final version with official GoFile API support

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(cors());

// Get the GoFile Token from the environment variables for security
const GOFILE_TOKEN = process.env.GOFILE_TOKEN;

app.get('/', (req, res) => {
  res.send('WellPlayer Smart Unzipper API is running!');
});

app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send('Error: "url" query parameter is required.');
  }

  // --- GoFile Specific Logic ---
  if (targetUrl.includes('gofile.io/d/')) {
    if (!GOFILE_TOKEN) {
        return res.status(500).send('GoFile API token is not configured on the server.');
    }

    const contentId = targetUrl.split('/').pop();
    console.log(`[GoFile] Detected GoFile link. Content ID: ${contentId}`);

    try {
      // 1. Call the GoFile API to get the file details
      const apiResponse = await axios.get(`https://api.gofile.io/getContent?contentId=${contentId}`, {
        headers: {
          'Authorization': `Bearer ${GOFILE_TOKEN}`
        }
      });

      if (apiResponse.data.status !== 'ok') {
        throw new Error(apiResponse.data.data.message || 'GoFile API returned an error.');
      }
      
      // 2. Find the direct download link from the response
      // We need to get the 'directLink' for the specific file inside the folder
      const contents = apiResponse.data.data.contents;
      const firstFileKey = Object.keys(contents)[0];
      const directLink = contents[firstFileKey].directLink;

      if (!directLink) {
        throw new Error('Could not find a direct download link in the GoFile API response.');
      }
      
      console.log(`[GoFile] Found direct link: ${directLink}`);

      // 3. Fetch the file from the direct link
      const fileResponse = await axios({
        method: 'get',
        url: directLink,
        responseType: 'stream',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      res.setHeader('Content-Type', fileResponse.headers['content-type'] || 'application/zip');
      fileResponse.data.pipe(res);

    } catch (error) {
      console.error('[GoFile] Error:', error.message);
      res.status(502).send(`Error processing GoFile link: ${error.message}`);
    }

  } else {
    // --- Fallback for other generic URLs ---
    console.log(`[Generic] Attempting to proxy: ${targetUrl}`);
    try {
      const response = await axios({
        method: 'get',
        url: targetUrl,
        responseType: 'stream',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
      response.data.pipe(res);
    } catch (error) {
       console.error('[Generic] Error:', error.message);
       res.status(502).send('Error fetching the file. The server may be blocking the proxy.');
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
