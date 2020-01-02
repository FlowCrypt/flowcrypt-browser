export as namespace SquireClass;

declare global {
  interface Window {
    // @ts-ignore
    Squire: SquireClass;
  }
}

declare interface SquireClass {
  new(obj: HTMLElement): SquireEditor;
}

declare interface FontInfo {
  family: string;
  size: string;
  color: string;
  backgroundColor: string;
}

declare type SquireEvent = 'focus' | 'blur' | 'keydown' | 'keypress' | 'keyup' | 'input' | 'pathChange' | 'select' | 'cursor' | 'undoStateChange' | 'willPaste' | 'drop' | 'dragover';

export declare class SquireEditor {
  addEventListener(event: SquireEvent, callback: (e: any) => void): SquireEditor;
  removeEventListener(event: SquireEvent, callback: (e: any) => void): SquireEditor;
  setKeyHandler(key: string, handler: (self: SquireEditor, event: Event) => void): SquireEditor;
  focus(): SquireEditor;
  blur(): SquireEditor;
  getDocument(): Document;
  getHTML(): string;
  setHTML(html: string): SquireEditor;
  getSelectedText(): string;
  insertImage(image: ArrayBuffer | string, imageAttributes: any): HTMLElement;
  insertHTML(html: string): SquireEditor;
  getPath(): string;
  getFontInfo(): FontInfo;
  createRange(startContainer: HTMLElement, startOffset: number, endContainer?: HTMLElement, endOffset?: number): Range;
  getCursorPosition(): DOMRect;
  getSelection(): Range;
  setSelection(range: Range): SquireEditor;
  moveCursorToStart(): SquireEditor;
  moveCursorToEnd(): SquireEditor;
  saveUndoState(): SquireEditor;
  undo(): SquireEditor;
  redo(): SquireEditor;
  hasFormat(tag: string, attributes?: any): boolean;
  bold(): SquireEditor;
  italic(): SquireEditor;
  underline(): SquireEditor;
  removeBold(): SquireEditor;
  removeItalic(): SquireEditor;
  removeUnderline(): SquireEditor;
  makeLink(url: string, attributes: any): SquireEditor;
  removeLink(): SquireEditor;
  setFontFace(font: string): SquireEditor;
  setFontSize(size: string): SquireEditor;
  setTextColour(colour: string): SquireEditor;
  setHighlightColour(colour: string): SquireEditor;
  setTextAlignment(alignment: string): SquireEditor;
  setTextDirection(direction: string): SquireEditor;
  increaseQuoteLevel(): SquireEditor;
  decreaseQuoteLevel(): SquireEditor;
  makeUnorderedList(): SquireEditor;
  makeOrderedList(): SquireEditor;
  removeList(): SquireEditor;
  increaseListLevel(): SquireEditor;
  decreaseListLevel(): SquireEditor;
  code(): SquireEditor;
  removeCode(): SquireEditor;
  toggleCode(): SquireEditor;
  removeAllFormatting(): void;
  changeFormat(formattingToAdd: any, formattingToRemove: any, range: Range): void;
  setConfig(config: any): SquireEditor;
}

export declare class WillPasteEvent extends ClipboardEvent {
  fragment: DocumentFragment;
  text: string;
}
