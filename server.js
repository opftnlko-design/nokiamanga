const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const MANGADEX_API = 'https://api.mangadex.org';

const GENRES = {
    "All": "",
    "Action": "391b0423-d847-456f-aff0-8b0cfc03066b",
    "Romance": "423e2eae-a7a2-4a8b-ac03-a8351462d71d",
    "Sci-Fi": "256c8064-7c61-4a13-8a7a-ab24156d2b7b",
    "Comedy": "4d32b451-2632-4861-a4d8-accf0a5c73d3",
    "Horror": "cdad7e68-1419-41dd-bdce-6d3293c19308",
    "Adult Content": "97893a4c-12af-4dac-b6be-5257f1856150"
};

const UI_STYLE = `
    <style>
        body { background: #0b0f19; color: #f3f4f6; font-family: monospace; padding: 6px; margin: 0; }
        a { color: #38bdf8; text-decoration: none; font-size: 14px; }
        input, button { padding: 6px; font-size: 13px; width: 100%; margin-bottom: 8px; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 3px; box-sizing: border-box; }
        button { background: #2563eb; font-weight: bold; border: none; }
        .genre-link { display: inline-block; background: #334155; color: #fff; padding: 3px 6px; margin: 2px; border-radius: 2px; font-size: 11px; }
        ul { padding-left: 12px; margin: 8px 0; }
        li { margin-bottom: 10px; }
        .btn-green { background: #16a34a; color: #fff; padding: 8px; font-weight: bold; display: block; text-align: center; border-radius: 3px; text-decoration: none; margin: 5px 0; }
        
        /* Cleaned Layout optimized for native Opera Mobile Viewport scaling */
        .manga-frame { display: block; width: 100%; text-align: center; margin: 8px 0; }
        .manga-img { width: 100%; max-width: 320px; height: auto; border: 1px solid #334155; display: block; margin: 0 auto; }
        .info-hint { font-size: 11px; color: #a1a1aa; margin-bottom: 6px; display: block; }
    </style>
`;

// 1. Home Module
app.get('/', async (req, res) => {
    const page = parseInt(req.query.page) || 0;
    const selectedGenre = req.query.genre || "";
    const limit = 10;
    const offset = page * limit;
    let listHtml = '';
    
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
            contentRating: ['safe', 'suggestive', 'erotica', 'pornographic']
        };

        if (selectedGenre) params.includedTags = [selectedGenre];

        const response = await axios.get(`${MANGADEX_API}/manga`, { params, timeout: 8000 });

        response.data.data.forEach(manga => {
            const name = manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown Title';
            listHtml += `<li><a href="/manga/${manga.id}" style="color: #4ade80; font-weight:bold;">${name}</a></li>`;
        });
    } catch (err) {
        listHtml = '<li>Failed to load feed.</li>';
    }

    const nextPage = page + 1;
    const prevPage = page > 0 ? `<a href="/?page=${page - 1}&genre=${selectedGenre}" style="color:#f97316;"><- Prev</a> | ` : '';

    res.send(`
        <html>
        <head><meta name="viewport" content="width=device-width, initial-scale=1.0">${UI_STYLE}</head>
        <body>
            <h3 style="color:#2563eb; margin:4px 0;">Nokia Manga Pro v4</h3>
            <form action="/search" method="GET">
                <input type="text" name="title" placeholder="Search..." required />
                <button type="submit">Go</button>
            </form>
            ${genreFilterUi}
            <hr style="border-color: #334155; margin: 10px 0;"/>
            <ul>${listHtml}</ul>
            <div style="margin: 15px 0; text-align: center;">
                ${prevPage}
                <a href="/?page=${nextPage}&genre=${selectedGenre}" style="color:#38bdf8; font-weight:bold;">Next -></a>
            </div>
        </body>
        </html>
    `);
});

// 2. Search Parser
app.get('/search', async (req, res) => {
    const title = req.query.title;
    if (!title) return res.redirect('/');

    try {
        const response = await axios.get(`${MANGADEX_API}/manga`, {
            params: { title: title, limit: 25, availableTranslatedLanguage: ['en'], contentRating: ['safe', 'suggestive', 'erotica', 'pornographic'] },
            timeout: 8000
        });
        
        let listHtml = '';
        response.data.data.forEach(manga => {
            const name = manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown Title';
            listHtml += `<li><a href="/manga/${manga.id}" style="color: #4ade80;">${name}</a></li>`;
        });

        res.send(`
            <html><head>${UI_STYLE}</head><body>
                <h3>Results:</h3>
                <ul>${listHtml || '<li>No results found.</li>'}</ul>
                <br/><a href="/" style="color:#ef4444;"><- Home</a>
            </body></html>
        `);
    } catch (err) {
        res.status(500).send("Search failed.");
    }
});

