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
      updateOverlay("<b>Phase 1: Expanding...</b><br>Do not touch the page.");
      const count = await autoLoad();
      
      updateOverlay(`<b>Phase 2: Scraping ${count} items...</b><br>Applying Smart Fixes...`);
      await new Promise(r => setTimeout(r, 1000)); 
      await startScrape();
    } catch (err) {
      console.error(err);
      updateOverlay("<b>Error:</b> " + err.message);
    }
  }

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
        updateOverlay(`<b>Expanding...</b><br>Clicked 'More' ${clicks} times.<br>Found: ${currentCount}`);
        await new Promise(r => setTimeout(r, 2500)); 
      } else {
        keepGoing = false;
      }
    }
    return document.querySelectorAll('a[href*="/detail/"]').length;
  }

  async function startScrape() {
    // 1. Collect Links (Longest Text Wins Strategy)
    const allLinks = Array.from(document.querySelectorAll('a[href*="/detail/"]'));
    const urlMap = new Map();

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

      // --- THE SMART FIX ---
      let courseName = "N/A", uniName = "N/A", cityName = "N/A";

      // 1. Remove Labels AND loose punctuation
      // Example: "Master's degree • AI" -> " • AI" -> "AI"
      let cleanTitle = task.rawTitle
        .replace(/Master's degree/gi, "")
        .replace(/Bachelor's degree/gi, "")
        .trim();

      // 2. Remove leading bullet points (The "Ghost Bullet" Fix)
      // Removes any dots, dashes, or bars from the START of the string
      cleanTitle = cleanTitle.replace(/^[•·\-\|]\s*/, "");

      // 3. Smart Split
      // We ignore empty parts to prevent column shifting
      if (cleanTitle.includes("•")) {
          const parts = cleanTitle.split("•").map(p => p.trim()).filter(p => p.length > 0);
          
          if (parts.length >= 3) {
             // Perfect: Course • Uni • City
             courseName = parts[0];
             uniName = parts[1];
             cityName = parts[2];
          } else if (parts.length === 2) {
             // Partial: Course • Uni
             courseName = parts[0];
             uniName = parts[1];
          } else {
             // Just Course
             courseName = parts[0];
          }
      } else {
          // No bullets found
          courseName = cleanTitle;
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

        // Fallback: If split failed, grab Uni/City from page header
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
    dl.download = `DAAD_Corrected_List.csv`;
    document.body.appendChild(dl);
    dl.click();
    
    updateOverlay("<b>✅ Success!</b><br>Columns aligned.");
    setTimeout(() => overlay.style.display = 'none', 6000);
  }
})();
