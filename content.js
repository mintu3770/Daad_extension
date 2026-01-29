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

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "run_all") orchestrator();
  });

  async function orchestrator() {
    try {
      updateOverlay("<b>Phase 1: Expanding...</b><br>Initializing Observer...");
      const count = await autoLoad();
      
      updateOverlay(`<b>Phase 2: Scraping ${count} items...</b><br>Smart-Parsing Data...`);
      await new Promise(r => setTimeout(r, 1000)); 
      await startScrape();
    } catch (err) {
      console.error(err);
      updateOverlay("<b>Error:</b> " + err.message);
    }
  }

  // --- NEW: THE PROFESSIONAL WAITER (MutationObserver) ---
  function waitForNewEntries(previousCount, timeout = 10000) {
    return new Promise((resolve) => {
      // Selector for the course links
      const selector = 'a[href*="/detail/"]';
      
      // 1. Check immediately (in case it loaded instantly)
      if (document.querySelectorAll(selector).length > previousCount) {
         return resolve(true);
      }

      // 2. Setup the "Sensor"
      const observer = new MutationObserver(() => {
         const currentCount = document.querySelectorAll(selector).length;
         if (currentCount > previousCount) {
           observer.disconnect(); // Stop watching to save resources
           resolve(true);
         }
      });

      // 3. Start Watching the Body for changes
      observer.observe(document.body, { childList: true, subtree: true });

      // 4. Safety Timeout (If network dies, don't hang forever)
      setTimeout(() => {
        observer.disconnect();
        resolve(false); // Resolved false means "Timed out, no new items"
      }, timeout);
    });
  }

  // --- UPGRADED AUTO-LOADER ---
  async function autoLoad() {
    let keepGoing = true;
    let clicks = 0;

    while (keepGoing) {
      const links = document.querySelectorAll('a[href*="/detail/"]');
      const previousCount = links.length;

      // Scroll to bottom (Trigger lazy load elements)
      window.scrollTo(0, document.body.scrollHeight);
      
      // Find "Show More" Button
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
        updateOverlay(`<b>Expanding...</b><br>Clicked 'More' ${clicks} times.<br>Count: ${previousCount}`);
        
        // --- THE UPGRADE IS HERE ---
        // Instead of sleeping 2.5s, we wait EXACTLY until new items appear.
        // This makes it fast on fast wifi, and reliable on slow wifi.
        const success = await waitForNewEntries(previousCount);
        
        if (!success) {
           // If we waited 10s and nothing appeared, assume end of list
           keepGoing = false;
        }
      } else {
        // No button found
        keepGoing = false;
      }
    }
    return document.querySelectorAll('a[href*="/detail/"]').length;
  }

  async function startScrape() {
    const allLinks = Array.from(document.querySelectorAll('a[href*="/detail/"]'));
    const urlMap = new Map();

    // Deduplication Logic
    allLinks.forEach(link => {
        const fullText = link.innerText.trim();
        const href = link.href;
        if (fullText.length > 2) { 
            if (!urlMap.has(href)) {
                urlMap.set(href, fullText);
            } else {
                if (fullText.length > urlMap.get(href).length) {
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

      // Cleaning & Parsing Logic
      let cleanTitle = task.rawTitle
        .replace(/Master's degree/gi, "")
        .replace(/Bachelor's degree/gi, "")
        .trim();
      cleanTitle = cleanTitle.replace(/^[•·\-\|]\s*/, "");

      let courseName = "N/A", uniName = "N/A", cityName = "N/A";
      if (cleanTitle.includes("•")) {
          const parts = cleanTitle.split("•").map(p => p.trim()).filter(p => p.length > 0);
          if (parts.length >= 3) { courseName = parts[0]; uniName = parts[1]; cityName = parts[2]; }
          else if (parts.length === 2) { courseName = parts[0]; uniName = parts[1]; }
          else { courseName = parts[0]; }
      } else {
          courseName = cleanTitle;
      }

      try {
        // NOTE: We KEEP setTimeout here for "Rate Limiting". 
        // Removing this does not make it professional; it makes it a DDoS attack.
        // Professional scrapers always throttle requests to respect the server.
        const response = await fetch(task.url);
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/html");
        
        const clean = (t) => t ? t.textContent.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, ' ').replace(/,/g, ";").trim() : "N/A";
        const getDef = (keys) => {
            const el = Array.from(doc.querySelectorAll('dt')).find(dt => keys.some(k => dt.textContent.toLowerCase().includes(k)));
            return el?.nextElementSibling ? clean(el.nextElementSibling) : "N/A";
        };

        if (uniName === "N/A" || uniName.length < 3) uniName = clean(doc.querySelector('.c-detail-header__institution'));
        if (cityName === "N/A" || cityName.length < 3) cityName = clean(doc.querySelector('.c-detail-header__city')).replace(/Germany/i,'').trim();

        const tuition = getDef(['tuition', 'fees', 'cost']);
        const lang = getDef(['language', 'instruction']);
        const deadline = getDef(['deadline', 'application']);
        
        csvContent += `"${courseName}","${uniName}","${cityName}","${tuition}","${lang}","${deadline}","${task.url}"\n`;

      } catch (e) { console.error(e); }
      
      // Professional Rate Limiting (Do not remove)
      await new Promise(r => setTimeout(r, 800)); 
    }

    // Save File
    let userFilename = prompt("Enter a name for your file:", "DAAD_Shortlist");
    if (!userFilename) userFilename = "DAAD_Shortlist";
    if (!userFilename.toLowerCase().endsWith(".csv")) userFilename += ".csv";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const dl = document.createElement("a");
    dl.href = url;
    dl.download = userFilename;
    document.body.appendChild(dl);
    dl.click();
    
    updateOverlay("<b>✅ Success!</b><br>File saved.");
    setTimeout(() => overlay.style.display = 'none', 6000);
  }
})();
