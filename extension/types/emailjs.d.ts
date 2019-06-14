
export class MimeParser {
  constructor();
  onheader: (node: MimeParserNode) => void;
  onbody: (node: MimeParserNode) => void;
  onend: () => void;
  node: MimeParserNode; // root node
  write: (chunk: Uint8Array | string) => void;
  end: () => void;
}

export type MimeParserNode = {
  path: string[];
  headers: { [key: string]: { value: string; initial: string; params?: { charset?: string, filename?: string, name?: string } }[]; };
  rawContent: string | undefined; // only for content nodes (leaves)
  content: Uint8Array;
  appendChild: (child: MimeParserNode) => void;
  contentTransferEncoding: { value: string }; charset?: string;
  addHeader: (name: string, value: string) => void;
  raw: string; // on all nodes, not just body nodes
  _parentNode: MimeParserNode | null;
  _childNodes: MimeParserNode[] | false;
  _isMultipart: 'signed' | 'mixed' | false;
  _lineCount: number;
  _isRfc822: boolean;
  _multipartBoundary: string | false;
};
