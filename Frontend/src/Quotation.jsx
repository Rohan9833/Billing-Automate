import { useState, useRef } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import "./App.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const createItem = () => ({
  particulars: "",
  hsn: "",
  qty: "",
  rate: "",
});

function Quotation() {
  const [form, setForm] = useState({
    name: "",
    date: "",
    quotationFor: "",
    cgst: "",
    sgst: "",
  });

  const [items, setItems] = useState(
    Array.from({ length: 5 }, () => createItem()),
  );

  const [pdfUrl, setPdfUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("quotationHistory")) || [];
    } catch {
      return [];
    }
  });

  const historySavingRef = useRef(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];

    updated[index] = {
      ...updated[index],
      [field]: value,
    };

    setItems(updated);
  };

  const addItem = () => {
    setItems([...items, createItem()]);
  };

  const removeItem = (index) => {
    if (index < 5) return;

    setItems(items.filter((_, i) => i !== index));
  };

  const getAmount = (item) => {
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;

    return qty * rate;
  };

  const getTotal = () => {
    return items.reduce((total, item) => {
      return total + getAmount(item);
    }, 0);
  };

  const getCgstAmount = () => {
    const total = getTotal();
    const cgst = Number(form.cgst) || 0;

    return (total * cgst) / 100;
  };

  const getSgstAmount = () => {
    const total = getTotal();
    const sgst = Number(form.sgst) || 0;

    return (total * sgst) / 100;
  };

  const getGrandTotal = () => {
    return getTotal() + getCgstAmount() + getSgstAmount();
  };

  const numberToWords = (number) => {
    if (!number) {
      return "ZERO RUPEES ONLY";
    }

    const ones = [
      "",
      "ONE",
      "TWO",
      "THREE",
      "FOUR",
      "FIVE",
      "SIX",
      "SEVEN",
      "EIGHT",
      "NINE",
      "TEN",
      "ELEVEN",
      "TWELVE",
      "THIRTEEN",
      "FOURTEEN",
      "FIFTEEN",
      "SIXTEEN",
      "SEVENTEEN",
      "EIGHTEEN",
      "NINETEEN",
    ];

    const tens = [
      "",
      "",
      "TWENTY",
      "THIRTY",
      "FORTY",
      "FIFTY",
      "SIXTY",
      "SEVENTY",
      "EIGHTY",
      "NINETY",
    ];

    const convert = (n) => {
      if (n < 20) {
        return ones[n];
      }

      if (n < 100) {
        return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
      }

      if (n < 1000) {
        return (
          ones[Math.floor(n / 100)] +
          " HUNDRED" +
          (n % 100 ? " " + convert(n % 100) : "")
        );
      }

      if (n < 100000) {
        return (
          convert(Math.floor(n / 1000)) +
          " THOUSAND" +
          (n % 1000 ? " " + convert(n % 1000) : "")
        );
      }

      if (n < 10000000) {
        return (
          convert(Math.floor(n / 100000)) +
          " LAKH" +
          (n % 100000 ? " " + convert(n % 100000) : "")
        );
      }

      return (
        convert(Math.floor(n / 10000000)) +
        " CRORE" +
        (n % 10000000 ? " " + convert(n % 10000000) : "")
      );
    };

    return `${convert(Math.floor(number))} RUPEES ONLY`;
  };

  const addText = (page, font, text, x, y, size = 8) => {
    if (!text) return;

    page.drawText(String(text), {
      x,
      y,
      size,
      font,
      color: rgb(0, 0, 0),
    });
  };

  // =========================
  // HISTORY
  // =========================

  const saveToHistory = () => {
    if (historySavingRef.current) {
      return;
    }

    historySavingRef.current = true;

    try {
      const quotation = {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,

        name: form.name,
        date: form.date,
        quotationFor: form.quotationFor,
        cgst: form.cgst,
        sgst: form.sgst,
        items: [...items],
        total: getTotal(),
        grandTotal: getGrandTotal(),
        createdAt: new Date().toISOString(),
      };

      let currentHistory = [];

      try {
        currentHistory =
          JSON.parse(localStorage.getItem("quotationHistory")) || [];
      } catch {
        currentHistory = [];
      }

      const updatedHistory = [quotation, ...currentHistory];

      localStorage.setItem("quotationHistory", JSON.stringify(updatedHistory));

      setHistory(updatedHistory);
    } finally {
      historySavingRef.current = false;
    }
  };

  const deleteHistory = (id) => {
    const updatedHistory = history.filter((quotation) => quotation.id !== id);

    setHistory(updatedHistory);

    localStorage.setItem("quotationHistory", JSON.stringify(updatedHistory));
  };

  const loadHistory = (quotation) => {
    setForm({
      name: quotation.name || "",
      date: quotation.date || "",
      quotationFor: quotation.quotationFor || "",
      cgst: quotation.cgst || "",
      sgst: quotation.sgst || "",
    });

    setItems(
      quotation.items?.length
        ? quotation.items
        : Array.from({ length: 5 }, () => createItem()),
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // =========================
  // GENERATE QUOTATION
  // =========================

  const generateQuotation = async () => {
    try {
      setLoading(true);

      const response = await fetch("/Quotation-template.pdf", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `Quotation template not found. Status: ${response.status}`,
        );
      }

      const templateBytes = new Uint8Array(await response.arrayBuffer());

      const header = new TextDecoder().decode(templateBytes.slice(0, 5));

      if (header !== "%PDF-") {
        throw new Error("quotation-template.pdf valid PDF nahi hai");
      }

      const pdfDoc = await PDFDocument.load(templateBytes);

      const page = pdfDoc.getPages()[0];

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // =========================
      // TOP DETAILS
      // =========================

      // To
      addText(page, font, form.name, 112, 584, 10);

      // Date
      addText(page, font, form.date, 464, 582, 10);

      // Quotation For
      addText(page, font, form.quotationFor, 168, 532, 10);

// =========================
// ITEMS
// =========================

let y = 485;
let srNo = 1;

items.forEach((item) => {
  if (!item.particulars && !item.hsn && !item.qty && !item.rate) {
    return;
  }

  const amount = getAmount(item);

  // Sr No
  addText(page, font, srNo, 80, y, 9);

  // Particulars
  addText(page, font, item.particulars, 108, y, 9);

  // HSN
  addText(page, font, item.hsn, 302, y, 9);

  // Qty
  addText(page, font, item.qty, 360, y, 9);

  // Rate
  addText(page, font, item.rate, 402, y, 9);

  // Amount
  if (amount) {
    const [rupees, paise] = amount.toFixed(2).split(".");

    addText(page, font, rupees, 445, y, 9);
    addText(page, font, paise, 512.5, y, 9);
  }

  srNo++;

  // Next PDF row
  y -= 18.6;
});

      // =========================
      // TOTALS
      // =========================

      const total = getTotal();
      const cgst = getCgstAmount();
      const sgst = getSgstAmount();
      const grandTotal = getGrandTotal();

      const addAmountWithPaise = (amount, rupeesX, paiseX, y) => {
        const [rupees, paise] = amount.toFixed(2).split(".");

        addText(page, font, rupees, rupeesX, y, 9);

        addText(page, font, paise, paiseX, y, 9);
      };

      // Total
      addAmountWithPaise(total, 445, 512.5, 244);

      // CGST %
      addText(page, font, form.cgst ? `${form.cgst}` : "", 400, 220, 9);

      // CGST Amount
      addAmountWithPaise(cgst, 445, 512.5, 220);

      // SGST %
      addText(page, font, form.sgst ? `${form.sgst}` : "", 400, 196, 9);

      // SGST Amount
      addAmountWithPaise(sgst, 445, 512.5, 196);

      // Grand Total
      addAmountWithPaise(grandTotal, 445, 512.5, 172);

      // =========================
      // AMOUNT IN WORDS
      // =========================

      const amountInWords = numberToWords(grandTotal);

      const words = amountInWords.split(" ");

      // First line is beside RUPEES
      // Second line is below it
      const lineX = [120, 72];
      const lineY = [224, 198];
      const lineLimit = [42, 45];

      let currentLine = "";
      let lineIndex = 0;

      words.forEach((word) => {
        if (lineIndex >= lineLimit.length) {
          return;
        }

        const testLine = currentLine ? `${currentLine} ${word}` : word;

        if (testLine.length <= lineLimit[lineIndex]) {
          currentLine = testLine;
        } else {
          addText(
            page,
            font,
            currentLine,
            lineX[lineIndex],
            lineY[lineIndex],
            9,
          );

          lineIndex++;
          currentLine = word;
        }
      });

      if (currentLine && lineIndex < lineLimit.length) {
        addText(page, font, currentLine, lineX[lineIndex], lineY[lineIndex], 9);
      }

      // =========================
      // SAVE PDF
      // =========================

      const finalPdf = await pdfDoc.save();

      const blob = new Blob([finalPdf], {
        type: "application/pdf",
      });

      const url = URL.createObjectURL(blob);

      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }

      setPdfUrl(url);

      saveToHistory();
    } catch (error) {
      console.error("Generate Quotation Error:", error);

      alert(
        error.message ||
          "Quotation generate nahi ho payi. Template PDF check karo.",
      );
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!pdfUrl) return;

    const link = document.createElement("a");

    link.href = pdfUrl;

    link.download = `${form.quotationFor || "quotation"}.pdf`;

    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const downloadImage = async () => {
    if (!pdfUrl) return;

    try {
      const pdf = await pdfjsLib.getDocument(pdfUrl).promise;

      const page = await pdf.getPage(1);

      const viewport = page.getViewport({
        scale: 2,
      });

      const canvas = document.createElement("canvas");

      const context = canvas.getContext("2d");

      canvas.width = viewport.width;

      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      const image = canvas.toDataURL("image/png");

      const link = document.createElement("a");

      link.href = image;

      link.download = `${form.quotationFor || "quotation"}.png`;

      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error(error);

      alert("Image generate nahi ho payi.");
    }
  };

  return (
    <>
      <div className="page-title">
        <h1>Quotation</h1>
        <p>Create your quotation</p>
      </div>

      <div className="form-card">
        {/* QUOTATION DETAILS */}

        <div className="section-title">Quotation Details</div>

        <div className="form-grid">
          <div className="field">
            <label>To</label>

            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter customer name"
            />
          </div>

          <div className="field">
            <label>Date</label>

            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
            />
          </div>

          <div className="field">
            <label>Quotation For</label>

            <input
              name="quotationFor"
              value={form.quotationFor}
              onChange={handleChange}
              placeholder="Enter quotation details"
            />
          </div>
        </div>

        {/* ITEMS */}

        <div className="section-title items-title">Items</div>

        <div className="items-list">
          {items.map((item, index) => (
            <div className="item-card" key={index}>
              <div className="item-top">
                <span>Item {index + 1}</span>

                {index >= 5 && (
                  <button
                    type="button"
                    className="remove-item"
                    onClick={() => removeItem(index)}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="item-fields">
                <div className="field particulars">
                  <label>Particulars</label>

                  <input
                    value={item.particulars}
                    onChange={(e) =>
                      handleItemChange(index, "particulars", e.target.value)
                    }
                    placeholder="Product / service"
                  />
                </div>

                <div className="field">
                  <label>HSN</label>

                  <input
                    value={item.hsn}
                    onChange={(e) =>
                      handleItemChange(index, "hsn", e.target.value)
                    }
                    placeholder="HSN"
                  />
                </div>

                <div className="field">
                  <label>Qty</label>

                  <input
                    type="number"
                    min="0"
                    value={item.qty}
                    onChange={(e) =>
                      handleItemChange(index, "qty", e.target.value)
                    }
                    placeholder="Qty"
                  />
                </div>

                <div className="field">
                  <label>Rate</label>

                  <input
                    type="number"
                    min="0"
                    value={item.rate}
                    onChange={(e) =>
                      handleItemChange(index, "rate", e.target.value)
                    }
                    placeholder="Rate"
                  />
                </div>

                <div className="item-amount">
                  <span>Amount</span>

                  <strong>₹ {getAmount(item).toFixed(2)}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ADD ITEM */}

        <button type="button" className="add-item-btn" onClick={addItem}>
          + Add Item
        </button>

        {/* GST */}

        <div className="gst-section">
          <div className="field">
            <label>CGST %</label>

            <input
              type="number"
              min="0"
              name="cgst"
              value={form.cgst}
              onChange={handleChange}
              placeholder="0"
            />
          </div>

          <div className="field">
            <label>SGST %</label>

            <input
              type="number"
              min="0"
              name="sgst"
              value={form.sgst}
              onChange={handleChange}
              placeholder="0"
            />
          </div>

          <div className="total-box">
            <span>Total</span>

            <strong>₹ {getTotal().toFixed(2)}</strong>
          </div>

          <div className="total-box grand">
            <span>Grand Total</span>

            <strong>₹ {getGrandTotal().toFixed(2)}</strong>
          </div>
        </div>

        {/* GENERATE */}

        <button
          type="button"
          className="generate-btn"
          onClick={generateQuotation}
          disabled={loading}
        >
          {loading ? "Generating..." : "Generate Quotation"}
        </button>
      </div>

      {/* PREVIEW */}

      {pdfUrl && (
        <div className="preview-card">
          <div className="preview-header">
            <div>
              <h2>Quotation Preview</h2>

              <p>Your generated quotation</p>
            </div>
          </div>

          <iframe
            src={pdfUrl}
            title="Quotation Preview"
            className="pdf-preview"
          />

          <div className="download-buttons">
            <button
              type="button"
              className="download-btn"
              onClick={downloadPDF}
            >
              ↓ Download PDF
            </button>

            <button
              type="button"
              className="download-btn image-btn"
              onClick={downloadImage}
            >
              ↓ Download Image
            </button>
          </div>
        </div>
      )}

      {/* HISTORY */}

      {history.length > 0 && (
        <div className="history-card">
          <div className="history-header">
            <div>
              <h2>Quotation History</h2>

              <p>Your previously generated quotations</p>
            </div>

            <span className="history-count">
              {history.length}{" "}
              {history.length === 1 ? "Quotation" : "Quotations"}
            </span>
          </div>

          <div className="history-list">
            {history.map((quotation) => (
              <div className="history-item" key={quotation.id}>
                <div className="history-main">
                  <div className="history-icon">₹</div>

                  <div className="history-info">
                    <strong>{quotation.quotationFor || "Quotation"}</strong>

                    <span>{quotation.name || "Unknown Customer"}</span>
                  </div>
                </div>

                <div className="history-date">{quotation.date || "-"}</div>

                <div className="history-total">
                  ₹ {Number(quotation.grandTotal || 0).toFixed(2)}
                </div>

                <div className="history-actions">
                  <button
                    type="button"
                    className="history-view-btn"
                    onClick={() => loadHistory(quotation)}
                  >
                    View
                  </button>

                  <button
                    type="button"
                    className="history-delete-btn"
                    onClick={() => deleteHistory(quotation.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default Quotation;
