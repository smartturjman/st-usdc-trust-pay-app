// app/api/receipts/[tx]/route.ts
import { NextResponse } from "next/server";
import {
  PDFDocument,
  PDFFont,
  StandardFonts,
  rgb,
} from "pdf-lib";
import {
  normalizeTxHash,
  buildArcScanTxUrl,
  buildQrUrl,
} from "@/app/lib/explorer";
import { findLatestReceiptByTx } from "@/app/lib/receipts";
import { findService } from "@/app/config/services";

// ✅ Force Node.js runtime (PDF generation needs it) and disable caching
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { tx: string };

function fail500(err: unknown, where: string) {
  console.error(`[receipts:[tx]] ${where} error:`, err);
  return NextResponse.json({ error: "internal-error" }, { status: 500 });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { tx } = await params;
    const canonical = normalizeTxHash(tx);
    if (!canonical) {
      return NextResponse.json({ error: "invalid-tx" }, { status: 400 });
    }

    const wantPdf =
      (new URL(req.url).searchParams.get("format") || "").toLowerCase() === "pdf";

    const receipt = await findLatestReceiptByTx(canonical);
    if (!receipt) {
      return NextResponse.json({ error: "not-found" }, { status: 404 });
    }

    const service = receipt.serviceId ? findService(receipt.serviceId) : undefined;
    const partner =
      receipt.partner ??
      service?.partner ??
      "Turjman Group";

    const explorerUrl = buildArcScanTxUrl(canonical);
    const qrUrl = buildQrUrl(explorerUrl);
    const amountUSDC =
      typeof receipt.amountUSDC === "string" && receipt.amountUSDC.length > 0
        ? receipt.amountUSDC
        : "1.00";
    const network = receipt.network ?? "Arc Testnet";
    const pdfUrl = `/api/receipts/${canonical}?format=pdf`;
    const serviceLabel =
      receipt.serviceLabel ??
      (receipt as { serviceName?: string }).serviceName ??
      receipt.service ??
      receipt.serviceId ??
      "N/A";

    if (!wantPdf) {
      return NextResponse.json(
        {
          txHash: canonical,
          service: serviceLabel,
          partner,
          amount: `${amountUSDC} USDC`,
          network,
          status: receipt.status ?? "Verified",
          explorerUrl,
          qrUrl,
          pdfUrl,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    try {
      const pdf = await PDFDocument.create();
      const page = pdf.addPage([595, 842]); // A4 portrait
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

      const PAGE_WIDTH = page.getWidth();
      const LEFT_MARGIN = 20;
      const RIGHT_MARGIN = 45; // ensure plenty of space on the right for long values
      const CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN; // ~90% of the page width
      const LABEL_WIDTH = 160;
      const VALUE_X = LEFT_MARGIN + LABEL_WIDTH;
      const VALUE_WIDTH = CONTENT_WIDTH - LABEL_WIDTH;
      const FIELD_LINE_HEIGHT = 14;
      const FIELD_SPACING = 16;

      const wrapValue = (text: string, maxWidth: number, usedFont: PDFFont, fontSize: number) => {
        const normalized = text && text.length > 0 ? text : "N/A";
        const words = normalized.split(/\s+/).filter(Boolean);
        if (words.length === 0) {
          return ["N/A"];
        }

        const splitLongWord = (word: string) => {
          const segments: string[] = [];
          let current = "";
          for (const char of word) {
            const candidate = current + char;
            if (
              current.length > 0 &&
              usedFont.widthOfTextAtSize(candidate, fontSize) > maxWidth
            ) {
              segments.push(current);
              current = char;
            } else {
              current = candidate;
            }
          }
          if (current) {
            segments.push(current);
          }
          return segments;
        };

        const lines: string[] = [];
        let currentLine = "";

        for (const word of words) {
          const segments = splitLongWord(word);
          segments.forEach((segment, index) => {
            const needsSpace = currentLine.length > 0 && index === 0;
            const candidate = needsSpace ? `${currentLine} ${segment}` : `${currentLine}${segment}`;
            if (
              currentLine.length > 0 &&
              usedFont.widthOfTextAtSize(candidate, fontSize) > maxWidth
            ) {
              lines.push(currentLine);
              currentLine = segment;
            } else {
              currentLine = candidate;
            }
          });
        }

        if (currentLine) {
          lines.push(currentLine);
        }

        return lines;
      };

      const draw = (label: string, value: string, y: number) => {
        let cursor = y;
        page.drawText(`${label}:`, {
          x: LEFT_MARGIN,
          y: cursor,
          size: 11,
          font: fontBold,
          color: rgb(0, 0, 0),
        });

        const lines = wrapValue(value, VALUE_WIDTH, font, 11);
        lines.forEach((line, idx) => {
          page.drawText(line, {
            x: VALUE_X,
            y: cursor - idx * FIELD_LINE_HEIGHT,
            size: 11,
            font,
            color: rgb(0, 0, 0),
          });
        });

        const valueHeight = (lines.length - 1) * FIELD_LINE_HEIGHT;
        return cursor - valueHeight - FIELD_SPACING;
      };

      page.drawText("Smart Turjman — Verified Transaction Receipt", {
        x: LEFT_MARGIN,
        y: 780,
        size: 14,
        font: fontBold,
      });

      let cursorY = 740;
      cursorY = draw("Transaction Hash", canonical, cursorY);
      cursorY = draw("Service", serviceLabel, cursorY);
      cursorY = draw("Partner", partner, cursorY);
      cursorY = draw("Amount", `${amountUSDC} USDC`, cursorY);
      cursorY = draw("Network", network, cursorY);
      cursorY = draw("Status", receipt.status ?? "Verified", cursorY);
      cursorY -= 20;
      cursorY = draw("View on ArcScan", explorerUrl, cursorY);
      cursorY -= 22;

      try {
        const qrResp = await fetch(qrUrl, { cache: "no-store" });
        if (qrResp.ok) {
          const qrPng = await qrResp.arrayBuffer();
          const qrImg = await pdf.embedPng(qrPng);
          const size = 180;
          page.drawImage(qrImg, {
            x: 50,
            y: cursorY - size - 10,
            width: size,
            height: size,
          });
        } else {
          console.warn("[receipts:[tx]] QR fetch failed", qrResp.status);
        }
      } catch (qrErr) {
        console.warn("[receipts:[tx]] QR embed failed; continuing", qrErr);
      }

      const bytes = await pdf.save();
      return new NextResponse(bytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename=smart-turjman-receipt-${canonical}.pdf`,
          "Cache-Control": "no-store",
        },
      });
    } catch (pdfErr) {
      return fail500(pdfErr, "build-pdf");
    }
  } catch (err) {
    return fail500(err, "root");
  }
}
