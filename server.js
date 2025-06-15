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
  res.send('WellPlayer Unzipper API is running!');
});

// The main proxy endpoint
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send('Error: "url" query parameter is required.');
  }

  console.log(`Proxying request for: ${targetUrl}`);

  try {
    const response = await axios({
      method: 'get',
      url: targetUrl,
      responseType: 'stream',
      // It's important to pass on the user-agent of a real browser
      // as some sites block requests from servers.
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
      }
    });

    // Pass the original headers to the client
    res.setHeader('Content-Type', response.headers['content-type']);
    res.setHeader('Content-Length', response.headers['content-length']);
    res.setHeader('Content-Disposition', response.headers['content-disposition']);
    
    // Pipe the file stream to the response
    response.data.pipe(res);

  } catch (error) {
    console.error('Proxy Error:', error.message);
    res.status(502).send(`Error fetching the file via proxy: ${error.message}`);
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