// 3. Manga Feed & Chapter List
app.get('/manga/:id', async (req, res) => {
    try {
        const response = await axios.get(`${MANGADEX_API}/manga/${req.params.id}/feed`, {
            params: { limit: 500, order: { chapter: 'asc' }, translatedLanguage: ['en'], contentRating: ['safe', 'suggestive', 'erotica', 'pornographic'] },
            timeout: 10000
        });

        const chapters = response.data.data;
        if (!chapters || chapters.length === 0) {
            return res.send(`<html><head>${UI_STYLE}</head><body><p>No English chapters found.</p><a href="/">Home</a></body></html>`);
        }

        let chapterHtml = '';
        chapters.forEach(chap => {
            const volStr = chap.attributes.volume ? `Vol.${chap.attributes.volume} ` : '';
            const chapStr = chap.attributes.chapter ? `Ch.${chap.attributes.chapter}` : 'Spec';
            const title = chap.attributes.title ? ` - ${chap.attributes.title}` : '';
            chapterHtml += `<li><a href="/chapter/${chap.id}">${volStr}${chapStr}${title}</a></li>`;
        });

        res.send(`
            <html><head>${UI_STYLE}</head><body>
                <div style="margin:10px 0;">
                    <a href="/chapter/${chapters[0].id}" class="btn-green">START READING</a>
                </div>
                <h3>Chapters (${chapters.length}):</h3>
                <ul>${chapterHtml}</ul>
                <br/><a href="/" style="color:#ef4444;"><- Home</a>
            </body></html>
        `);
    } catch (err) {
        res.status(500).send("Error reading chapter index lists.");
    }
});

// 4. Chapter Viewer (Instant Hand-off Delivery System)
app.get('/chapter/:id', async (req, res) => {
    try {
        const pageIndex = parseInt(req.query.p) || 0;

        const connResponse = await axios.get(`${MANGADEX_API}/at-home/server/${req.params.id}`, { timeout: 6000 });
        const hash = connResponse.data.chapter.hash;
        
        // High-definition original file tracks selected for crisp canvas expansion
        let pageArray = connResponse.data.chapter.data;
        let folder = 'data';
        
        if (!pageArray || pageArray.length === 0) {
            pageArray = connResponse.data.chapter.dataSaver;
            folder = 'data-saver';
        }

        if (pageIndex < 0 || pageIndex >= pageArray.length) {
            return res.send(`<html><head>${UI_STYLE}</head><body><h3>Chapter Complete</h3><a href="/">Home</a></body></html>`);
        }

        const directImgUrl = `${connResponse.data.baseUrl}/${folder}/${hash}/${pageArray[pageIndex]}`;
        const fallbackImgUrl = `https://uploads.mangadex.org/${folder}/${hash}/${pageArray[pageIndex]}`;

        // Stream addresses targeting the high-velocity redirection pipeline
        const imageViewerEndpoint = `/image-stream?url=${encodeURIComponent(directImgUrl)}&backup=${encodeURIComponent(fallbackImgUrl)}`;

        const nextLink = pageIndex < pageArray.length - 1 
            ? `<a href="/chapter/${req.params.id}?p=${pageIndex + 1}" style="color:#4ade80; font-size:18px; font-weight:bold; display:block; padding:12px; background:#1e293b; margin:10px 0; border:1px solid #475569; text-decoration:none;">NEXT PAGE -></a>` 
            : '<span style="color:#94a3b8; display:block; margin:8px 0;">End of Chapter</span>';
            
        const prevLink = pageIndex > 0  
            ? `<a href="/chapter/${req.params.id}?p=${pageIndex - 1}" style="color:#f97316; display:inline-block; margin-top:5px;"><- Previous Page</a>` 
            : '';

        res.send(`
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                ${UI_STYLE}
            </head>
            <body style="text-align:center;">
                <div style="font-size:12px; color:#94a3b8; padding:2px;">Page ${pageIndex + 1} / ${pageArray.length}</div>
                
                <span class="info-hint">💡 Click image to open Full Screen for built-in Opera zoom</span>

                <div class="manga-frame">
                    <a href="${imageViewerEndpoint}" target="_self">
                        <img src="${imageViewerEndpoint}" class="manga-img" alt="Manga Page Content Frame" />
                    </a>
                </div>

                <div style="margin:10px 0;">
                    ${nextLink}
                    ${prevLink}
                </div>
                <hr style="border-color:#334155; margin:10px 0;"/>
                <a href="/" style="color:#ef4444; font-weight:bold;">Exit Reader</a>
            </body>
            </html>
        `);
    } catch (err) {
        res.send(`<html><head>${UI_STYLE}</head><body><h3>Data Fetching Timeout</h3><a href="javascript:location.reload()">Tap to retry</a></body></html>`);
    }
});

// 5. High-Velocity HTTP 302 Redirection Gateway (Bypasses Memory Latency)
app.get('/image-stream', async (req, res) => {
    const targetUrl = req.query.url;
    const backupUrl = req.query.backup;
    if (!targetUrl) return res.status(400).send("Missing target parameter tracks.");

    // Fix: Instead of downloading the image data buffer onto your server, 
    // we instantly route Opera Mini directly to the source content network.
    try {
        return res.redirect(302, targetUrl);
    } catch (err) {
        return res.redirect(302, backupUrl);
    }
});

app.listen(PORT, () => console.log(`Redirection optimization micro-engine running on port ${PORT}`));
