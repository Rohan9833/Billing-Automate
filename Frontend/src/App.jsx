import { useState } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import "./app.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const createItem = () => ({
  particulars: "",
  hsn: "",
  qty: "",
  rate: "",
});

function Home() {
  const [form, setForm] = useState({
    name: "",
    invoiceNo: "",
    date: "",
    gstin: "",
    state: "",
    stateCode: "",
    cgst: "",
    sgst: "",
  });

  // First 5 rows are always there
  const [items, setItems] = useState(
    Array.from({ length: 5 }, () => createItem()),
  );

  const [pdfUrl, setPdfUrl] = useState("");
  const [loading, setLoading] = useState(false);

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
  const generateBill = async () => {
    try {
      setLoading(true);

      const response = await fetch("/invoice-template.pdf", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `Invoice template not found. Status: ${response.status}`,
        );
      }

      const templateBytes = new Uint8Array(await response.arrayBuffer());

      // Check actual PDF header
      const header = new TextDecoder().decode(templateBytes.slice(0, 5));

      if (header !== "%PDF-") {
        throw new Error("invoice-template.pdf valid PDF nahi hai");
      }

      const pdfDoc = await PDFDocument.load(templateBytes);

      const page = pdfDoc.getPages()[0];

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // =========================
      // CUSTOMER DETAILS
      // =========================

      // Name
      //   addText(page, font, form.name, 110, 580, 8);

      //   // Invoice No.
      //   addText(page, font, form.invoiceNo, 374, 580, 8);

      //   // Date
      //   addText(page, font, form.date, 464, 580, 8);

      //   // Party GSTIN
      //   addText(page, font, form.gstin, 170, 535, 8);

      //   // State
      //   addText(page, font, form.state, 371, 535, 8);

      //   // State Code
      //   addText(page, font, form.stateCode, 491, 535, 8);
      // Name / Invoice / Date
      addText(page, font, form.name, 114, 583, 12);
      addText(page, font, form.invoiceNo, 374, 582, 10);
      addText(page, font, form.date, 468, 582, 10);

      // Party GSTIN / State / State Code
      addText(page, font, form.gstin, 170, 535, 10);
      addText(page, font, form.state, 371, 535, 10);
      addText(page, font, form.stateCode, 491, 535, 11);

      // =========================
      // ITEMS
      // =========================

      const firstRowY = 488;
      const rowHeight = 20;

      items.forEach((item, index) => {
        const y = firstRowY - index * rowHeight;

        // Empty item skip
        if (!item.particulars && !item.hsn && !item.qty && !item.rate) {
          return;
        }

        const amount = getAmount(item);

        // Particulars
        addText(page, font, item.particulars, 108, y, 10);

        // HSN
        addText(page, font, item.hsn, 302, y, 10);

        // Quantity
        addText(page, font, item.qty, 360, y, 10);

        // Rate
        addText(page, font, item.rate, 402, y, 10);

        // Amount
        if (amount) {
          addText(page, font, amount.toFixed(2), 445, y, 10);
        }
      });

      // =========================
      // TOTALS
      // =========================

      const total = getTotal();
      const cgst = getCgstAmount();
      const sgst = getSgstAmount();
      const grandTotal = getGrandTotal();

      // Total
      addText(page, font, total.toFixed(2), 460, 243, 10);

      // CGST %
      addText(page, font, form.cgst ? `${form.cgst}` : "", 400, 216, 10);

      // CGST Amount
      addText(page, font, cgst.toFixed(2), 470, 219, 10);

      // SGST %
      addText(page, font, form.sgst ? `${form.sgst}` : "", 400, 192, 10);

      // SGST Amount
      addText(page, font, sgst.toFixed(2), 470, 195, 10);

      // Grand Total
      addText(page, font, grandTotal.toFixed(2), 448, 168, 10);

      // =========================
      // AMOUNT IN WORDS
      // =========================

      const amountInWords = numberToWords(grandTotal);
      const words = amountInWords.split(" ");

      const lineX = [130, 90, 170];
      const lineY = [224, 198, 198];
      const lineLimit = [29, 30, 20];

      let currentLine = "";
      let lineIndex = 0;

      words.forEach((word) => {
        if (lineIndex >= lineLimit.length) return;

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
            10,
          );

          lineIndex++;
          currentLine = word;
        }
      });

      if (currentLine && lineIndex < lineLimit.length) {
        addText(
          page,
          font,
          currentLine,
          lineX[lineIndex],
          lineY[lineIndex],
          10,
        );
      }

      // addText(page, font, numberToWords(grandTotal), 130, 224, 10);

      // =========================
      // SAVE PDF
      // =========================

      const finalPdf = await pdfDoc.save();

      const blob = new Blob([finalPdf], {
        type: "application/pdf",
      });

      const url = URL.createObjectURL(blob);

      // Old preview URL cleanup
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }

      setPdfUrl(url);
    } catch (error) {
      console.error("Generate Bill Error:", error);

      alert(
        error.message || "Bill generate nahi ho paya. Template PDF check karo.",
      );
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!pdfUrl) return;

    const link = document.createElement("a");

    link.href = pdfUrl;
    link.download = `${form.invoiceNo || "invoice"}.pdf`;

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
      link.download = `${form.invoiceNo || "invoice"}.png`;

      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error(error);

      alert("Image generate nahi ho payi.");
    }
  };

  return (
    <div className="home">
      <div className="container">
        <div className="page-title">
          <h1>Tax Invoice</h1>
          <p>Create your invoice</p>
        </div>

        <div className="form-card">
          {/* CUSTOMER DETAILS */}

          <div className="section-title">Customer Details</div>

          <div className="form-grid">
            <div className="field">
              <label>Customer Name</label>

              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Enter customer name"
              />
            </div>

            <div className="field">
              <label>Invoice No.</label>

              <input
                name="invoiceNo"
                value={form.invoiceNo}
                onChange={handleChange}
                placeholder="Invoice number"
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
              <label>Party's GSTIN</label>

              <input
                name="gstin"
                value={form.gstin}
                onChange={handleChange}
                placeholder="GSTIN"
              />
            </div>

            <div className="field">
              <label>State</label>

              <input
                name="state"
                value={form.state}
                onChange={handleChange}
                placeholder="State"
              />
            </div>

            <div className="field">
              <label>State Code</label>

              <input
                name="stateCode"
                value={form.stateCode}
                onChange={handleChange}
                placeholder="State code"
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
            onClick={generateBill}
            disabled={loading}
          >
            {loading ? "Generating..." : "Generate Bill"}
          </button>
        </div>

        {/* PREVIEW */}

        {pdfUrl && (
          <div className="preview-card">
            <div className="preview-header">
              <div>
                <h2>Invoice Preview</h2>

                <p>Your generated bill</p>
              </div>
            </div>

            <iframe
              src={pdfUrl}
              title="Invoice Preview"
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
      </div>
    </div>
  );
}
export default Home;
