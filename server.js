const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Free Open Manga Provider Endpoint
const MANGA_API = 'https://api.consumet.org/manga/mangafire';

const UI_STYLE = `
    <style>
        body { background: #0b0f19; color: #f3f4f6; font-family: monospace; padding: 8px; margin: 0; }
        a { color: #38bdf8; text-decoration: none; font-size: 15px; }
        input, button { padding: 8px; font-size: 14px; width: 100%; margin-bottom: 10px; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 4px; box-sizing: border-box; }
        button { background: #2563eb; font-weight: bold; border: none; }
        .genre-link { display: inline-block; background: #334155; color: #fff; padding: 4px 8px; margin: 3px; border-radius: 3px; font-size: 12px; }
        ul { padding-left: 15px; margin: 10px 0; }
        li { margin-bottom: 12px; }
    </style>
`;

// Home Page
app.get('/', async (req, res) => {
    let listHtml = '';
    try {
        // Fetch trending items directly from alternative index
        const response = await axios.get(`${MANGA_API}/trending`, { timeout: 8000 });
        response.data.results.forEach(manga => {
            listHtml += `<li><a href="/manga?id=${encodeURIComponent(manga.id)}" style="color: #4ade80; font-weight:bold;">${manga.title}</a></li>`;
        });
    } catch (err) {
        listHtml = '<li>Failed to fetch trending. Use search bar below!</li>';
    }

    res.send(`
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${UI_STYLE}
        </head>
        <body>
            <h2 style="color:#2563eb; margin:5px 0;">Nokia Manga Pro v2</h2>
            
            <form action="/search" method="GET">
                <input type="text" name="title" placeholder="Search (e.g. Solo Leveling)" required />
                <button type="submit">Search</button>
            </form>
            
            <h4 style="margin:10px 0 5px 0;">Quick Genres:</h4>
            <div>
                <a class="genre-link" href="/search?title=action">Action</a>
                <a class="genre-link" href="/search?title=romance">Romance</a>
                <a class="genre-link" href="/search?title=sci-fi">Sci-Fi</a>
                <a class="genre-link" href="/search?title=comedy">Comedy</a>
                <a class="genre-link" href="/search?title=horror">Horror</a>
            </div>
            <hr style="border-color: #334155; margin: 15px 0;"/>
            
            <h3>Trending Manga:</h3>
            <ul>${listHtml}</ul>
        </body>
        </html>
    `);
});

// Search Route
app.get('/search', async (req, res) => {
    const title = req.query.title;
    if (!title) return res.redirect('/');

    try {
        const response = await axios.get(`${MANGA_API}/${encodeURIComponent(title)}`);
        let listHtml = '';
        
        response.data.results.forEach(manga => {
            listHtml += `<li><a href="/manga?id=${encodeURIComponent(manga.id)}" style="color: #4ade80;">${manga.title}</a></li>`;
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
        res.status(500).send("Search pipeline failed.");
    }
});

// Info & Chapters List
app.get('/manga', async (req, res) => {
    const mangaId = req.query.id;
    try {
        const response = await axios.get(`${MANGA_API}/info?id=${encodeURIComponent(mangaId)}`);
        const chapters = response.data.chapters;

        if (!chapters || chapters.length === 0) {
            return res.send(`<body>No readable chapters found. <a href="/">Back</a></body>`);
        }

        let chapterHtml = '';
        chapters.forEach(chap => {
            chapterHtml += `<li><a href="/chapter?id=${encodeURIComponent(chap.id)}">${chap.title || 'Chapter ' + chap.number}</a></li>`;
        });

        res.send(`
            <html>
            <head>${UI_STYLE}</head>
            <body>
                <h3>${response.data.title}</h3>
                <p style="font-size:12px; color:#94a3b8;">${response.data.description || 'No description.'}</p>
                <hr style="border-color:#334155;"/>
                <div style="margin:10px 0;">
                    <a href="/chapter?id=${encodeURIComponent(chapters[0].id)}" style="background:#16a34a; color:#fff; padding:6px; font-weight:bold;">START</a>
                    <a href="/chapter?id=${encodeURIComponent(chapters[chapters.length-1].id)}" style="background:#ea580c; color:#fff; padding:6px; font-weight:bold; margin-left:5px;">END</a>
                </div>
                <h3>Chapters (${chapters.length}):</h3>
                <ul>${chapterHtml}</ul>
                <br/>
                <a href="/" style="color:#ef4444;"><- Home</a>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send("Error loading manga properties.");
    }
});

// Chapter Reader Routing
app.get('/chapter', async (req, res) => {
    const chapterId = req.query.id;
    const pageIndex = parseInt(req.query.p) || 0;

    try {
        const response = await axios.get(`${MANGA_API}/read?chapterId=${encodeURIComponent(chapterId)}`);
        const pages = response.data;

        if (!pages || pages.length === 0) {
            return res.send("Chapter pages are unavailable.");
        }

        if (pageIndex < 0 || pageIndex >= pages.length) {
            return res.send(`<html><body><h3>Chapter Finished</h3><a href="/">Home</a></body></html>`);
        }

        const targetPageImg = pages[pageIndex].img;
        
        // SAFE PROXY ROUTE: Tells your Render server to download the image directly and stream it to the Nokia 
        const proxyImgUrl = `/proxy-image?url=${encodeURIComponent(targetPageImg)}`;

        const nextLink = pageIndex < pages.length - 1 
            ? `<a href="/chapter?id=${encodeURIComponent(chapterId)}&p=${pageIndex + 1}" style="color:#4ade80; font-size:20px; font-weight:bold; display:block; padding:12px; background:#1e293b; margin:10px 0; border:1px solid #475569;">NEXT PAGE -></a>` 
            : '<span style="color:#94a3b8;">End of Chapter</span>';
            
        const prevLink = pageIndex > 0 
            ? `<a href="/chapter?id=${encodeURIComponent(chapterId)}&p=${pageIndex - 1}" style="color:#f97316;"><- Previous Page</a>` 
            : '';

        res.send(`
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                ${UI_STYLE}
            </head>
            <body style="text-align:center;">
                <div style="padding:5px; background:#1e293b; font-size:13px;">Page ${pageIndex + 1} / ${pages.length}</div>
                
                <div style="margin: 10px 0;">
                    <img src="${proxyImgUrl}" style="width:100%; max-width:320px; height:auto; border:1px solid #334155;" alt="Loading content..." />
                </div>

                <div style="margin:15px 0;">
                    ${nextLink}
                    <br/>
                    ${prevLink}
                </div>
                <hr style="border-color:#334155;"/>
                <a href="/" style="color:#ef4444;">Main Menu</a>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send("Reader encountered an explicit hosting error.");
    }
});

// The Anti-Block Image Server Proxy
app.get('/proxy-image', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send("No target url specified.");

    try {
        const imageResponse = await axios({
            method: 'get',
            url: targetUrl,
            responseType: 'stream',
            headers: {
                'Referer': 'https://mangafire.to/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        // Tells your phone it is receiving a normal JPEG image
        res.setHeader('Content-Type', 'image/jpeg');
        imageResponse.data.pipe(res);
    } catch (e) {
        res.status(500).send("Image proxy download failed.");
    }
});

app.listen(PORT, () => console.log(`Unblockable server streaming on port ${PORT}`));
