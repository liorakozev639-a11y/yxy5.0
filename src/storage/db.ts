import type { Memory } from '../domain/memory';
import type { ImportantDay } from '../domain/important-day';

export type MemoryRepository = {
  get(id: string): Promise<Memory | undefined>;
  getAll(): Promise<Memory[]>;
  put(memory: Memory): Promise<Memory>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
};

export type ImportantDayRepository = {
  getAll(): Promise<ImportantDay[]>;
  put(day: ImportantDay): Promise<ImportantDay>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
};

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function openDatabase(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('memories')) {
        request.result.createObjectStore('memories', { keyPath: 'id' });
      }
      if (!request.result.objectStoreNames.contains('importantDays')) {
        request.result.createObjectStore('importantDays', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB'));
  });
}

export function createImportantDayRepository(dbName = 'photo-memory-v0'): ImportantDayRepository {
  const database = openDatabase(dbName);
  return {
    async getAll() {
      const db = await database;
      return requestToPromise(db.transaction('importantDays', 'readonly').objectStore('importantDays').getAll());
    },
    async put(day) {
      const db = await database;
      const transaction = db.transaction('importantDays', 'readwrite');
      transaction.objectStore('importantDays').put(day);
      await transactionToPromise(transaction);
      return day;
    },
    async remove(id) {
      const db = await database;
      const transaction = db.transaction('importantDays', 'readwrite');
      transaction.objectStore('importantDays').delete(id);
      await transactionToPromise(transaction);
    },
    async clear() {
      const db = await database;
      const transaction = db.transaction('importantDays', 'readwrite');
      transaction.objectStore('importantDays').clear();
      await transactionToPromise(transaction);
    },
  };
}

export function createMemoryRepository(dbName = 'photo-memory-v0'): MemoryRepository {
  const database = openDatabase(dbName);

  return {
    async get(id) {
      const db = await database;
      return requestToPromise(db.transaction('memories', 'readonly').objectStore('memories').get(id));
    },
    async getAll() {
      const db = await database;
      return requestToPromise(db.transaction('memories', 'readonly').objectStore('memories').getAll());
    },
    async put(memory) {
      const db = await database;
      const transaction = db.transaction('memories', 'readwrite');
      transaction.objectStore('memories').put(memory);
      await transactionToPromise(transaction);
      return memory;
    },
    async remove(id) {
      const db = await database;
      const transaction = db.transaction('memories', 'readwrite');
      transaction.objectStore('memories').delete(id);
      await transactionToPromise(transaction);
    },
    async clear() {
      const db = await database;
      const transaction = db.transaction('memories', 'readwrite');
      transaction.objectStore('memories').clear();
      await transactionToPromise(transaction);
    },
  };
}
