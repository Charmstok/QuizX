declare const require: any;

export type DocumentPickerAsset = {
  name: string;
  uri: string;
  mimeType?: string | null;
  size?: number;
  lastModified: number;
};

export type DocumentPickerOptions = {
  type?: string | string[];
  copyToCacheDirectory?: boolean;
  multiple?: boolean;
};

export type DocumentPickerSuccessResult = {
  canceled: false;
  assets: DocumentPickerAsset[];
};

export type DocumentPickerCanceledResult = {
  canceled: true;
  assets: null;
};

export type DocumentPickerResult =
  | DocumentPickerSuccessResult
  | DocumentPickerCanceledResult;

type ExpoDocumentPickerModule = {
  getDocumentAsync(options?: DocumentPickerOptions): Promise<DocumentPickerResult>;
};

const ExpoDocumentPicker = require('expo-document-picker') as ExpoDocumentPickerModule;

export const getDocumentAsync = ExpoDocumentPicker.getDocumentAsync;
