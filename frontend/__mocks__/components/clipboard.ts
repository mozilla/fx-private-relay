export type ClipboardWrite = (text: string) => Promise<void>;

export interface ClipboardShim {
  writeText: ClipboardWrite;
}

export type NavigatorClipboard = Navigator & { clipboard?: ClipboardShim };
