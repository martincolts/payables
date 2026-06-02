import type { ExtractedInvoice } from "@payables/shared";

export type ExtractionService = ReturnType<typeof createExtractionService>;

/**
 * Mocked invoice ingestion. A real implementation would send the uploaded file
 * to an OCR provider (AWS Textract / Google Document AI) and map its response
 * into `ExtractedInvoice` — the route and schema would not change. For the demo
 * this ignores the file's contents and returns a deterministic sample with one
 * deliberately low-confidence field so the review-queue UI is exercised.
 */
export function createExtractionService() {
  return {
    async extract(file: File): Promise<ExtractedInvoice> {
      // Touch the file so a zero-byte upload is still treated as missing data.
      if (file.size === 0) {
        throw new Error("Uploaded file is empty");
      }

      // TODO: replace with a real OCR call, e.g.
      //   const result = await textract.analyzeExpense({ Document: bytes });
      //   return mapTextractToExtractedInvoice(result);
      //
      // Uses a vendor name that exists in the demo seed ("Figma") so the
      // frontend can auto-select it; line items sum to `amount`.
      return {
        vendorName: { value: "Figma", confidence: 0.96 },
        invoiceNumber: { value: "INV-2026-0042", confidence: 0.93 },
        issueDate: { value: "2026-05-20", confidence: 0.91 },
        // Deliberately low — demonstrates the low-confidence review highlight.
        dueDate: { value: "2026-06-19", confidence: 0.55 },
        amount: { value: "270.00", confidence: 0.94 },
        lineItems: [
          { description: "Editor seats", amount: "243.00", confidence: 0.92 },
          { description: "Dev Mode add-on", amount: "27.00", confidence: 0.6 },
        ],
        mocked: true,
      };
    },
  };
}
