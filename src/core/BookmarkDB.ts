const DB_VERSION = 1;

_openDB = (): Promise<void> => {
  return new Promise( (resolve, reject) => {
    const req = indexDB.open("Bookmark", DB_VERSION);
    req.onerror = reject;
    req.onupgradeneeded = ({ target: {result: db, transaction: tx} }) => {
      objStore = db.createObjectStore("Bookmark", {keyPath: "url"})
      objStore.createIndex("")
    }
  });
};

