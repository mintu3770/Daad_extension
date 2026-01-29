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

  // --- FEATURE 1: AUTO-LOAD ALL (With Smart Stop) ---
  async function autoLoad() {
    updateOverlay("<b>Auto-Loading...</b><br>Do not touch the page.");
    
    let keepGoing = true;
    let clicks = 0;
    let previousCount = 0;

    while (keepGoing) {
      // 1. Get current count
      const currentCount = document.querySelectorAll('a[href*="/detail/"]').length;
      
      // 2. STOP CHECK: If we clicked but count didn't grow, we are done.
      if (clicks > 0 && currentCount === previousCount) {
        keepGoing = false;
        break;
      }
      
      previousCount = currentCount; // Update for next comparison

      // 3. Scroll to bottom
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 1000));

      // 4. Find Button
      const buttons = Array.from(document.querySelectorAll('button, a.btn'));
      const moreBtn = buttons.find(b => 
        (b.innerText.toLowerCase().includes('more') || 
         b.innerText.toLowerCase().includes('mehr') ||
         b.innerText.toLowerCase().includes('show')) &&
        b.offsetParent !== null // Must be visible
      );

      if (moreBtn) { 
        moreBtn.click();
        clicks++;
        updateOverlay(`<b>Expanding...</b><br>Clicked 'More' ${clicks} times.<br>Count: ${currentCount}`);
        
        // Wait longer for the server to reply (2.5 seconds)
        await new Promise(r => setTimeout(r, 2500)); 
      } else {
        // No button found = End of list
        keepGoing = false;
      }
    }
    
    const finalCount = document.querySelectorAll('a[href*="/detail/"]').length;
    updateOverlay(`<b>Finished!</b><br>Found ${finalCount} courses.<br>Now click 'Step 2'.`);
    alert(`Expansion Complete!\n\nI found ${finalCount} courses.\n\nYou can now click 'Step 2: Download Excel'.`);
  }

  // --- FEATURE 2: THE SCRAPER (No Details Column) ---
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

    if (tasks.length === 0) {
      alert("Error: 0 items found. Did you run Step 1?");
      return;
    }

    updateOverlay(`<b>Starting Scrape...</b><br>Queue: ${tasks.length} items.`);

    // --- CSV HEADER (Details Removed) ---
    let csvContent = "\uFEFFCourse Name,University,City,Tuition,Language,Deadline,Link\n";
    
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      updateOverlay(`<b>Scraping: ${i + 1}/${tasks.length}</b><br>${task.rawTitle.substring(0,25)}...`);

      // Title Splitting Logic
      let courseName = "N/A", uniName = "N/A", cityName = "N/A";
      const parts = task.rawTitle.split("•");

      if (parts.length >= 3) {
          courseName = parts[0].trim();
          uniName = parts[1].trim();
          cityName = parts[2].trim();
      } else if (parts.length === 2) {
          courseName = parts[0].trim();
          uniName = parts[1].trim();
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
        
        // --- ADD TO CSV (Details Removed) ---
        csvContent += `"${courseName}","${uniName}","${cityName}","${tuition}","${lang}","${deadline}","${task.url}"\n`;

      } catch (e) { console.error(e); }
      
      // Fast delay
      await new Promise(r => setTimeout(r, 1000));
    }

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
