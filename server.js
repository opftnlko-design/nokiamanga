const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const MANGADEX_API = 'https://api.mangadex.org';

// Pre-defined MangaDex UUID tags for filtering genres
const GENRES = {
    "All": "",
    "Action": "391b0423-d847-456f-aff0-8b0cfc03066b",
    "Romance": "423e2eae-a7a2-4a8b-ac03-a8351462d71d",
    "Sci-Fi": "256c8064-7c61-4a13-8a7a-ab24156d2b7b",
    "Comedy": "4d32b451-2632-4861-a4d8-accf0a5c73d3",
    "Drama": "b9af3a63-f058-41d4-a070-d473d667e1fb",
    "Erotica": "97893a4c-12af-4dac-b6be-5257f1856150" // Explicit Content Tag
};

// Main CSS theme that renders efficiently on Nokia 216 / Opera Mini
const UI_STYLE = `
    <style>
        body { background: #0b0f19; color: #f3f4f6; font-family: monospace; padding: 8px; margin: 0; }
        a { color: #38bdf8; text-decoration: none; font-size: 15px; }
        input, button, select { padding: 8px; font-size: 14px; width: 100%; margin-bottom: 10px; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 4px; box-sizing: border-box; }
        button { background: #2563eb; font-weight: bold; border: none; cursor: pointer; }
        .btn-green { background: #16a34a; color: #fff; padding: 8px; font-weight: bold; display: inline-block; border-radius: 3px; }
        .btn-orange { background: #ea580c; color: #fff; padding: 8px; font-weight: bold; display: inline-block; border-radius: 3px; }
        .genre-link { display: inline-block; background: #334155; color: #fff; padding: 4px 8px; margin: 3px; border-radius: 3px; font-size: 12px; }
        ul { padding-left: 15px; margin: 10px 0; }
        li { margin-bottom: 12px; }
    </style>
`;

// Home Page: Includes Search, Genre Filters, and Infinite Browsing
app.get('/', async (req, res) => {
    const page = parseInt(req.query.page) || 0;
    const selectedGenre = req.query.genre || "";
    const limit = 10;
    const offset = page * limit;
    let listHtml = '';
    
    // Build Genre Filter UI row
    let genreFilterUi = '<div>';
    for (const [key, val] of Object.entries(GENRES)) {
        const activeColor = selectedGenre === val ? 'background:#2563eb;' : '';
        genreFilterUi += `<a class="genre-link" style="${activeColor}" href="/?genre=${val}">${key}</a> `;
    }
    genreFilterUi += '</div>';

    try {
        const params = {
            limit: limit,
            offset: offset,
            order: { followedCount: 'desc' },
            availableTranslatedLanguage: ['en'],
            contentRating: ['safe', 'suggestive', 'erotica', 'pornographic'] // Allows adult content requested
        };

        if (selectedGenre) {
            params.includedTags = [selectedGenre];
        }

        const response = await axios.get(`${MANGADEX_API}/manga`, { params });

        response.data.data.forEach(manga => {
            const name = manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown Title';
            listHtml += `<li><a href="/manga/${manga.id}" style="color: #4ade80; font-weight:bold;">${name}</a></li>`;
        });
    } catch (err) {
        listHtml = '<li>Failed to load items. Tap refresh.</li>';
    }

    const nextPage = page + 1;
    const prevPage = page > 0 ? `<a href="/?page=${page - 1}&genre=${selectedGenre}" style="color:#f97316;"><- Previous</a> | ` : '';

    res.send(`
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${UI_STYLE}
        </head>
        <body>
            <h2 style="color:#2563eb; margin:5px 0;">Nokia Manga Pro</h2>
            
            <form action="/search" method="GET">
                <input type="text" name="title" placeholder="Search text..." required />
                <button type="submit">Search</button>
            </form>
            
            <h4 style="margin:10px 0 5px 0;">Filter By Genre:</h4>
            ${genreFilterUi}
            <hr style="border-color: #334155; margin: 15px 0;"/>
            
            <h3>Explore Titles:</h3>
            <ul>${listHtml}</ul>

            <div style="margin: 20px 0; text-align: center;">
                ${prevPage}
                <a href="/?page=${nextPage}&genre=${selectedGenre}" style="color:#38bdf8; font-weight:bold;">Load More -></a>
            </div>
        </body>
        </html>
    `);
});

