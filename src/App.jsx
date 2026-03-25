import React, { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import "./styles.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function round(n, dp = 2) {
  return Number(n.toFixed(dp));
}

function b64ToUint8Array(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function formatAddressLines(text) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");
}

function toPythonTripleQuoted(text) {
  return `"""${text.replace(/"""/g, '\\"""')}"""`;
}

const DEFAULT_RECT = { x: 80, y: 120, width: 180, height: 88 };

export default function App() {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);

  const [pdfPath, setPdfPath] = useState("");
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(0);

  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });
  const [pdfSize, setPdfSize] = useState({ width: 1, height: 1 });

  const [status, setStatus] = useState("Open a PDF to begin.");
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputPath, setOutputPath] = useState("");

  const [oldAddress, setOldAddress] = useState("");
  const [newAddress, setNewAddress] = useState(
    "OCS UK Limited\nNew Century House\nThe Havens\nIpswich\nIP3 9SJ"
  );

  const [previewAddress, setPreviewAddress] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [rect, setRect] = useState(DEFAULT_RECT);

  const cleanOldAddress = useMemo(() => formatAddressLines(oldAddress), [oldAddress]);
  const cleanNewAddress = useMemo(() => formatAddressLines(newAddress), [newAddress]);

  const resetRectangle = () => {
    setRect(DEFAULT_RECT);
  };

  const openPdf = async () => {
    try {
      const selected = await window.pdfAddressEditor.selectPdf();
      if (!selected?.ok) return;

      setStatus("Loading PDF...");
      setOutputPath("");
      setPdfPath(selected.path);
      setPdfDoc(null);
      setPageNum(1);
      setPageCount(0);
      resetRectangle();

      const res = await window.pdfAddressEditor.readPdf(selected.path);
      if (!res?.ok || !res.base64) {
        setStatus("Failed to read PDF.");
        return;
      }

      const bytes = b64ToUint8Array(res.base64);
      const doc = await pdfjsLib.getDocument({ data: bytes }).promise;

      setPdfDoc(doc);
      setPageCount(doc.numPages);
      setPageNum(1);
      setStatus(`Loaded ${selected.path.split(/[/\\]/).pop()}`);
    } catch (error) {
      setStatus(error?.message || "Failed to open PDF.");
    }
  };

  useEffect(() => {
    async function renderPage() {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        const safePageNum = Math.min(Math.max(pageNum, 1), pdfDoc.numPages);
        const page = await pdfDoc.getPage(safePageNum);

        const baseViewport = page.getViewport({ scale: 1 });
        const maxWidth = 900;
        const scale = maxWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        await page.render({ canvasContext: context, viewport }).promise;

        setViewportSize({ width: viewport.width, height: viewport.height });
        setPdfSize({ width: baseViewport.width, height: baseViewport.height });
      } catch (error) {
        setStatus(error?.message || "Failed to render PDF page.");
      }
    }

    renderPage();
  }, [pdfDoc, pageNum]);

  const pointFromEvent = (e) => {
    const bounds = overlayRef.current?.getBoundingClientRect();
    if (!bounds) return null;

    return {
      x: clamp(e.clientX - bounds.left, 0, bounds.width),
      y: clamp(e.clientY - bounds.top, 0, bounds.height)
    };
  };

  const onMouseDown = (e) => {
    if (!pdfDoc) return;

    const p = pointFromEvent(e);
    if (!p) return;

    setIsDrawing(true);
    setDragStart(p);
    setRect({ x: p.x, y: p.y, width: 0, height: 0 });
  };

  const onMouseMove = (e) => {
    if (!isDrawing || !dragStart) return;

    const p = pointFromEvent(e);
    if (!p) return;

    setRect({
      x: Math.min(dragStart.x, p.x),
      y: Math.min(dragStart.y, p.y),
      width: Math.abs(p.x - dragStart.x),
      height: Math.abs(p.y - dragStart.y)
    });
  };

  const onMouseUp = () => {
    setIsDrawing(false);
    setDragStart(null);
  };

  const pdfRect = useMemo(() => {
    const sx = pdfSize.width / viewportSize.width;
    const sy = pdfSize.height / viewportSize.height;

    return {
      x0: round(rect.x * sx),
      y0: round(rect.y * sy),
      x1: round((rect.x + rect.width) * sx),
      y1: round((rect.y + rect.height) * sy)
    };
  }, [rect, pdfSize, viewportSize]);

  const previewLineCount = Math.max(1, cleanNewAddress.split("\n").filter(Boolean).length);

  const previewFontSize = useMemo(() => {
    if (!rect.height || !rect.width) return 14;

    const byHeight = rect.height / (previewLineCount * 1.28);
    const longest = Math.max(...cleanNewAddress.split("\n").map((s) => s.length || 1), 1);
    const byWidth = rect.width / Math.max(longest * 0.62, 1);

    return clamp(Math.min(byHeight, byWidth, 18), 8, 16);
  }, [cleanNewAddress, previewLineCount, rect.height, rect.width]);

  const jsonPayload = useMemo(() => {
    return {
      inputPath: pdfPath,
      page: pageNum,
      pdfRectangle: pdfRect,
      previousAddress: cleanOldAddress,
      newAddress: cleanNewAddress
    };
  }, [pdfPath, pageNum, pdfRect, cleanOldAddress, cleanNewAddress]);

  const pythonConfig = useMemo(() => {
    return `import fitz

INPUT_PDF = r"C:\\path\\to\\invoice.pdf"
OUTPUT_PDF = r"C:\\path\\to\\invoice_corrected.pdf"

OLD_ADDRESS = ${toPythonTripleQuoted(cleanOldAddress)}
NEW_ADDRESS = ${toPythonTripleQuoted(cleanNewAddress)}

COVER_RECT = fitz.Rect(${pdfRect.x0}, ${pdfRect.y0}, ${pdfRect.x1}, ${pdfRect.y1})
TEXT_RECT = fitz.Rect(${pdfRect.x0 + 6}, ${pdfRect.y0 + 6}, ${pdfRect.x1 - 6}, ${pdfRect.y1 - 4})
`;
  }, [cleanOldAddress, cleanNewAddress, pdfRect]);

  const fullPythonScript = useMemo(() => {
    return `import fitz

INPUT_PDF = r"C:\\path\\to\\invoice.pdf"
OUTPUT_PDF = r"C:\\path\\to\\invoice_corrected.pdf"

NEW_ADDRESS = ${toPythonTripleQuoted(cleanNewAddress)}

COVER_RECT = fitz.Rect(${pdfRect.x0}, ${pdfRect.y0}, ${pdfRect.x1}, ${pdfRect.y1})
TEXT_RECT = fitz.Rect(${pdfRect.x0 + 6}, ${pdfRect.y0 + 6}, ${pdfRect.x1 - 6}, ${pdfRect.y1 - 4})

def add_address_with_autofit(page, text_rect, text, max_fontsize=9.5, min_fontsize=6.5):
    fontsize = max_fontsize

    while fontsize >= min_fontsize:
        rc = page.insert_textbox(
            text_rect,
            text,
            fontsize=fontsize,
            fontname="helv",
            color=(0, 0, 0),
            align=0,
            lineheight=1.15,
            overlay=True,
        )
        if rc >= 0:
            return fontsize
        fontsize -= 0.25

    raise ValueError("Address too long to fit.")

def replace_address(input_pdf, output_pdf, new_address):
    doc = fitz.open(input_pdf)
    page = doc[0]
    page.draw_rect(COVER_RECT, color=(1, 1, 1), fill=(1, 1, 1), overlay=True)
    add_address_with_autofit(page, TEXT_RECT, new_address)
    doc.save(output_pdf, garbage=4, deflate=True, clean=True)
    doc.close()

if __name__ == "__main__":
    replace_address(INPUT_PDF, OUTPUT_PDF, NEW_ADDRESS)
`;
  }, [cleanNewAddress, pdfRect]);

  const replaceAddress = async () => {
    if (!pdfPath) return setStatus("Open a PDF first.");
    if (!cleanNewAddress) return setStatus("Enter a new address first.");
    if (rect.width < 10 || rect.height < 10) return setStatus("Draw a valid rectangle first.");

    try {
      setIsProcessing(true);
      setStatus("Replacing address...");

      const result = await window.pdfAddressEditor.replaceAddress({
        inputPath: pdfPath,
        page: pageNum,
        pdfRectangle: pdfRect,
        previousAddress: cleanOldAddress,
        newAddress: cleanNewAddress
      });

      if (result?.ok) {
        setOutputPath(result.outputPath);
        setStatus(`Saved corrected PDF to ${result.outputPath}`);
      } else {
        setStatus(result?.error || "Replacement failed.");
      }
    } catch (error) {
      setStatus(error?.message || "Replacement failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const saveConfigBundle = async () => {
    if (!window.pdfAddressEditor?.saveConfig) {
      setStatus("Save config is not available in this build.");
      return;
    }

    try {
      const result = await window.pdfAddressEditor.saveConfig({
        jsonPayload,
        pythonConfig,
        fullPythonScript
      });

      if (result?.ok) {
        setStatus(`Saved config bundle to ${result.savedTo}`);
      } else {
        setStatus("Save cancelled.");
      }
    } catch (error) {
      setStatus(error?.message || "Failed to save config bundle.");
    }
  };

  return (
    <div className="app-shell">
      <aside className="left-panel">
        <div className="card">
          <div className="card-title">PDF Address Editor</div>
          <div className="muted">
            Open a PDF, draw a rectangle over the address, preview the replacement, then save a corrected copy.
          </div>

          <div className="button-row">
            <button className="primary-btn" onClick={openPdf}>Open PDF</button>
            <button className="secondary-btn" onClick={replaceAddress} disabled={isProcessing}>
              {isProcessing ? "Processing..." : "Replace Address"}
            </button>
          </div>

          <div className="button-row">
            <button className="secondary-btn" onClick={saveConfigBundle}>
              Save Config Bundle
            </button>
          </div>

          <div className="status">{status}</div>
          {pdfPath && <div className="path-label">Loaded: {pdfPath}</div>}
          {outputPath && <div className="path-label">Output: {outputPath}</div>}
        </div>

        <div className="card">
          <div className="card-title">Rectangle</div>
          <div className="grid-two">
            <div className="pill">x: {round(rect.x)}</div>
            <div className="pill">y: {round(rect.y)}</div>
            <div className="pill">w: {round(rect.width)}</div>
            <div className="pill">h: {round(rect.height)}</div>
            <div className="pill">pdf x0: {pdfRect.x0}</div>
            <div className="pill">pdf y0: {pdfRect.y0}</div>
            <div className="pill">pdf x1: {pdfRect.x1}</div>
            <div className="pill">pdf y1: {pdfRect.y1}</div>
          </div>

          <div className="button-row">
            <button className="secondary-btn" onClick={resetRectangle}>
              Reset Rectangle
            </button>
            <button className="secondary-btn" onClick={() => setPreviewAddress((v) => !v)}>
              {previewAddress ? "Hide Preview" : "Show Preview"}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Previous Address</div>
          <textarea
            className="text-input"
            value={oldAddress}
            onChange={(e) => setOldAddress(e.target.value)}
            placeholder="Paste the current address here (optional)"
          />
        </div>

        <div className="card">
          <div className="card-title">New Address</div>
          <textarea
            className="text-input large"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="Enter the replacement address"
          />
        </div>

        <div className="card">
          <div className="card-title">Page Controls</div>
          <div className="button-row">
            <button
              className="secondary-btn"
              disabled={pageNum <= 1}
              onClick={() => setPageNum((p) => p - 1)}
            >
              Prev
            </button>

            <div className="pill">Page {pageNum} / {pageCount || 1}</div>

            <button
              className="secondary-btn"
              disabled={!pageCount || pageNum >= pageCount}
              onClick={() => setPageNum((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </aside>

      <main className="preview-panel">
        <div className="preview-card">
          <div className="preview-title">PDF Preview</div>

          <div className="canvas-wrapper">
            <div
              ref={overlayRef}
              className="overlay-surface"
              style={{ width: viewportSize.width, height: viewportSize.height }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              <canvas ref={canvasRef} className="pdf-canvas" />

              <div
                className="selection-rect"
                style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
              />

              {previewAddress && cleanNewAddress && rect.width > 10 && rect.height > 10 && (
                <div
                  className="preview-text"
                  style={{
                    left: rect.x,
                    top: rect.y,
                    width: rect.width,
                    height: rect.height,
                    fontSize: `${previewFontSize}px`
                  }}
                >
                  {cleanNewAddress}
                </div>
              )}
            </div>

            {!pdfDoc && <div className="empty-state">Open a PDF to start editing.</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
