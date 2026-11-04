/**
 * Minimal pre-computed valid PDF fixture with exact byte xref offsets
 */
export function createMockPdfBuffer(candidateInfo = 'John Doe Software Engineer React Node.js Developer'): Buffer {
  const streamContent = `BT\n/F1 12 Tf\n72 712 Td\n(${candidateInfo}) Tj\nET`;
  const streamLen = Buffer.byteLength(streamContent);

  const header = '%PDF-1.4\n';
  const obj1 = '1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n';
  const obj2 = '2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n';
  const obj3 = '3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n';
  const obj4 = `4 0 obj\n<<\n/Length ${streamLen}\n>>\nstream\n${streamContent}\nendstream\nendobj\n`;

  const off1 = Buffer.byteLength(header);
  const off2 = off1 + Buffer.byteLength(obj1);
  const off3 = off2 + Buffer.byteLength(obj2);
  const off4 = off3 + Buffer.byteLength(obj3);
  const startxref = off4 + Buffer.byteLength(obj4);

  const xref = `xref\n0 5\n0000000000 65535 f \n${String(off1).padStart(10, '0')} 00000 n \n${String(off2).padStart(10, '0')} 00000 n \n${String(off3).padStart(10, '0')} 00000 n \n${String(off4).padStart(10, '0')} 00000 n \n`;
  const trailer = `trailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n${startxref}\n%%EOF\n`;

  const fullPdf = header + obj1 + obj2 + obj3 + obj4 + xref + trailer;
  return Buffer.from(fullPdf, 'binary');
}
