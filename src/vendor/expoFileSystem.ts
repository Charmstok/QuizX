declare const require: any;

import type { DocumentPickerAsset } from './expoDocumentPicker';

export type ExpoFileInstance = {
  readonly name: string;
  readonly size: number;
  readonly uri: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

type FileConstructor = new (
  asset: DocumentPickerAsset | string,
  ...paths: string[]
) => ExpoFileInstance;

type ExpoFileSystemModule = {
  File: FileConstructor;
};

const ExpoFileSystem = require('expo-file-system') as ExpoFileSystemModule;

export const File = ExpoFileSystem.File;
