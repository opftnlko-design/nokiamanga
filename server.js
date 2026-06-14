const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const MANGADEX_API = 'https://api.mangadex.org';

// Home Page: Includes Search bar AND Suggested popular titles
app.get('/', async (req, res) => {
    let suggestionsHtml = '<li>Loading suggestions...</li>';
    
    try {
        // Fetch top popular, completed or ongoing manga in English
        const response = await axios.get(`${MANGADEX_API}/manga`, {
            params: {
                limit: 5,
                order: { followedCount: 'desc' }, // Sort by most popular
                availableTranslatedLanguage: ['en']
            }
        });

        suggestionsHtml = '';
        response.data.data.forEach(manga => {
            const name = manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown Title';
            suggestionsHtml += `<li><a href="/manga/${manga.id}" style="color: #00ff00;">${name}</a></li><br/>`;
        });
    } catch (err) {
        suggestionsHtml = '<li>Failed to load popular suggestions.</li>';
    }

    res.send(`
        <html>
        <head>
            <title>Nokia Manga</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { background: #000; color: #fff; font-family: monospace; padding: 10px; }
                input, button { padding: 5px; font-size: 14px; width: 100%; margin-bottom: 10px; box-sizing: border-box; }
                ul { padding-left: 20px; }
            </style>
        </head>
        <body>
            <h2>Nokia 216 Manga Reader</h2>
            
            <form action="/search" method="GET">
                <input type="text" name="title" placeholder="Type title (e.g. Solo Leveling)" required />
                <button type="submit">Search Manga</button>
            </form>
            
            <hr style="border-color: #333; margin: 20px 0;"/>
            
            <h3>Suggested Manga:</h3>
            <ul>
                ${suggestionsHtml}
            </ul>
        </body>
        </html>
    `);
});

// Search Results Page (Fixed URL Handling)
app.get('/search', async (req, res) => {
    const title = req.query.title;
    if (!title) {
        return res.redirect('/');
    }

    try {
        const response = await axios.get(`${MANGADEX_API}/manga`, {
            params: { 
                title: title, 
                limit: 15,
                availableTranslatedLanguage: ['en']
            }
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
                <ul>${listHtml || '<li>No manga found. Try checking the spelling!</li>'}</ul>
                <br/>
                <a href="/" style="color:#ff0000; font-size: 16px;"><- Back to Home</a>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send("Error searching MangaDex. Try going back and searching again.");
    }
});

// Manga Detail Page (Chapter List)
app.get('/manga/:id', async (req, res) => {
    try {
        const response = await axios.get(`${MANGADEX_API}/manga/${req.params.id}/feed`, {
            params: { 
                limit: 50, 
                order: { chapter: 'asc' }, 
                translatedLanguage: ['en'] 
            }
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
                <ul>${chapterHtml || '<li>No English chapters found for this specific title.</li>'}</ul>
                <br/>
                <a href="/" style="color:#ff0000;"><- Home</a>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send("Error loading chapters. This manga's external feed might be restricted.");
    }
});

// Chapter Viewer Page
app.get('/chapter/:id', async (req, res) => {
    try {
        const connResponse = await axios.get(`${MANGADEX_API}/at-home/server/${req.params.id}`);
        const hash = connResponse.data.chapter.hash;
        const pageArray = connResponse.data.chapter.dataSaver; 
        const baseUrl = connResponse.data.baseUrl;

        const pageIndex = parseInt(req.query.p) || 0;
        
        if (pageIndex < 0 || pageIndex >= pageArray.length) {
            return res.send("Invalid page block.");
        }

        const imgUrl = `${baseUrl}/data-saver/${hash}/${pageArray[pageIndex]}`;

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
                    <img src="${imgUrl}" style="max-width:100%; height:auto; border:1px solid #333;" />
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
        res.status(500).send("Error loading this page. Try pressing back and reloading.");
    }
});

app.listen(PORT, () => console.log(`Nokia Manga Engine online on port ${PORT}`));
