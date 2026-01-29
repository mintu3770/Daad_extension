document.getElementById("downloadBtn").addEventListener("click", () => {
  const statusDiv = document.getElementById("status");
  statusDiv.textContent = "Scanning page...";

  // Get the current active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    // Send a message to the content script running on the page
    chrome.tabs.sendMessage(tabs[0].id, { action: "scrape" }, (response) => {
      if (chrome.runtime.lastError) {
        statusDiv.textContent = "Error: Please refresh the DAAD page and try again.";
      } else if (response && response.count > 0) {
        statusDiv.textContent = `Success! Downloaded ${response.count} items.`;
      } else {
        statusDiv.textContent = "No results found on this page.";
      }
    });
  });
});
