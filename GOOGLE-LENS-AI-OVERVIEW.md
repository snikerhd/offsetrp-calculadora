# Google Lens AI Overview (best-effort)

The `/api/ocr` route now makes a short, server-side attempt to read inventory-like lines already embedded in the initial HTML returned by Google Lens/Search before running the existing image OCR flow.

Important limitation: Google often builds the AI Overview dynamically in the browser and may not include its final text in the initial HTML response. In that case, this change cannot copy the AI Overview itself; the existing Google Lens OCR/Gemini fallback continues to run. No paid API key or browser extension was added.

To make extraction of the dynamically rendered AI Overview reliable, a real browser automation runtime would be needed on the server (and Google may still block automated access). This version deliberately avoids adding large browser dependencies that could break the current deployment.
