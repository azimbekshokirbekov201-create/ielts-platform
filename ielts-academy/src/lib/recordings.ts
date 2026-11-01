export type Recording = { id: string; date: string; part: string; blob: Blob };
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("ielts-academy-recordings", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("recordings", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function saveRecording(recording: Recording) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("recordings", "readwrite");
    tx.objectStore("recordings").put(recording);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function getRecordings() {
  const db = await database();
  return new Promise<Recording[]>((resolve, reject) => {
    const tx = db.transaction("recordings", "readonly");
    const req = tx.objectStore("recordings").getAll();
    req.onsuccess = () => {
      db.close();
      resolve(
        (req.result as Recording[]).sort((a, b) =>
          b.date.localeCompare(a.date),
        ),
      );
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}
