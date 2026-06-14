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
        body { background: #0b0f19; color: #f3f4f6; font-family: monospace; padding: 8px; margin: 0; }
        a { color: #38bdf8; text-decoration: none; font-size: 15px; }
        input, button, select { padding: 8px; font-size: 14px; width: 100%; margin-bottom: 10px; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 4px; box-sizing: border-box; }
        button { background: #2563eb; font-weight: bold; border: none; }
        .genre-link { display: inline-block; background: #334155; color: #fff; padding: 4px 8px; margin: 3px; border-radius: 3px; font-size: 12px; }
        ul { padding-left: 15px; margin: 10px 0; }
        li { margin-bottom: 12px; }
        .btn-green { background: #16a34a; color: #fff; padding: 8px; font-weight: bold; display: inline-block; border-radius: 3px; margin-right:5px; text-decoration:none; }
        .btn-orange { background: #ea580c; color: #fff; padding: 8px; font-weight: bold; display: inline-block; border-radius: 3px; text-decoration:none; }
        .warning-box { background: #7c2d12; color: #ffedd5; padding: 8px; margin: 10px 0; border-radius: 4px; font-size: 12px; }
    </style>
`;

// Home Route
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

        if (selectedGenre) {
            params.includedTags = [selectedGenre];
        }

        const response = await axios.get(`${MANGADEX_API}/manga`, { params, timeout: 8000 });

        response.data.data.forEach(manga => {
            const name = manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown Title';
            listHtml += `<li><a href="/manga/${manga.id}" style="color: #4ade80; font-weight:bold;">${name}</a></li>`;
        });
    } catch (err) {
        listHtml = '<li>Feed timed out. Tap refresh link below.</li>';
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
                <input type="text" name="title" placeholder="Search title..." required />
                <button type="submit">Search</button>
            </form>
            
            <h4 style="margin:10px 0 5px 0;">Filters:</h4>
            ${genreFilterUi}
            <hr style="border-color: #334155; margin: 15px 0;"/>
            
            <h3>Manga Feed:</h3>
            <ul>${listHtml}</ul>

            <div style="margin: 20px 0; text-align: center;">
                ${prevPage}
                <a href="/?page=${nextPage}&genre=${selectedGenre}" style="color:#38bdf8; font-weight:bold;">Load More -></a>
            </div>
        </body>
        </html>
    `);
});

// Search Route
app.get('/search', async (req, res) => {
    const title = req.query.title;
    if (!title) return res.redirect('/');

    try {
        const response = await axios.get(`${MANGADEX_API}/manga`, {
            params: { 
                title: title, 
                limit: 25,
                availableTranslatedLanguage: ['en'],
                contentRating: ['safe', 'suggestive', 'erotica', 'pornographic']
            },
            timeout: 8000
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
                <ul>${listHtml || '<li>No results found.</li>'}</ul>
                <br/>
                <a href="/" style="color:#ef4444;"><- Home</a>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send("Search parsing failed.");
    }
});

// Chapters List Component
app.get('/manga/:id', async (req, res) => {
    try {
        const response = await axios.get(`${MANGADEX_API}/manga/${req.params.id}/feed`, {
            params: { 
                limit: 500, 
                order: { chapter: 'asc' }, 
                translatedLanguage: ['en'],
                contentRating: ['safe', 'suggestive', 'erotica', 'pornographic']
            },
            timeout: 10000
        });

        const chapters = response.data.data;
        
        let warningNotice = '';
        if (!chapters || chapters.length < 5) {
            warningNotice = `
                <div class="warning-box">
                    ⚠️ <b>Notice:</b> This manga has missing chapters on MangaDex due to official publisher copyright blockades.
                </div>
            `;
        }

        if (!chapters || chapters.length === 0) {
            return res.send(`
                <html><head>${UI_STYLE}</head><body>
                ${warningNotice}
                <p style="color:#ef4444;">No chapters available on this host provider database.</p>
                <a href="/">Home</a>
                </body></html>
            `);
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
                ${warningNotice}
                <h3>Controls:</h3>
                <div style="margin:15px 0;">
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
        res.status(500).send("Error compiling core database feed.");
    }
});

// Reader Module with Multi-Node Connection Fail-safes
app.get('/chapter/:id', async (req, res) => {
    try {
        const pageIndex = parseInt(req.query.p) || 0;

        const connResponse = await axios.get(`${MANGADEX_API}/at-home/server/${req.params.id}`, { timeout: 6000 });
        const hash = connResponse.data.chapter.hash;
        const fallbackBaseUrl = "https://uploads.mangadex.org"; // Safe storage cluster fallback
        
        let pageArray = connResponse.data.chapter.dataSaver;
        let folder = 'data-saver';
        
        if (!pageArray || pageArray.length === 0) {
            pageArray = connResponse.data.chapter.data;
            folder = 'data';
        }

        if (pageIndex < 0 || pageIndex >= pageArray.length) {
            return res.send(`<html><head>${UI_STYLE}</head><body><h3>Chapter Complete</h3><a href="/">Home</a></body></html>`);
        }

        // Generate primary assigned node path and alternative official cluster route
        const nodeUrl = `${connResponse.data.baseUrl}/${folder}/${hash}/${pageArray[pageIndex]}`;
        const clusterUrl = `${fallbackBaseUrl}/${folder}/${hash}/${pageArray[pageIndex]}`;
        
        // Pass both locations down to stream engine tunnel
        const tunnelImgSrc = `/image-stream?url=${encodeURIComponent(nodeUrl)}&backup=${encodeURIComponent(clusterUrl)}`;

        const nextLink = pageIndex < pageArray.length - 1 
            ? `<a href="/chapter/${req.params.id}?p=${pageIndex + 1}" style="color:#4ade80; font-size:20px; font-weight:bold; display:block; padding:12px; background:#1e293b; margin:10px 0; border:1px solid #475569;">NEXT PAGE -></a>` 
            : '<span style="color:#94a3b8; display:block; margin:10px 0;">Chapter Finished</span>';
            
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
                    <img src="${tunnelImgSrc}" style="width:100%; max-width:320px; height:auto; border:1px solid #334155;" alt="Loading content context tracks..." />
                </div>

                <div style="margin:15px 0;">
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
        res.send(`<html><head>${UI_STYLE}</head><body><h3>Node Assignment Error</h3><p>MangaDex host lines are busy right now.</p><a href="javascript:location.reload()">Tap to retry</a></body></html>`);
    }
});

// Dual-node Binary Auto-Swapping Tunnel Proxy Engine
app.get('/image-stream', async (req, res) => {
    const targetUrl = req.query.url;
    const backupUrl = req.query.backup;
    if (!targetUrl) return res.status(400).send("Parameters missing.");

    try {
        // Try to download from assigned primary volunteer node
        const streamResponse = await axios({
            method: 'get',
            url: targetUrl,
            responseType: 'stream',
            timeout: 5000 
        });

        res.setHeader('Content-Type', 'image/jpeg');
        return streamResponse.data.pipe(res);
    } catch (err) {
        // If node fails/blanks out, immediately drop it and stream from global fallback backup cluster cluster instead
        try {
            const backupResponse = await axios({
                method: 'get',
                url: backupUrl,
                responseType: 'stream',
                timeout: 6000
            });
            res.setHeader('Content-Type', 'image/jpeg');
            return backupResponse.data.pipe(res);
        } catch (backupErr) {
            res.status(500).send("All proxy pipelines dropped connection.");
        }
    }
});

app.listen(PORT, () => console.log(`Dynamic Fail-Safe engine online on port ${PORT}`));
