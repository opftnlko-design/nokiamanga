const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const MANGADEX_API = 'https://api.mangadex.org';

// Home Page: Infinite Scroll/Pagination and Search
app.get('/', async (req, res) => {
    const page = parseInt(req.query.page) || 0;
    const limit = 10;
    const offset = page * limit;
    let suggestionsHtml = '';
    
    try {
        // Fetch popular manga strictly available in English
        const response = await axios.get(`${MANGADEX_API}/manga`, {
            params: {
                limit: limit,
                offset: offset,
                order: { followedCount: 'desc' },
                availableTranslatedLanguage: ['en']
            }
        });

        response.data.data.forEach(manga => {
            const name = manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown Title';
            suggestionsHtml += `<li><a href="/manga/${manga.id}" style="color: #00ff00; font-size:16px;">${name}</a></li><br/>`;
        });
    } catch (err) {
        suggestionsHtml = '<li>Failed to load manga lists. Check connection.</li>';
    }

    const nextPage = page + 1;
    const prevPage = page > 0 ? `<a href="/?page=${page - 1}" style="color:#ffaa00; font-size:16px;"><- Previous Page</a> | ` : '';

    res.send(`
        <html>
        <head>
            <title>Nokia Manga</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { background: #000; color: #fff; font-family: monospace; padding: 10px; }
                input, button { padding: 6px; font-size: 14px; width: 100%; margin-bottom: 10px; box-sizing: border-box; }
                ul { padding-left: 15px; }
            </style>
        </head>
        <body>
            <h2>Nokia 216 Manga</h2>
            
            <form action="/search" method="GET">
                <input type="text" name="title" placeholder="Search title..." required />
                <button type="submit">Search</button>
            </form>
            
            <hr style="border-color: #333; margin: 15px 0;"/>
            
            <h3>Explore Manga:</h3>
            <ul>
                ${suggestionsHtml}
            </ul>

            <div style="margin: 20px 0; text-align: center;">
                ${prevPage}
                <a href="/?page=${nextPage}" style="color:#00ffff; font-size:16px; font-weight:bold;">Load More Manga -></a>
            </div>
        </body>
        </html>
    `);
});

// Search Results (Strictly English)
app.get('/search', async (req, res) => {
    const title = req.query.title;
    if (!title) return res.redirect('/');

    try {
        const response = await axios.get(`${MANGADEX_API}/manga`, {
            params: { 
                title: title, 
                limit: 20,
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
                <ul>${listHtml || '<li>No matching English titles found.</li>'}</ul>
                <br/>
                <a href="/" style="color:#ff0000;"><- Home</a>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send("Search error.");
    }
});

// Manga Detail Page (Comprehensive Multi-Chapter Fetching + Sorting)
app.get('/manga/:id', async (req, res) => {
    try {
        // Fetch up to 500 chapters to guarantee large series (like Solo Leveling) show completely
        const response = await axios.get(`${MANGADEX_API}/manga/${req.params.id}/feed`, {
            params: { 
                limit: 500, 
                order: { chapter: 'asc' }, 
                translatedLanguage: ['en'] 
            }
        });

        const chapters = response.data.data;

        if (!chapters || chapters.length === 0) {
            return res.send(`
                <body style="background:#000; color:#fff; font-family:monospace; padding:10px;">
                    <h3>No English chapters found for this title.</h3>
                    <a href="/" style="color:#ff0000;"><- Home</a>
                </body>
            `);
        }

        const firstChapterId = chapters[0].id;
        const lastChapterId = chapters[chapters.length - 1].id;

        let chapterHtml = '';
        chapters.forEach(chap => {
            const volStr = chap.attributes.volume ? `Vol.${chap.attributes.volume} ` : '';
            const chapStr = chap.attributes.chapter ? `Ch.${chap.attributes.chapter}` : 'Spec';
            const title = chap.attributes.title ? ` - ${chap.attributes.title}` : '';
            chapterHtml += `<li><a href="/chapter/${chap.id}" style="color:#00ffff;">${volStr}${chapStr}${title}</a></li><br/>`;
        });

        res.send(`
            <html>
            <body style="background:#000; color:#fff; font-family:monospace; padding:10px;">
                <h3>Chapter Controls:</h3>
                <div style="margin:15px 0;">
                    <a href="/chapter/${firstChapterId}" style="background:#00ff00; color:#000; padding:8px; display:inline-block; text-decoration:none; font-weight:bold; margin-right:5px;">READ FROM START</a>
                    <a href="/chapter/${lastChapterId}" style="background:#ffaa00; color:#000; padding:8px; display:inline-block; text-decoration:none; font-weight:bold;">READ FROM END</a>
                </div>
                <hr style="border-color:#333;"/>
                <h3>All Chapters (${chapters.length}):</h3>
                <ul>
                    ${chapterHtml}
                </ul>
                <br/>
                <a href="/" style="color:#ff0000;"><- Home</a>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send("Error loading chapter database feed.");
    }
});

// Chapter Viewer Page (With Built-In Image Fallback Arrays)
app.get('/chapter/:id', async (req, res) => {
    try {
        const connResponse = await axios.get(`${MANGADEX_API}/at-home/server/${req.params.id}`);
        const hash = connResponse.data.chapter.hash;
        
        // Use standard dataSaver fallback arrays if files fail to track cleanly
        let pageArray = connResponse.data.chapter.dataSaver;
        let folder = 'data-saver';
        
        if (!pageArray || pageArray.length === 0) {
            pageArray = connResponse.data.chapter.data;
            folder = 'data';
        }

        const baseUrl = connResponse.data.baseUrl;
        const pageIndex = parseInt(req.query.p) || 0;
        
        if (pageIndex < 0 || pageIndex >= pageArray.length) {
            return res.send("End of chapter tracking block.");
        }

        // Generate CDN verified absolute image URL
        const imgUrl = `${baseUrl}/${folder}/${hash}/${pageArray[pageIndex]}`;

        const nextLink = pageIndex < pageArray.length - 1 
            ? `<a href="/chapter/${req.params.id}?p=${pageIndex + 1}" style="color:#00ff00; font-size:22px; font-weight:bold; display:block; padding:10px; background:#222; margin:10px 0;">NEXT PAGE -></a>` 
            : '<span style="color:#aaa; display:block; margin:10px 0;">End of Chapter Content</span>';
            
        const prevLink = pageIndex > 0 
            ? `<a href="/chapter/${req.params.id}?p=${pageIndex - 1}" style="color:#ffaa00; font-size:16px;"><- Previous Page</a>` 
            : '';

        res.send(`
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="background:#111; color:#fff; font-family:monospace; text-align:center; padding:5px; margin:0;">
                <div style="padding:5px; background:#222; font-size:14px;">Page ${pageIndex + 1} / ${pageArray.length}</div>
                
                <div style="margin: 10px 0;">
                    <img src="${imgUrl}" style="width:100%; max-width:320px; height:auto; border:1px solid #444;" alt="Manga Page Broken" />
                </div>

                <div style="margin:15px 0; padding:0 10px;">
                    ${nextLink}
                    <br/>
                    ${prevLink}
                </div>
                <hr style="border-color:#333;"/>
                <a href="/" style="color:#ff0000; font-size:14px;">Back to Main Home</a>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send("Image loading timeout or server fallback failure. Please try reloading.");
    }
});

app.listen(PORT, () => console.log(`Resilient Engine deployed on port ${PORT}`));
