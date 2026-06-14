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
        .btn-green { background: #16a34a; color: #fff; padding: 6px; font-weight: bold; display: inline-block; border-radius: 2px; margin-right: 4px; text-decoration: none; }
        .btn-orange { background: #ea580c; color: #fff; padding: 6px; font-weight: bold; display: inline-block; border-radius: 2px; text-decoration: none; }
        .scroll-container { width: 100%; overflow-x: auto; overflow-y: hidden; background: #000; border-top: 1px solid #334155; border-bottom: 1px solid #334155; text-align: left; }
        .key-hint { font-size: 11px; color: #94a3b8; background: #111827; padding: 4px; margin: 4px 0; display: block; border-radius: 2px; }
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
        listHtml = '<li>Failed to load feed. Refresh.</li>';
    }

    const nextPage = page + 1;
    const prevPage = page > 0 ? `<a href="/?page=${page - 1}&genre=${selectedGenre}" style="color:#f97316;"><- Prev</a> | ` : '';

    res.send(`
        <html>
        <head><meta name="viewport" content="width=device-width, initial-scale=1.0">${UI_STYLE}</head>
        <body>
            <h3 style="color:#2563eb; margin:4px 0;">Nokia Manga Pro</h3>
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

// 4. Chapter Viewer (With 5 and 6 Keypad Controls)
app.get('/chapter/:id', async (req, res) => {
    try {
        const pageIndex = parseInt(req.query.p) || 0;
        
        // Default zoom is 100%. Each tap increases/decreases by 75% steps dynamically.
        const currentZoom = parseInt(req.query.z) || 100; 

        const connResponse = await axios.get(`${MANGADEX_API}/at-home/server/${req.params.id}`, { timeout: 8000 });
        const hash = connResponse.data.chapter.hash;
        
        let pageArray = connResponse.data.chapter.dataSaver;
        let folder = 'data-saver';
        
        if (!pageArray || pageArray.length === 0) {
            pageArray = connResponse.data.chapter.data;
            folder = 'data';
        }

        if (pageIndex < 0 || pageIndex >= pageArray.length) {
            return res.send(`<html><head>${UI_STYLE}</head><body><h3>Chapter Complete</h3><a href="/">Home</a></body></html>`);
        }

        const directImgUrl = `${connResponse.data.baseUrl}/${folder}/${hash}/${pageArray[pageIndex]}`;
        const tunnelImgSrc = `/image-stream?url=${encodeURIComponent(directImgUrl)}&backup=${encodeURIComponent(`https://uploads.mangadex.org/${folder}/${hash}/${pageArray[pageIndex]}`)}`;

        // Navigation strings 
        const nextLink = pageIndex < pageArray.length - 1 
            ? `<a href="/chapter/${req.params.id}?p=${pageIndex + 1}&z=${currentZoom}" style="color:#4ade80; font-size:18px; font-weight:bold; display:block; padding:10px; background:#1e293b; margin:8px 0; border:1px solid #475569;">NEXT PAGE -></a>` 
            : '<span style="color:#94a3b8; display:block; margin:8px 0;">End of Chapter</span>';
            
        const prevLink = pageIndex > 0  
            ? `<a href="/chapter/${req.params.id}?p=${pageIndex - 1}&z=${currentZoom}" style="color:#f97316;"><- Prev Page</a>` 
            : '';

        // Calculate steps for keypad adjustments
        const zoomInVal = currentZoom + 75;
        const zoomOutVal = currentZoom > 100 ? currentZoom - 75 : 100;

        res.send(`
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                ${UI_STYLE}
            </head>
            <body style="text-align:center;">
                <div style="font-size:12px; color:#94a3b8; padding:2px;">Page ${pageIndex + 1} / ${pageArray.length} (${currentZoom}%)</div>
                
                <div style="display:none;">
                    <a href="/chapter/${req.params.id}?p=${pageIndex}&z=${zoomInVal}" accesskey="5">Zoom In</a>
                    <a href="/chapter/${req.params.id}?p=${pageIndex}&z=${zoomOutVal}" accesskey="6">Zoom Out</a>
                </div>

                <div class="key-hint">Press <b>5</b> to Zoom In | Press <b>6</b> to Zoom Out</div>

                <div class="scroll-container">
                    <img src="${tunnelImgSrc}" style="width:${currentZoom}%; max-width:none; height:auto; display:block; margin:0 auto;" alt="Manga Page" />
                </div>

                <div style="margin:10px 0;">
                    ${nextLink}
                    ${prevLink}
                </div>
                <hr style="border-color:#334155;"/>
                <a href="/" style="color:#ef4444;">Exit</a>
            </body>
            </html>
        `);
    } catch (err) {
        res.send(`<html><head>${UI_STYLE}</head><body><h3>Timeout Error</h3><a href="javascript:location.reload()">Retry</a></body></html>`);
    }
});

// 5. Proxy Stream Tunnel
app.get('/image-stream', async (req, res) => {
    const targetUrl = req.query.url;
    const backupUrl = req.query.backup;
    try {
        const streamResponse = await axios({ method: 'get', url: targetUrl, responseType: 'stream', timeout: 5000 });
        res.setHeader('Content-Type', 'image/jpeg');
        return streamResponse.data.pipe(res);
    } catch (err) {
        try {
            const backupResponse = await axios({ method: 'get', url: backupUrl, responseType: 'stream', timeout: 6000 });
            res.setHeader('Content-Type', 'image/jpeg');
            return backupResponse.data.pipe(res);
        } catch (bErr) {
            res.status(500).send("Stream error.");
        }
    }
});

app.listen(PORT, () => console.log(`Keypad core operational on ${PORT}`));
