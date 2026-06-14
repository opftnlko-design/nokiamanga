const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const MANGADEX_API = 'https://api.mangadex.org';

// Home Page: Basic search bar structured for low-res screens
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Nokia Manga</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { background: #000; color: #fff; font-family: monospace; padding: 10px; }
                input, button { padding: 5px; font-size: 14px; width: 100%; margin-bottom: 10px; }
            </style>
        </head>
        <body>
            <h2>Nokia 216 Manga Reader</h2>
            <form action="/search" method="GET">
                <input type="text" name="title" placeholder="Search manga title..." required />
                <button type="submit">Search</button>
            </form>
        </body>
        </html>
    `);
});

// Search Results Page
app.get('/search', async (req, res) => {
    const title = req.query.title;
    try {
        const response = await axios.get(`${MANGADEX_API}/manga`, {
            params: { title: title, limit: 10 }
        });
        
        let listHtml = '';
        response.data.data.forEach(manga => {
            const name = manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown Title';
            listHtml += `<li><a href="/manga/${manga.id}" style="color: #00ff00;">${name}</a></li><br/>`;
        });

        res.send(`
            <html>
            <body style="background:#000; color:#fff; font-family:monospace; padding:10px;">
                <h3>Results for "${title}":</h3>
                <ul>${listHtml || '<li>No manga found</li>'}</ul>
                <a href="/" style="color:#ff0000;"><- Back</a>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send("Error searching MangaDex. Try again.");
    }
});

// Manga Detail Page (Chapter List)
app.get('/manga/:id', async (req, res) => {
    try {
        const response = await axios.get(`${MANGADEX_API}/manga/${req.params.id}/feed`, {
            params: { limit: 50, order: { chapter: 'asc' }, translatedLanguage: ['en'] }
        });

        let chapterHtml = '';
        response.data.data.forEach(chap => {
            const volStr = chap.attributes.volume ? `Vol.${chap.attributes.volume} ` : '';
            const chapStr = chap.attributes.chapter ? `Ch.${chap.attributes.chapter}` : 'Special';
            const title = chap.attributes.title ? ` - ${chap.attributes.title}` : '';
            chapterHtml += `<li><a href="/chapter/${chap.id}" style="color:#00ffff;">${volStr}${chapStr}${title}</a></li><br/>`;
        });

        res.send(`
            <html>
            <body style="background:#000; color:#fff; font-family:monospace; padding:10px;">
                <h3>Chapters:</h3>
                <ul>${chapterHtml || '<li>No translated chapters found.</li>'}</ul>
                <a href="/" style="color:#ff0000;"><- Home</a>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send("Error loading chapters.");
    }
});

// Chapter Viewer Page (The Core Feature)
app.get('/chapter/:id', async (req, res) => {
    try {
        // 1. Get chapter details & server configurations
        const connResponse = await axios.get(`${MANGADEX_API}/at-home/server/${req.params.id}`);
        const hash = connResponse.data.chapter.hash;
        const pageArray = connResponse.data.chapter.dataSaver; // 'dataSaver' yields heavily compressed files perfect for Nokia 216
        const baseUrl = connResponse.data.baseUrl;

        // 2. Get current page index from URL query parameters (defaults to page 0)
        const pageIndex = parseInt(req.query.p) || 0;
        
        if (pageIndex < 0 || pageIndex >= pageArray.length) {
            return res.send("Invalid page.");
        }

        // 3. Build the official CDN URL for this specific page image
        const imgUrl = `${baseUrl}/data-saver/${hash}/${pageArray[pageIndex]}`;

        // 4. Generate highly compressed UI navigation tags
        const nextLink = pageIndex < pageArray.length - 1 ? `<a href="/chapter/${req.params.id}?p=${pageIndex + 1}" style="color:#00ff00; font-size:20px; font-weight:bold;">NEXT PAGE -></a>` : '<span>End of Chapter</span>';
        const prevLink = pageIndex > 0 ? `<a href="/chapter/${req.params.id}?p=${pageIndex - 1}" style="color:#ffaa00;"><- Prev Page</a>` : '';

        res.send(`
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="background:#111; color:#fff; font-family:monospace; text-align:center; padding:5px; margin:0;">
                <div style="padding:5px;">Page ${pageIndex + 1} / ${pageArray.length}</div>
                
                <div style="margin: 10px 0;">
                    <img src="${imgUrl}" style="max-width:100%; height:auto; border:1px solid #333;" alt="Manga Page" />
                </div>

                <div style="margin:15px 0;">
                    ${nextLink}
                    <br/><br/>
                    ${prevLink}
                </div>
                <hr style="border-color:#333;"/>
                <a href="/" style="color:#ff0000;">Quit to Home</a>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send("Error rendering chapter page. Try refreshing.");
    }
});

app.listen(PORT, () => console.log(`Nokia Manga Engine running on port ${PORT}`));
