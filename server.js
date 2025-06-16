// FILE: server.js
// Final version with a dedicated endpoint for scraping video links.

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cheerio = require('cheerio'); // Our new "detective" tool

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(cors());

// A simple endpoint to check if the server is running
app.get('/', (req, res) => {
  res.send('WellPlayer Scraper & Unzipper API is active!');
});

// NEW SCRAPER ENDPOINT for finding video links on pages
app.get('/scrape-video', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).json({ error: 'URL query parameter is required.' });
    }

    console.log(`[Scraper] - Received request for: ${targetUrl}`);

    try {
        // 1. Fetch the HTML content of the share page
        const { data: html } = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
            }
        });

        // 2. Load the HTML into Cheerio to search it
        const $ = cheerio.load(html);

        // 3. Find the direct video link. 
        // We look for a <source> tag inside a <video> tag and get its 'src' attribute.
        // This selector is specifically tailored for sites like NeonDrive.
        const videoSrc = $('video#player source').attr('src') || $('video source').attr('src') || $('video').attr('src');
        
        if (videoSrc) {
            console.log(`[Scraper] - Found video link: ${videoSrc}`);
            // 4. Send the direct link back to the front-end
            res.json({ directLink: videoSrc });
        } else {
            console.log(`[Scraper] - Could not find a video source on the page.`);
            res.status(404).json({ error: 'Could not find a playable video source on the provided page.' });
        }

    } catch (error) {
        console.error(`[Scraper] - Error: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch or process the page.' });
    }
});


// Existing ZIP proxy endpoint (we keep this for direct ZIP downloads)
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) { return res.status(400).send('Error: "url" query parameter is required.'); }
    console.log(`[Proxy] - Received request for: ${targetUrl}`);
    try {
        const response = await axios({ method: 'get', url: targetUrl, responseType: 'stream', timeout: 60000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36', 'Referer': targetUrl }
        });
        res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        if(response.headers['content-length']) res.setHeader('Content-Length', response.headers['content-length']);
        if(response.headers['content-disposition']) res.setHeader('Content-Disposition', response.headers['content-disposition']);
        response.data.pipe(res);
    } catch (error) {
        console.error(`[Proxy] - Error: ${error.message}`);
        res.status(502).send(`Error fetching file via proxy.`);
    }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
