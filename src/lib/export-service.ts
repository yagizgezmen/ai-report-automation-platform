import { AlignmentType, Document, HeadingLevel, Packer, PageBreak, Paragraph, TextRun } from "docx";
import { Report } from "@/lib/types";

export async function exportDocx(report: Report) {
  const children: Paragraph[] = [
    new Paragraph({ spacing: { before: 2800 } }),
    new Paragraph({ text: report.reportType.toUpperCase(), alignment: AlignmentType.CENTER, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: report.projectName, alignment: AlignmentType.CENTER, spacing: { before: 240 } }),
    new Paragraph({ text: report.location, alignment: AlignmentType.CENTER, spacing: { before: 160 } }),
    new Paragraph({ text: `Prepared ${new Date().toLocaleDateString()}`, alignment: AlignmentType.CENTER, spacing: { before: 900 } }),
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ text: "TABLE OF CONTENTS", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: "Update this table of contents in Microsoft Word after opening the document.", spacing: { after: 300 } }),
    ...report.sections.map((section, index) => new Paragraph({ text: `${index + 1}. ${section.title}` })),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  report.sections.forEach((section, index) => {
    children.push(new Paragraph({ text: `${index + 1}. ${section.title}`, heading: HeadingLevel.HEADING_1, pageBreakBefore: index > 0 }));
    const paragraphs = section.content ? section.content.split(/\n\n+/) : ["This section has not yet been generated."];
    paragraphs.forEach((text) => children.push(new Paragraph({
      children: [new TextRun({ text, size: 22 })],
      spacing: { after: 220, line: 320 },
    })));
    if (section.missingWarnings.length) {
      children.push(new Paragraph({ text: "Review notes", heading: HeadingLevel.HEADING_2 }));
      section.missingWarnings.forEach((warning) => children.push(new Paragraph({ text: warning, bullet: { level: 0 } })));
    }
  });

  children.push(new Paragraph({ text: "Source Register", heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
  report.sources.forEach((source, index) => children.push(new Paragraph({
    children: [new TextRun({ text: `[S${index + 1}] ${source.title}: `, bold: true }), new TextRun(source.url)],
    spacing: { after: 140 },
  })));
  report.documents.forEach((document) => children.push(new Paragraph({ text: `[D] ${document.fileName}`, spacing: { after: 140 } })));

  const doc = new Document({
    creator: "Arqive AI",
    title: report.projectName,
    description: report.reportType,
    styles: {
      default: { document: { run: { font: "Arial", size: 22 }, paragraph: { spacing: { line: 300 } } } },
      paragraphStyles: [{
        id: "Title", name: "Title", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 38, bold: true, color: "172A4D" },
      }],
    },
    sections: [{ properties: {}, children }],
  });
  return Packer.toBuffer(doc);
}
