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

  // --- MAIN ORCHESTRATOR (The Chain) ---
  async function orchestrator() {
    try {
      // Phase 1: Expand
      updateOverlay("<b>Phase 1: Expanding List...</b><br>Do not touch the page.");
      const count = await autoLoad(); // Wait for this to finish completely
      
      // Phase 2: Scrape
      updateOverlay(`<b>Phase 2: Scraping ${count} items...</b><br>Preparing download.`);
      await new Promise(r => setTimeout(r, 1000)); // Brief pause for stability
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
      
      // Stop condition: If we clicked but count didn't change
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

  // --- LOGIC 2: SCRAPER ---
  async function startScrape() {
    const allLinks = Array.from(document.querySelectorAll('a[href*="/detail/"]'));
    const uniqueUrls = new Set();
    const tasks = [];

    allLinks.forEach(link => {
        const fullText = link.innerText.trim();
        if (!uniqueUrls.has(link.href) && fullText.length > 5) {
            uniqueUrls.add(link.href);
            tasks.push({ url: link.href, rawTitle: fullText });
        }
    });

    let csvContent = "\uFEFFCourse Name,University,City,Tuition,Language,Deadline,Link\n";
    
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      updateOverlay(`<b>Scraping: ${i + 1}/${tasks.length}</b><br>${task.rawTitle.substring(0,25)}...`);

      // Title Splitting
      let courseName = "N/A", uniName = "N/A", cityName = "N/A";
      const parts = task.rawTitle.split("•");
      if (parts.length >= 3) {
          courseName = parts[0].trim(); uniName = parts[1].trim(); cityName = parts[2].trim();
      } else {
          courseName = task.rawTitle;
      }

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

        if (uniName === "N/A") uniName = clean(doc.querySelector('.c-detail-header__institution'));
        if (cityName === "N/A") cityName = clean(doc.querySelector('.c-detail-header__city')).replace(/Germany/i,'').trim();
        const tuition = getDef(['tuition', 'fees', 'cost']);
        const lang = getDef(['language', 'instruction']);
        const deadline = getDef(['deadline', 'application']);
        
        csvContent += `"${courseName}","${uniName}","${cityName}","${tuition}","${lang}","${deadline}","${task.url}"\n`;

      } catch (e) { console.error(e); }
      await new Promise(r => setTimeout(r, 800)); // Slightly faster since user isn't clicking
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const dl = document.createElement("a");
    dl.href = url;
    dl.download = `DAAD_Final_List.csv`;
    document.body.appendChild(dl);
    dl.click();
    
    updateOverlay("<b>✅ Process Complete!</b><br>Check your downloads folder.");
    setTimeout(() => overlay.style.display = 'none', 6000);
  }
})();
