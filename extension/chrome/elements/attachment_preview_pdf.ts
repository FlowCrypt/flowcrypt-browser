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
  renderControls(attachmentPreviewPdf, pdf.numPages);
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

const renderControls = (container: JQuery<HTMLElement>, numPages: number) => {
  const controls = $(`
    <div id="pdf-preview-controls">
      <div id="pdf-preview-page">
        Page
        <span id="pdf-preview-current-page-number">1</span>
        <span id="pdf-preview-page-slash">/</span>
        <span id="pdf-preview-total-pages-number">${numPages}</span>
      </div>
      <div id="pdf-preview-zoom">
        <button id="pdf-preview-zoom-out" disabled><img src="/img/svgs/minus-solid.svg" width="20"></button>
        <button id="pdf-preview-fit-to-width"><img src="/img/svgs/zoom-in.svg" width="20"></button>
        <button id="pdf-preview-reset-zoom"><img src="/img/svgs/zoom-out.svg" width="20"></button>
        <button id="pdf-preview-zoom-in"><img src="/img/svgs/plus-solid.svg" width="20"></button>
      </div>
    </div>
  `);
  container.append(controls); // xss-escaped
};