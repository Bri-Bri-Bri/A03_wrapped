(async function() {
  'use strict';
  
  // Configuration
  const USERNAME = prompt('Enter your AO3 username:');
  if (!USERNAME) return;
  
  const YEAR = parseInt(prompt('Which year? (e.g., 2025)', '2025'));
  if (!YEAR) return;
  
  // Show loading overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:999999;display:flex;align-items:center;justify-content:center;color:#fff;font-family:sans-serif;flex-direction:column;';
  overlay.innerHTML = '<div style="font-size:24px;margin-bottom:20px;">📚 Generating AO3 Wrapped...</div><div id="ao3-progress" style="font-size:16px;">Starting...</div>';
  document.body.appendChild(overlay);
  const progressEl = document.getElementById('ao3-progress');
  
  try {
    // Fetch and parse
    async function fetchPage(url) {
      progressEl.textContent = 'Fetching ' + url.split('?')[0].split('/').pop() + '...';
      const res = await fetch(url, { credentials: 'include' });
      return new DOMParser().parseFromString(await res.text(), 'text/html');
    }
    
    // Get total pages
    const baseUrl = `https://archiveofourown.org/users/${USERNAME}/readings`;
    const firstPage = await fetchPage(baseUrl);
    const pagination = firstPage.querySelector('ol.pagination.actions');
    const numPages = pagination ? parseInt([...pagination.querySelectorAll('li')].slice(-2)[0].textContent) : 1;
    
    progressEl.textContent = `Found ${numPages} pages to scan...`;
    
    // Scrape fics
    const fics = [];
    for (let page = 1; page <= numPages; page++) {
      progressEl.textContent = `Scanning page ${page}/${numPages}...`;
      const doc = await fetchPage(`${baseUrl}?page=${page}`);
      const works = doc.querySelectorAll('ol.reading.work.index.group li[role="article"]');
      const visits = doc.querySelectorAll('h4.viewed.heading');
      
      for (let i = 0; i < works.length; i++) {
        const visitText = visits[i].textContent;
        if (visitText.includes('Marked for Later') || visitText.includes('Deleted work')) continue;
        
        const yearMatch = visitText.match(/(\d{4})/);
        if (!yearMatch) continue;
        const visitYear = parseInt(yearMatch[1]);
        
        if (visitYear < YEAR) { page = numPages + 1; break; } // Stop early
        if (visitYear > YEAR) continue;
        
        const work = works[i];
        const title = work.querySelector('h4.heading a').textContent.trim();
        const rating = work.querySelector('a.help.symbol.question')?.textContent.trim() || 'Not Rated';
        const authors = [...work.querySelectorAll('a[rel="author"]')].map(a => a.textContent.trim());
        const fandoms = [...work.querySelectorAll('h5.fandoms.heading a.tag')].map(a => a.textContent.trim());
        const ships = [...work.querySelectorAll('li.relationships')].map(el => el.textContent.replace(/\n/g, '').trim()).filter(Boolean);
        const chars = [...work.querySelectorAll('li.characters')].map(el => el.textContent.replace(/\n/g, '').trim()).filter(Boolean);
        const tags = [...work.querySelectorAll('li.freeforms')].map(el => el.textContent.replace(/\n/g, '').trim()).filter(Boolean);
        const words = parseInt(work.querySelector('dd.words')?.textContent.replace(/,/g, '') || '0');
        
        fics.push({ title, rating, authors: authors.length ? authors : ['Anonymous'], fandoms, ships, chars, tags, words });
      }
      
      await new Promise(r => setTimeout(r, 1000)); // Rate limit
    }
    
    if (!fics.length) throw new Error('No fics found for this year!');
    
    // Calculate stats
    progressEl.textContent = 'Calculating stats...';
    
    const totalFics = fics.length;
    const totalWords = fics.reduce((sum, f) => sum + f.words, 0);
    const longest = fics.reduce((max, f) => f.words > max.words ? f : max, fics[0]);
    
    const count = (arr) => arr.reduce((c, x) => (c[x] = (c[x] || 0) + 1, c), {});
    const top = (arr, n) => Object.entries(count(arr)).sort((a, b) => b[1] - a[1]).slice(0, n);
    
    const topAuthors = top(fics.flatMap(f => f.authors).filter(a => a !== 'Anonymous' && a !== 'orphan_account'), 5);
    const topFandoms = top(fics.flatMap(f => f.fandoms), 3);
    const topChars = top(fics.flatMap(f => f.chars), 2);
    const topShips = top(fics.flatMap(f => f.ships), 5);
    const topTags = top(fics.flatMap(f => f.tags), 5);
    const topRating = top(fics.map(f => f.rating), 1);
    
    // Comments
    const wordComment = totalWords < 50000 ? "You touch grass!" : totalWords < 1000000 ? "That's like reading multiple novels!" : `About ${Math.floor(totalWords/365)} words/day!`;
    const ratingComment = { 'Explicit': 'No judgement.', 'Mature': "You're spicy.", 'Teen And Up Audiences': 'Jesus is proud.', 'General Audiences': 'Wholesome!' }[topRating[0]?.[0]] || '';
    
    // Format output
    let output = `═══════════════════════════════\n   AO3 WRAPPED ${YEAR}\n═══════════════════════════════\n\n`;
    output += `📚 FICS READ: ${totalFics}\n`;
    output += `📖 WORDS: ${totalWords.toLocaleString()}\n   ${wordComment}\n\n`;
    output += `📜 LONGEST: "${longest.title}"\n   by ${longest.authors.join(', ')}\n   ${longest.words.toLocaleString()} words\n\n`;
    output += `🌟 TOP FANDOMS:\n${topFandoms.map(([f, c], i) => `   ${i+1}. ${f} (${c})`).join('\n')}\n\n`;
    if (topChars.length) output += `👤 FAV CHARACTERS:\n${topChars.map(([c, n]) => `   • ${c} (${n})`).join('\n')}\n\n`;
    if (topShips.length) output += `💕 TOP SHIPS:\n${topShips.map(([s, c], i) => `   ${i+1}. ${s} (${c})`).join('\n')}\n\n`;
    if (topAuthors.length) output += `✍️ TOP AUTHORS:\n${topAuthors.map(([a, c], i) => `   ${i+1}. ${a} (${c})`).join('\n')}\n\n`;
    if (topTags.length) output += `🏷️ TOP TAGS:\n${topTags.map(([t, c], i) => `   ${i+1}. ${t} (${c})`).join('\n')}\n\n`;
    output += `🔞 RATING: ${topRating[0]?.[0] || 'N/A'} (${topRating[0]?.[1] || 0} works)\n   ${ratingComment}\n\n`;
    output += `═══════════════════════════════`;
    
    // Show results
    overlay.innerHTML = `
      <div style="max-width:800px;max-height:90vh;overflow:auto;background:#fff;color:#000;padding:30px;border-radius:12px;font-family:monospace;white-space:pre-wrap;">${output}</div>
      <div style="margin-top:20px;">
        <button id="ao3-copy" style="padding:12px 24px;margin:0 10px;font-size:16px;cursor:pointer;background:#990000;color:#fff;border:none;border-radius:6px;">📋 Copy</button>
        <button id="ao3-close" style="padding:12px 24px;margin:0 10px;font-size:16px;cursor:pointer;background:#666;color:#fff;border:none;border-radius:6px;">Close</button>
      </div>
    `;
    
    document.getElementById('ao3-copy').onclick = () => {
      navigator.clipboard.writeText(output);
      alert('Copied to clipboard!');
    };
    document.getElementById('ao3-close').onclick = () => overlay.remove();
    
  } catch (err) {
    overlay.innerHTML = `
      <div style="color:#f88;font-size:20px;text-align:center;max-width:600px;">
        ❌ Error: ${err.message}<br><br>
        Make sure you're logged into AO3 and your username is correct.
        <br><br>
        <button onclick="this.parentElement.parentElement.remove()" style="padding:12px 24px;font-size:16px;cursor:pointer;background:#666;color:#fff;border:none;border-radius:6px;">Close</button>
      </div>
    `;
  }
})();