(function() {
  if (window.hasRun) return;
  window.hasRun = true;

  // --- UI OVERLAY ---
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', bottom: '20px', right: '20px', padding: '15px',
    backgroundColor: '#222', color: '#fff', zIndex: '99999',
    borderRadius: '8px', fontFamily: 'sans-serif', fontSize: '13px', display: 'none',
    boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
  });
  document.body.appendChild(overlay);

  function updateOverlay(text) {
    overlay.style.display = 'block';
    overlay.innerHTML = text;
  }

  // --- LISTEN FOR COMMAND ---
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "run_all") orchestrator();
  });

  // --- ORCHESTRATOR ---
  async function orchestrator() {
    try {
      updateOverlay("<b>Phase 1: Expanding List...</b><br>Do not touch the page.");
      const count = await autoLoad(); 
      
      updateOverlay(`<b>Phase 2: Scraping ${count} items...</b><br>Analyzing text structure...`);
      await new Promise(r => setTimeout(r, 1000)); 
      await startScrape();
      
    } catch (err) {
      console.error(err);
      updateOverlay("<b>Error:</b> " + err.message);
    }
  }

  // --- LOGIC 1: AUTO-LOADER ---
  async function autoLoad() {
    let keepGoing = true;
    let clicks = 0;
    let previousCount = 0;

    while (keepGoing) {
      const currentCount = document.querySelectorAll('a[href*="/detail/"]').length;
      if (clicks > 0 && currentCount === previousCount) break;
      previousCount = currentCount;

      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 1000));

      const buttons = Array.from(document.querySelectorAll('button, a.btn'));
      const moreBtn = buttons.find(b => 
        (b.innerText.toLowerCase().includes('more') || 
         b.innerText.toLowerCase().includes('mehr') ||
         b.innerText.toLowerCase().includes('show')) &&
        b.offsetParent !== null
      );

      if (moreBtn) { 
        moreBtn.click();
        clicks++;
        updateOverlay(`<b>Expanding List...</b><br>Clicked 'More' ${clicks} times.<br>Found: ${currentCount}`);
        await new Promise(r => setTimeout(r, 2500)); 
      } else {
        keepGoing = false;
      }
    }
    return document.querySelectorAll('a[href*="/detail/"]').length;
  }

  // --- LOGIC 2: SCRAPER (FIXED FOR MISMATCH) ---
  async function startScrape() {
    // 1. Collect ALL Links
    const allLinks = Array.from(document.querySelectorAll('a[href*="/detail/"]'));
    const urlMap = new Map();

    // 2. INTELLIGENT SELECTION (The Fix)
    // DAAD has multiple links per course (Image, Badge, Title).
    // We strictly keep the one with the LONGEST text (The Title).
    allLinks.forEach(link => {
        const fullText = link.innerText.trim();
        const href = link.href;

        if (fullText.length > 2) { // Ignore empty icons
            if (!urlMap.has(href)) {
                // New URL? Add it.
                urlMap.set(href, fullText);
            } else {
                // Existing URL? Check if this text is better (longer).
                const currentText = urlMap.get(href);
                if (fullText.length > currentText.length) {
                    urlMap.set(href, fullText);
                }
            }
        }
    });

    const tasks = Array.from(urlMap, ([url, title]) => ({ url, rawTitle: title }));

    if (tasks.length === 0) {
      alert("Error: 0 items found. Did you run Step 1?");
      return;
    }

    let csvContent = "\uFEFFCourse Name,University,City,Tuition,Language,Deadline,Link\n";
    
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      updateOverlay(`<b>Scraping: ${i + 1}/${tasks.length}</b><br>${task.rawTitle.substring(0,30)}...`);

      // 3. SPLITTING LOGIC (Handles both layouts)
      let courseName = "N/A", uniName = "N/A", cityName = "N/A";
      
      // Clean up common prefixes that mess up data
      let cleanTitle = task.rawTitle.replace("Master's degree", "").replace("Bachelor's degree", "").trim();

      if (cleanTitle.includes("•")) {
          // Scenario A: "Course • Uni • City" (Screenshot 1)
          const parts = cleanTitle.split("•");
          courseName = parts[0]?.trim() || cleanTitle;
          uniName = parts[1]?.trim() || "N/A";
          cityName = parts[2]?.trim() || "N/A";
      } else {
          // Scenario B: Just Title (Screenshot 2 might fallback to this)
          courseName = cleanTitle;
          // Uni/City will be fetched from inside the page below
      }

      try {
        const response = await fetch(task.url);
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/html");
        
        const clean = (t) => t ? t.textContent.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, ' ').replace(/,/g, ";").trim() : "N/A";
        
        // Helper to find data
        const getDef = (keys) => {
            const el = Array.from(doc.querySelectorAll('dt')).find(dt => keys.some(k => dt.textContent.toLowerCase().includes(k)));
            return el?.nextElementSibling ? clean(el.nextElementSibling) : "N/A";
        };

        // 4. FALLBACK EXTRACTION
        // If splitting didn't find Uni/City, grab it from the page header
        if (uniName === "N/A" || uniName.length < 3) {
            uniName = clean(doc.querySelector('.c-detail-header__institution'));
        }
        if (cityName === "N/A" || cityName.length < 3) {
            cityName = clean(doc.querySelector('.c-detail-header__city')).replace(/Germany/i,'').trim();
        }

        const tuition = getDef(['tuition', 'fees', 'cost']);
        const lang = getDef(['language', 'instruction']);
        const deadline = getDef(['deadline', 'application']);
        
        csvContent += `"${courseName}","${uniName}","${cityName}","${tuition}","${lang}","${deadline}","${task.url}"\n`;

      } catch (e) { console.error(e); }
      await new Promise(r => setTimeout(r, 800)); 
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const dl = document.createElement("a");
    dl.href = url;
    dl.download = `DAAD_Final_Corrected.csv`;
    document.body.appendChild(dl);
    dl.click();
    
    updateOverlay("<b>✅ Done!</b><br>Mismatch fixed.");
    setTimeout(() => overlay.style.display = 'none', 6000);
  }
})();