// Search Endpoint
app.get('/search', async (req, res) => {
    const title = req.query.title;
    if (!title) return res.redirect('/');

    try {
        const response = await axios.get(`${MANGADEX_API}/manga`, {
            params: { 
                title: title, 
                limit: 20,
                availableTranslatedLanguage: ['en'],
                contentRating: ['safe', 'suggestive', 'erotica', 'pornographic']
            }
        });
        
        let listHtml = '';
        response.data.data.forEach(manga => {
            const name = manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown Title';
            listHtml += `<li><a href="/manga/${manga.id}" style="color: #4ade80;">${name}</a></li>`;
        });

        res.send(`
            <html>
            <head>${UI_STYLE}</head>
            <body>
                <h3>Results for "${title}":</h3>
                <ul>${listHtml || '<li>No matching English entries found.</li>'}</ul>
                <br/>
                <a href="/" style="color:#ef4444;"><- Home</a>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send("Search route error.");
    }
});

// Manga Chapter Feed List
app.get('/manga/:id', async (req, res) => {
    try {
        const response = await axios.get(`${MANGADEX_API}/manga/${req.params.id}/feed`, {
            params: { 
                limit: 500, 
                order: { chapter: 'asc' }, 
                translatedLanguage: ['en'],
                contentRating: ['safe', 'suggestive', 'erotica', 'pornographic']
            }
        });

        const chapters = response.data.data;
        if (!chapters || chapters.length === 0) {
            return res.send(`<body style="background:#0b0f19; color:#fff; font-family:monospace;"><p>No English chapters found.</p><a href="/">Home</a></body>`);
        }

        const firstChapterId = chapters[0].id;
        const lastChapterId = chapters[chapters.length - 1].id;

        let chapterHtml = '';
        chapters.forEach(chap => {
            const volStr = chap.attributes.volume ? `Vol.${chap.attributes.volume} ` : '';
            const chapStr = chap.attributes.chapter ? `Ch.${chap.attributes.chapter}` : 'Spec';
            const title = chap.attributes.title ? ` - ${chap.attributes.title}` : '';
            chapterHtml += `<li><a href="/chapter/${chap.id}">${volStr}${chapStr}${title}</a></li>`;
        });

        res.send(`
            <html>
            <head>${UI_STYLE}</head>
            <body>
                <h3>Controls:</h3>
                <div style="margin:10px 0;">
                    <a href="/chapter/${firstChapterId}" class="btn-green">READ FROM START</a>
                    <a href="/chapter/${lastChapterId}" class="btn-orange">READ FROM END</a>
                </div>
                <hr style="border-color:#334155;"/>
                <h3>Chapters (${chapters.length}):</h3>
                <ul>${chapterHtml}</ul>
                <br/>
                <a href="/" style="color:#ef4444;"><- Home</a>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send("Error compiling target chapter feed index.");
    }
});

// Chapter Viewer with Stable Image Fallbacks and Fixed Proxies
app.get('/chapter/:id', async (req, res) => {
    try {
        const pageIndex = parseInt(req.query.p) || 0;

        const connResponse = await axios.get(`${MANGADEX_API}/at-home/server/${req.params.id}`);
        const hash = connResponse.data.chapter.hash;
        
        let pageArray = connResponse.data.chapter.dataSaver;
        let folder = 'data-saver';
        
        if (!pageArray || pageArray.length === 0) {
            pageArray = connResponse.data.chapter.data;
            folder = 'data';
        }

        if (pageIndex < 0 || pageIndex >= pageArray.length) {
            return res.send(`<html><head>${UI_STYLE}</head><body><h3>End of Chapter</h3><a href="/">Return Home</a></body></html>`);
        }

        // Standard direct CDN URL
        const directImgUrl = `${connResponse.data.baseUrl}/${folder}/${hash}/${pageArray[pageIndex]}`;
        
        // Anti-CORS Fallback Proxy: Routes the image request through an open origin proxy if standard rendering breaks
        const proxyImgUrl = `https://images.weserv.nl/?url=${encodeURIComponent(directImgUrl)}&output=jpg&q=70`;

        const nextLink = pageIndex < pageArray.length - 1 
            ? `<a href="/chapter/${req.params.id}?p=${pageIndex + 1}" style="color:#4ade80; font-size:20px; font-weight:bold; display:block; padding:12px; background:#1e293b; margin:10px 0; border-radius:4px; border:1px solid #475569;">TAP FOR NEXT PAGE -></a>` 
            : '<span style="color:#94a3b8; display:block; margin:10px 0;">Chapter Complete</span>';
            
        const prevLink = pageIndex > 0 
            ? `<a href="/chapter/${req.params.id}?p=${pageIndex - 1}" style="color:#f97316;"><- Previous Page</a>` 
            : '';

        res.send(`
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                ${UI_STYLE}
            </head>
            <body style="text-align:center;">
                <div style="padding:5px; background:#1e293b; font-size:13px; color:#94a3b8;">Page ${pageIndex + 1} / ${pageArray.length}</div>
                
                <div style="margin: 10px 0;">
                    <img src="${proxyImgUrl}" style="width:100%; max-width:320px; height:auto; border:1px solid #334155;" alt="Loading... If page stays blank, refresh." />
                </div>

                <div style="margin:15px 0; padding:0 5px;">
                    ${nextLink}
                    <br/>
                    ${prevLink}
                </div>
                <hr style="border-color:#334155;"/>
                <a href="/" style="color:#ef4444;">Exit Reader</a>
            </body>
            </html>
        `);
    } catch (err) {
        res.send(`<html><head>${UI_STYLE}</head><body><h3>Page Context Block Error</h3><p>MangaDex dropped this image node connection.</p><a href="javascript:history.back()">Go Back</a></body></html>`);
    }
});

app.listen(PORT, () => console.log(`Engine optimized on port ${PORT}`));
