/**
 * MeiTrans PDF Selection Script
 * Listens for text selection in PDF.js viewer and sends to parent window
 */
(function() {
  console.log('[MeiTrans PDF] Selection script loaded');

  let selectionTimeout = null;
  let lastSentText = '';

  // Function to get selected text
  function getSelectedText() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return '';
    return selection.toString().trim();
  }

  // Function to send selection to parent
  function sendSelection(text) {
    if (!text || text === lastSentText) return;
    lastSentText = text;

    try {
      window.parent.postMessage({
        type: 'pdf-selection',
        text: text
      }, '*');
      console.log('[MeiTrans PDF] Selection sent:', text.substring(0, 50));
    } catch (e) {
      console.error('[MeiTrans PDF] Failed to send:', e);
    }
  }

  // Listen for mouseup on the entire document
  document.addEventListener('mouseup', function(e) {
    if (selectionTimeout) {
      clearTimeout(selectionTimeout);
    }

    selectionTimeout = setTimeout(function() {
      const selectedText = getSelectedText();
      if (selectedText && selectedText.length > 0) {
        sendSelection(selectedText);
      }
    }, 200);
  }, true);

  // Also listen for keyboard selection (Ctrl+A, Shift+Arrow, etc.)
  document.addEventListener('keyup', function(e) {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      setTimeout(function() {
        const selectedText = getSelectedText();
        if (selectedText && selectedText.length > 0) {
          sendSelection(selectedText);
        }
      }, 100);
    }
  }, true);

  // Notify parent that viewer is ready
  if (document.readyState === 'complete') {
    window.parent.postMessage({ type: 'pdf-viewer-ready' }, '*');
    console.log('[MeiTrans PDF] Viewer ready (immediate)');
  } else {
    window.addEventListener('load', function() {
      window.parent.postMessage({ type: 'pdf-viewer-ready' }, '*');
      console.log('[MeiTrans PDF] Viewer ready');
    });
  }
})();
