const DB_NAME = 'kakei-ledger';
const LEGACY_STORE = 'observations';
const STORE = 'account-observations';
const ACCOUNT_STORE = 'accounts';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = event => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ACCOUNT_STORE)) db.createObjectStore(ACCOUNT_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: ['accountId', 'date'] });
      if (event.oldVersion === 1 && db.objectStoreNames.contains(LEGACY_STORE)) {
        const legacy = request.transaction.objectStore(LEGACY_STORE);
        const target = request.transaction.objectStore(STORE);
        legacy.openCursor().onsuccess = cursorEvent => {
          const cursor = cursorEvent.target.result;
          if (cursor) { target.put({ ...cursor.value, accountId: 'checking' }); cursor.continue(); }
        };
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Unable to open local storage'));
  });
}

export async function getAccounts() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => { const request=db.transaction(ACCOUNT_STORE).objectStore(ACCOUNT_STORE).getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('Unable to read accounts')); });
}

export async function saveAccounts(items) {
  const db = await openDatabase();
  return new Promise((resolve,reject)=>{const transaction=db.transaction(ACCOUNT_STORE,'readwrite');for(const item of items)transaction.objectStore(ACCOUNT_STORE).put(item);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(new Error('Unable to save accounts'));});
}

export async function getObservations() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Unable to read local storage'));
  });
}

export async function saveObservations(items) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    for (const item of items) transaction.objectStore(STORE).put(item);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('Unable to save locally'));
  });
}

export async function clearObservations(accountId = null) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    if (!accountId) store.clear();
    else {
      store.openCursor().onsuccess = event => {
        const cursor = event.target.result;
        if (cursor) { if (cursor.value.accountId === accountId) cursor.delete(); cursor.continue(); }
      };
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('Unable to clear local data'));
  });
}

export async function replaceAccountObservations(items, accountIds) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    store.openCursor().onsuccess = event => {
      const cursor = event.target.result;
      if (cursor) { if (accountIds.includes(cursor.value.accountId)) cursor.delete(); cursor.continue(); }
      else for (const item of items) store.put(item);
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('Unable to replace account data'));
  });
}
