/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { PDFDocumentProxy } from '../../types/pdf.js';

export class AttachmentPreviewPdf {

  private attachmentPreviewContainer: JQuery<HTMLElement>;
  private pdf: PDFDocumentProxy;
  private currentZoomLevel: number;
  private zoomLevels: number[];
  private fitToWidthZoomLevelDetected: boolean;
  private fitToWidthZoomLevel: number;

  constructor(attachmentPreviewContainer: JQuery<HTMLElement>, pdf: PDFDocumentProxy) {
    this.attachmentPreviewContainer = attachmentPreviewContainer;
    this.pdf = pdf;
    this.currentZoomLevel = 1;
    this.zoomLevels = [1, 1.25, 1.5, 2, 3, 4, 5];
    this.fitToWidthZoomLevelDetected = false;
    this.fitToWidthZoomLevel = 1;
  }

  public render = async () => {
    this.attachmentPreviewContainer.find('*:not(.attachment-preview-pdf-page)').remove();
    this.attachmentPreviewContainer.addClass('attachment-preview-pdf');
    await this.renderPdf();
    this.renderControls();
  }

  private renderPdf = async (zoomLevelDiff?: number) => {
    console.log('render', this.currentZoomLevel);
    const container = this.attachmentPreviewContainer;
    for (let pageNumber = 1; pageNumber <= this.pdf.numPages; pageNumber++) {
      let pageCanvas;
      // use existed page, or create a new one for the first render
      if (container.find(`.attachment-preview-pdf-page[data-page-number="${pageNumber}"]`).length) {
        pageCanvas = container.find(`.attachment-preview-pdf-page[data-page-number="${pageNumber}"]`);
      } else {
        pageCanvas = $(`<canvas class="attachment-preview-pdf-page" data-page-number="${pageNumber}"></canvas>`);
        container.append(pageCanvas); // xss-escaped
      }
      await this.renderPage(this.pdf, pageNumber, pageCanvas.get(0) as HTMLCanvasElement);
      if (pageNumber === 1 && zoomLevelDiff) {
        // adjust horizontal scrollings to keep the document center
        container[0].scrollLeft += (container[0].scrollLeft + container[0].clientWidth / 2) * zoomLevelDiff;
      }
    }
  }

  private renderPage = async (pdf: PDFDocumentProxy, pageNumber: number, canvas: HTMLCanvasElement) => {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: this.currentZoomLevel });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: canvas.getContext('2d') as CanvasRenderingContext2D, viewport }).promise;
  }

  private renderControls = () => {
    const controls = $(`
      <div id="pdf-preview-controls">
        <div id="pdf-preview-page">
          Page
          <span id="pdf-preview-current-page-number">1</span>
          <span id="pdf-preview-page-slash">/</span>
          <span id="pdf-preview-total-pages-number">${this.pdf.numPages}</span>
        </div>
        <div id="pdf-preview-zoom">
          <button id="pdf-preview-zoom-out" title="Zoom out" disabled><img src="/img/svgs/minus-solid.svg" width="20"></button>
          <button id="pdf-preview-fit-to-width" title="Fit to width"><img src="/img/svgs/zoom-in.svg" width="20"></button>
          <button id="pdf-preview-reset-zoom" title="Reset zoom" style="display: none"><img src="/img/svgs/zoom-out.svg" width="20"></button>
          <button id="pdf-preview-zoom-in" title="Zoom in"><img src="/img/svgs/plus-solid.svg" width="20"></button>
        </div>
      </div>
    `);
    this.attachmentPreviewContainer.append(controls); // xss-escaped
    // Page X of Y
    this.attachmentPreviewContainer.on('scroll', () => {
      const pageHeight = this.attachmentPreviewContainer.find('canvas').outerHeight(true) as number;
      const scrollTop = this.attachmentPreviewContainer.scrollTop() as number;
      const currentPage = Math.round(scrollTop / pageHeight) + 1;
      this.attachmentPreviewContainer.find('#pdf-preview-current-page-number').text(currentPage);
    });
    // Zoom in, zoom out, fit to width, reset zoom
    this.handleZoom();
  }

  private handleZoom = () => {
    const container = this.attachmentPreviewContainer;
    // zoom in
    container.find('#pdf-preview-zoom-in').on('click', async () => {
      await this.reRenderWithNewZoomLevel(this.zoomLevels[this.zoomLevels.indexOf(this.currentZoomLevel) + 1]);
      container.find('#pdf-preview-reset-zoom').css('display', 'block');
      container.find('#pdf-preview-fit-to-width').css('display', 'none');
    });
    // zoom out
    container.find('#pdf-preview-zoom-out').on('click', async () => {
      await this.reRenderWithNewZoomLevel(this.zoomLevels[this.zoomLevels.indexOf(this.currentZoomLevel) - 1]);
      if (this.currentZoomLevel === 1) {
        container.find('#pdf-preview-reset-zoom').css('display', 'none');
        container.find('#pdf-preview-fit-to-width').css('display', 'block');
      } else {
        container.find('#pdf-preview-reset-zoom').css('display', 'block');
        container.find('#pdf-preview-fit-to-width').css('display', 'none');
      }
    });
    // reset zoom
    container.find('#pdf-preview-reset-zoom').on('click', async () => {
      await this.reRenderWithNewZoomLevel(1);
      container.find('#pdf-preview-reset-zoom').css('display', 'none');
      container.find('#pdf-preview-fit-to-width').css('display', 'block');
    });
    // fit to width
    container.find('#pdf-preview-fit-to-width').on('click', async () => {
      if (!this.fitToWidthZoomLevelDetected) {
        this.fitToWidthZoomLevel = (container.width() as number) / (container.find('.attachment-preview-pdf-page').width() as number);
        this.zoomLevels.push(this.fitToWidthZoomLevel);
        this.zoomLevels = this.zoomLevels.sort();
        this.fitToWidthZoomLevelDetected = true;
      }
      await this.reRenderWithNewZoomLevel(this.fitToWidthZoomLevel);
      container.find('#pdf-preview-reset-zoom').css('display', 'block');
      container.find('#pdf-preview-fit-to-width').css('display', 'none');
    });
  }

  private reRenderWithNewZoomLevel = async (newZoomLevel: number) => {
    const container = this.attachmentPreviewContainer;
    const zoomLevelDiff = (newZoomLevel - this.currentZoomLevel) / this.currentZoomLevel;
    this.currentZoomLevel = newZoomLevel;
    await this.renderPdf(zoomLevelDiff);
    container.find('#pdf-preview-zoom-in, #pdf-preview-zoom-out').prop('disabled', true);
    if (this.currentZoomLevel > 1) {
      container.find('#pdf-preview-zoom-out').prop('disabled', false);
    }
    if (this.currentZoomLevel < 5) {
      container.find('#pdf-preview-zoom-in').prop('disabled', false);
    }
  }

}