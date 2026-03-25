declare const require: any;

export type WorkSheet = unknown;

export type WorkBook = {
  SheetNames: string[];
  Sheets: Record<string, WorkSheet>;
};

type XlsxModule = {
  read(data: ArrayBuffer | Uint8Array, opts?: Record<string, unknown>): WorkBook;
  utils: {
    sheet_to_json<T = any>(sheet: WorkSheet, opts?: Record<string, unknown>): T[];
  };
};

const Xlsx = require('xlsx') as XlsxModule;

export const read = Xlsx.read;
export const utils = Xlsx.utils;
