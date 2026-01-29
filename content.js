(function() {
  // Prevent multiple injections
  if (window.hasRun) return;
  window.hasRun = true;

  // --- UI OVERLAY ---
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', bottom: '20px', right: '20px', padding: '15px',
    backgroundColor: '#222', color: '#fff', zIndex: '99999',
    borderRadius: '8px', fontFamily: 'sans-serif', fontSize: '13px', display: 'none'
  });
  document.body.appendChild(overlay);

  function updateOverlay(text) {
    overlay.style.display = 'block';
    overlay.innerHTML = text;
  }

  // --- ACTION LISTENER ---
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "load") autoLoad();
    if (request.action === "scrape") startScrape();
  });

  // --- FEATURE 1: AUTO-LOAD ALL ---
  async function autoLoad() {
    updateOverlay("<b>Auto-Loading...</b><br>Do not touch the page.");
    
    let keepGoing = true;
    let clicks = 0;

    while (keepGoing) {
      // 1. Scroll to bottom to trigger lazy load
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 1000));

      // 2. Find "Show More" button (Classes usually used by DAAD)
      // They often change, so we look for buttons with specific text
      const buttons = Array.from(document.querySelectorAll('button, a.btn'));
      const moreBtn = buttons.find(b => 
        b.innerText.toLowerCase().includes('more') || 
        b.innerText.toLowerCase().includes('mehr') ||
        b.innerText.toLowerCase().includes('show')
      );

      if (moreBtn && moreBtn.offsetParent !== null) { // If visible
        moreBtn.click();
        clicks++;
        updateOverlay(`<b>Expanding...</b><br>Clicked 'More' ${clicks} times.`);
        await new Promise(r => setTimeout(r, 2000)); // Wait for load
      } else {
        keepGoing = false;
      }
    }
    
    // Count final items
    const count = document.querySelectorAll('a[href*="/detail/"]').length;
    updateOverlay(`<b>Finished!</b><br>Found ${count} courses.<br>Now click 'Step 2'.`);
    alert(`Expansion Complete!\n\nI found ${count} courses.\n\nYou can now click 'Step 2: Download Excel'.`);
  }

  // --- FEATURE 2: THE SCRAPER ---
  async function startScrape() {
    // 1. Get Links
    const allLinks = Array.from(document.querySelectorAll('a[href*="/detail/"]'));
    const uniqueUrls = new Set();
    const tasks = [];

    // Filter logic
    allLinks.forEach(link => {
        // Only keep links that look like course titles (usually longer text)
        if (!uniqueUrls.has(link.href) && link.innerText.trim().length > 5) {
            uniqueUrls.add(link.href);
            tasks.push({ url: link.href, title: link.innerText.trim().replace(/,/g, " -") });
        }
    });

    if (tasks.length === 0) {
      alert("Error: 0 items found. Did you run Step 1?");
      return;
    }

    updateOverlay(`<b>Starting Scrape...</b><br>Queue: ${tasks.length} items.`);

    // 2. Scrape Loop
    let csvContent = "\uFEFFCourse Name,University,City,Tuition,Language,Deadline,Details,Link\n";
    
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      updateOverlay(`<b>Scraping: ${i + 1}/${tasks.length}</b><br>${task.title.substring(0,25)}...`);

      try {
        const response = await fetch(task.url);
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/html");
        
        const clean = (t) => t ? t.textContent.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, ' ').replace(/,/g, ";").trim() : "N/A";
        const getDef = (keys) => {
            const el = Array.from(doc.querySelectorAll('dt')).find(dt => keys.some(k => dt.textContent.toLowerCase().includes(k)));
            return el?.nextElementSibling ? clean(el.nextElementSibling) : "N/A";
        };

        const uni = clean(doc.querySelector('.c-detail-header__institution'));
        const city = clean(doc.querySelector('.c-detail-header__city')).replace(/Germany/i,'').trim();
        const tuition = getDef(['tuition', 'fees', 'cost']);
        const lang = getDef(['language', 'instruction']);
        const deadline = getDef(['deadline', 'application']);
        
        // Grab the main text block for requirements
        let details = "N/A";
        const reqHeader = Array.from(doc.querySelectorAll('h3')).find(h => h.textContent.includes('Requirements') || h.textContent.includes('Admission'));
        if (reqHeader && reqHeader.nextElementSibling) {
            details = clean(reqHeader.nextElementSibling).substring(0, 400) + "...";
        }

        csvContent += `"${task.title}","${uni}","${city}","${tuition}","${lang}","${deadline}","${details}","${task.url}"\n`;

      } catch (e) { console.error(e); }
      
      // Fast delay (1s) - we can go faster because we aren't clicking 'more' anymore
      await new Promise(r => setTimeout(r, 1000));
    }

    // 3. Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const dl = document.createElement("a");
    dl.href = url;
    dl.download = `DAAD_Results_(${tasks.length}).csv`;
    document.body.appendChild(dl);
    dl.click();
    updateOverlay("<b>Done!</b>");
    setTimeout(() => overlay.style.display = 'none', 5000);
  }
})();
