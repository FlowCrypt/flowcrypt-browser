/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { PDFDocumentProxy } from '../../types/pdf.js';

export const renderPdf = (attachmentPreviewContainer: JQuery<HTMLElement>, pdf: PDFDocumentProxy) => {
  const attachmentPreviewPdf = $('<div class="attachment-preview-pdf"></div>');
  attachmentPreviewContainer.empty().append(attachmentPreviewPdf); // xss-escaped
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const canvas = $('<canvas class="attachment-preview-pdf-page"></canvas>');
    attachmentPreviewPdf.append(canvas); // xss-escaped
    renderPdfPage(pdf, pageNumber, canvas.get(0) as HTMLCanvasElement);
  }
};

const renderPdfPage = (pdf: PDFDocumentProxy, pageNumber: number, canvas: HTMLCanvasElement) => {
  const scale = 1;
  pdf.getPage(pageNumber).then((page) => {
    const viewport = page.getViewport({ scale });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    page.render({ canvasContext: canvas.getContext('2d') as CanvasRenderingContext2D, viewport });
  });
};
