import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Gemini client safely
// Note: User-Agent set to 'aistudio-build' as required by instructions
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Helper function to call generateContent with retry and exponential backoff for transient errors
async function generateContentWithRetry(params: any, maxRetries = 4, initialDelay = 1500) {
  let delay = initialDelay;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      const errorStr = String(error?.message || error);
      console.error(`Gemini API attempt ${attempt}/${maxRetries} failed:`, errorStr);
      
      const isTransient = 
        errorStr.includes("503") || 
        errorStr.includes("UNAVAILABLE") || 
        errorStr.includes("high demand") || 
        errorStr.includes("temporary") ||
        errorStr.includes("429") ||
        errorStr.includes("Too Many Requests") ||
        errorStr.includes("fetch failed") ||
        errorStr.includes("timeout") ||
        errorStr.includes("Timeout") ||
        errorStr.includes("ECONNRESET") ||
        errorStr.includes("ETIMEDOUT") ||
        (error?.status && [429, 484, 502, 503, 504].includes(error.status)) ||
        (error?.code && [429, 502, 503, 504, "UND_ERR_HEADERS_TIMEOUT"].includes(error.code)) ||
        (error?.cause && String(error.cause).includes("Timeout"));

      if (isTransient && attempt < maxRetries) {
        console.warn(`Transient overload or rate-limit. Retrying attempt ${attempt + 1}/${maxRetries} in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2.5; // Exponential backoff with multiplier
      } else {
        throw error;
      }
    }
  }
  throw new Error("Failed to generate content after maximum retries.");
}

// Configure standard middlewares with increased limits for handling large base64 invoice attachments
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Health Check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Invoice Data Extraction endpoint
app.post("/api/extract", async (req, res) => {
  try {
    const { fileBase64, mimeType, fileName } = req.body;

    if (!fileBase64 || !mimeType) {
      return res.status(400).json({ error: "Missing fileBase64 or mimeType parameter." });
    }

    // Strip out base64 prefix if present (e.g. "data:image/png;base64,")
    const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, "");

    const systemInstruction = `You are an expert Accounts Payable Assistant for a small hardware company.
Your task is to analyze the provided invoice document (image or PDF) and accurately extract the relevant information.

Strict extraction rules:
1. Do not guess or invent information. If a field is missing, state "Not stated".
2. Preserve the currency symbol and number formatting exactly as shown on the invoice (e.g., "$1,250.00", "€85.50", "150.00").
3. Perform a rigorous mathematical verification:
   - Sum the amount of all line items and check if they match the stated subtotal.
   - Verify if any stated tax (GST, VAT, Sales Tax) is calculated correctly.
   - Check if the formula [Subtotal - Discount + Shipping/Delivery + Tax = Total] is mathematically correct.
   - Note any differences or discrepancies clearly in the mathVerification and add relevant alerts under reviewAlerts.
4. Clearly highlight any missing information (e.g., missing PO, missing Payment Terms, missing Bank details), duplicate charges, calculation differences, or unusual charges in reviewAlerts.
5. Create a clear, concise, one-sentence plain-English summary of the invoice for a non-technical manager (e.g., "Supplier ABC issued this invoice of $1,250.00 for hardware components, with payment due on 12 August 2026.").
6. Only extract information visible in the document. Do not extrapolate.`;

    const contents = [
      {
        inlineData: {
          mimeType: mimeType,
          data: cleanBase64
        }
      },
      {
        text: `Analyze this invoice file (Name: ${fileName || 'invoice'}) and extract all general details, line items, and payment breakdown according to the required schema. Ensure you perform a full mathematical audit.`
      }
    ];

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            invoiceNumber: { type: Type.STRING, description: "The invoice number. Use 'Not stated' if not found." },
            supplierName: { type: Type.STRING, description: "The supplier's company or individual name. Use 'Not stated' if not found." },
            supplierAddress: { type: Type.STRING, description: "The physical or mailing address of the supplier. Use 'Not stated' if not found." },
            supplierContactDetails: { type: Type.STRING, description: "Email, phone, website or other contact info of the supplier. Use 'Not stated' if not found." },
            invoiceDate: { type: Type.STRING, description: "The invoice date. Use 'Not stated' if not found." },
            dueDate: { type: Type.STRING, description: "The payment due date. Use 'Not stated' if not found." },
            purchaseOrderNumber: { type: Type.STRING, description: "The purchase order (PO) number. Use 'Not stated' if not found." },
            currency: { type: Type.STRING, description: "The currency code or symbol (e.g. $, USD, AUD). Use 'Not stated' if not found." },
            paymentTerms: { type: Type.STRING, description: "Payment terms (e.g., Net 30, COD, Due on Receipt). Use 'Not stated' if not found." },
            lineItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  itemDescription: { type: Type.STRING, description: "Description of the product or service. Use 'Not stated' if not found." },
                  quantity: { type: Type.STRING, description: "Quantity of the item (preserve original text/unit). Use 'Not stated' if not found." },
                  unitPrice: { type: Type.STRING, description: "Unit price of the item (preserve currency formatting). Use 'Not stated' if not found." },
                  amount: { type: Type.STRING, description: "Total amount for this line item (preserve currency formatting). Use 'Not stated' if not found." }
                },
                required: ["itemDescription", "quantity", "unitPrice", "amount"]
              },
              description: "List of all line items in the invoice."
            },
            subtotal: { type: Type.STRING, description: "The subtotal of the invoice. Use 'Not stated' if not found." },
            discount: { type: Type.STRING, description: "Any discounts specified. Use 'Not stated' if not found." },
            shippingCharges: { type: Type.STRING, description: "Shipping, delivery, or freight charges. Use 'Not stated' if not found." },
            taxAmount: { type: Type.STRING, description: "Tax, VAT, GST, or other sales taxes. Use 'Not stated' if not found." },
            totalAmount: { type: Type.STRING, description: "The final total invoice amount. Use 'Not stated' if not found." },
            paymentDetails: { type: Type.STRING, description: "Bank details, account number, BSB, SWIFT, payment links, or remittance instructions. Use 'Not stated' if not found." },
            summary: { type: Type.STRING, description: "A single plain-English sentence summarizing the invoice: who issued it, what it is for, the total amount, and when it is due." },
            reviewAlerts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: "Must be exactly one of: 'missing', 'unclear', 'calculation', 'duplicate_unusual'" },
                  description: { type: Type.STRING, description: "Detailed description of the warning/alert." },
                  field: { type: Type.STRING, description: "The field this alert refers to." }
                },
                required: ["type", "description"]
              },
              description: "Highlighted alerts including missing info, unclear details, calculation differences, or duplicate/unusual charges."
            },
            mathVerification: {
              type: Type.OBJECT,
              properties: {
                isSubtotalCorrect: { type: Type.BOOLEAN, description: "True if the sum of all item amounts matches the stated subtotal." },
                isTaxCorrect: { type: Type.BOOLEAN, description: "True if the tax rate calculation is mathematically correct." },
                isTotalCorrect: { type: Type.BOOLEAN, description: "True if subtotal - discount + shipping + tax equals the final total amount." },
                explanation: { type: Type.STRING, description: "Detail the calculations performed and any discrepancies found." }
              },
              required: ["isSubtotalCorrect", "isTaxCorrect", "isTotalCorrect", "explanation"]
            }
          },
          required: [
            "invoiceNumber", "supplierName", "supplierAddress", "supplierContactDetails",
            "invoiceDate", "dueDate", "purchaseOrderNumber", "currency", "paymentTerms",
            "lineItems", "subtotal", "discount", "shippingCharges", "taxAmount", "totalAmount",
            "paymentDetails", "summary", "reviewAlerts", "mathVerification"
          ]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text received from Gemini API.");
    }

    const data = JSON.parse(text.trim());
    return res.json(data);

  } catch (error: any) {
    console.error("Extraction error:", error);
    
    let userFriendlyError = "Failed to extract invoice data. Please verify the file is a readable invoice PDF or image.";
    const errorStr = String(error?.message || error);
    
    if (errorStr.includes("503") || errorStr.includes("UNAVAILABLE") || errorStr.includes("high demand") || errorStr.includes("temporary")) {
      userFriendlyError = "The AI extraction service is currently experiencing very high demand. Please try again in a moment, as this transient overload usually resolves quickly.";
    } else if (errorStr.includes("429") || errorStr.includes("rate limit") || errorStr.includes("Too Many Requests")) {
      userFriendlyError = "The rate limit has been temporarily reached. Please wait a few seconds and click Retry.";
    } else if (errorStr.includes("API key") || errorStr.includes("API_KEY") || errorStr.includes("key not found")) {
      userFriendlyError = "The extraction service's Gemini API key is missing or invalid. Please configure your GEMINI_API_KEY inside Settings > Secrets.";
    }
    
    res.status(500).json({
      error: userFriendlyError,
      details: error.message
    });
  }
});

// Configure Vite or Static Asset Serving
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development Mode: Integrate Vite dev server
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode: Serve static files from the build directory
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
  });
}

setupServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
