import type { SortList } from './types';
// Deliberately new database: prior stack/tier records are not compatible with confidence state.
const DB = 'human-sorter-confidence-v1'; const STORE = 'lists';
const db = () => new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(DB, 1); request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
export async function loadLists(): Promise<SortList[]> { const d = await db(); return new Promise((resolve, reject) => { const r = d.transaction(STORE).objectStore(STORE).getAll(); r.onsuccess = () => resolve(r.result as SortList[]); r.onerror = () => reject(r.error); }); }
export async function saveList(list: SortList) { const d = await db(); return new Promise<void>((resolve, reject) => { const r = d.transaction(STORE, 'readwrite').objectStore(STORE).put(list); r.onsuccess = () => resolve(); r.onerror = () => reject(r.error); }); }
export async function removeList(id: string) { const d = await db(); return new Promise<void>((resolve, reject) => { const r = d.transaction(STORE, 'readwrite').objectStore(STORE).delete(id); r.onsuccess = () => resolve(); r.onerror = () => reject(r.error); }); }
