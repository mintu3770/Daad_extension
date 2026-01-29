// Helper to send messages to content script
function sendCommand(command) {
  const status = document.getElementById("status");
  status.innerText = command === "load" ? "Expanding list..." : "Starting scrape...";
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ["content.js"]
    }, () => {
      // After injection, send the specific command
      chrome.tabs.sendMessage(tabs[0].id, { action: command });
    });
  });
}

document.getElementById("loadBtn").addEventListener("click", () => sendCommand("load"));
document.getElementById("scrapeBtn").addEventListener("click", () => sendCommand("scrape"));
