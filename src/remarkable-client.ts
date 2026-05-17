export interface UploadPdfInput {
  title: string;
  bytes: Uint8Array;
  destinationPath?: string | undefined;
}

export interface UploadPdfResult {
  id: string;
  name: string;
}

export interface RemarkableClient {
  pair(code: string): Promise<void>;
  checkConnection(): Promise<{ itemCount: number }>;
  uploadPdf(input: UploadPdfInput): Promise<UploadPdfResult>;
}
