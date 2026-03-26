declare const require: any;

import type { ReactElement, ReactNode } from 'react';

export type SQLiteBindValue = string | number | Uint8Array | null;

export type SQLiteQueryResult<T> = {
  getFirstAsync(): Promise<T | null>;
  getAllAsync(): Promise<T[]>;
  resetAsync(): Promise<void>;
} & AsyncIterable<T>;

export type SQLiteRunResult = {
  lastInsertRowId: number;
  changes: number;
};

export type SQLiteStatement = {
  executeAsync<T = unknown>(
    params?: SQLiteBindValue[] | Record<string, SQLiteBindValue>,
  ): Promise<SQLiteRunResult & SQLiteQueryResult<T>>;
  finalizeAsync(): Promise<void>;
};

export type SQLiteExecutor = {
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    ...params: Array<
      SQLiteBindValue | SQLiteBindValue[] | Record<string, SQLiteBindValue>
    >
  ): Promise<SQLiteRunResult>;
  getAllAsync<T = unknown>(
    sql: string,
    ...params: Array<
      SQLiteBindValue | SQLiteBindValue[] | Record<string, SQLiteBindValue>
    >
  ): Promise<T[]>;
  getFirstAsync<T = unknown>(
    sql: string,
    ...params: Array<
      SQLiteBindValue | SQLiteBindValue[] | Record<string, SQLiteBindValue>
    >
  ): Promise<T | null>;
  prepareAsync(sql: string): Promise<SQLiteStatement>;
};

export type SQLiteDatabase = SQLiteExecutor & {
  withExclusiveTransactionAsync(task: (txn: SQLiteExecutor) => Promise<void>): Promise<void>;
};

export type SQLiteProviderProps = {
  databaseName: string;
  onInit?: (db: SQLiteDatabase) => Promise<void> | void;
  children?: ReactNode;
  useSuspense?: boolean;
};

type ExpoSQLiteModule = {
  SQLiteProvider(props: SQLiteProviderProps): ReactElement | null;
  useSQLiteContext(): SQLiteDatabase;
};

const ExpoSQLite = require('expo-sqlite') as ExpoSQLiteModule;

export const SQLiteProvider = ExpoSQLite.SQLiteProvider;
export const useSQLiteContext = ExpoSQLite.useSQLiteContext;
