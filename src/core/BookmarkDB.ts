import {Entry} from "./BookmarkListInterface"
// @ts-ignore
import {indexedDBRequestToPromise} from "./util.coffee"

const DB_VERSION = 1;

const target = $__("div");

const _openDB = (): Promise<IDBDatabase> => {
  return new Promise( (resolve, reject) => {
    const req = indexDB.open("Bookmark", DB_VERSION);
    req.onerror = reject;
    req.onupgradeneeded = ({ target: {result: db, transaction: tx} }) => {
      objStore = db.createObjectStore("Bookmark", {keyPath: "url"})
      objStore.createIndex("title", "title", {unique: false});
      objStore.createIndex("board_url", "board_url", {unique: false});
      objStore.createIndex("type", "type", {unique: false});
      tx.oncomplete = () => {
        resolve(db);
      };
    };
    req.onsuccess = ({ target: {result: db} }) => {
      resolve(db);
    };
  });
};

export const add = async (entry: Entry): Promise<boolean> => {
  try {
    const db = await _openDB();
    const req = db
      .transaction("Bookmark", "readwrite")
      .objectStore("Bookmark")
      .add(entry);
    await indexedDBRequestToPromise(req);
    target.emit(new CustomEvent("ADD",
      detail: entry
    ));
    return true;
  } catch (e) {
    // TODO: すでにそのURLが存在のときエラー
    app.log("error", "BookmarkDB.add: データの格納に失敗しました");
    return false;
  }
};

export const update = async (entry: Entry): Promise<boolean> => {
  try {
    const db = await _openDB();
    const req = db
      .transaction("Bookmark", "readwrite")
      .objectStore("Bookmark")
      .put(entry);
    await indexedDBRequestToPromise(req);
    target.emit(new CustomEvent("UPDATE",
      detail: entry
    ));
    return true;
  } catch (e) {
    app.log("error", "BookmarkDB.update: データの更新に失敗しました");
    return false;
  }
};

export const remove = async (url: string): Promise<boolean> => {
  try {
    const entry = await get(url);
    const db = await _openDB();
    let req = db
      .transaction("Bookmark", "readwrite")
      .delete(url);
    await indexedDBRequestToPromise(req);
    target.emit(new CustomEvent("REMOVE",
      detail: entry
    ));
    return true;
  } catch (e) {
    app.log("error", "BookmarkDB.remove: データの削除に失敗しました");
    return false;
  }
};

export const importAll = async (list: Entry[]): Promise<boolean> => {
  const res = await Promise.all(list.map( (entry) => update(entry)))
  return res.every( (r) => r);
};

export const applyServerMove = (from: string, to: string): Promise<void> => {
  return new Promise( (resolve, reject) => {
    const db = await _openDB();
    const req = db
      .transaction("Bookmark", "read")
      .objectStore("Bookmark")
      .index("board_url")
      .openCursor(IDBKeyRange.only(from));
    req.onsuccess = ({ target: {result: cursor} }) => {
      if (cursor) {
        const val = cursor.value;
        val.board_url = to;
        if (val.type === "board") {
          val.url = to;
        }
        cursor.update(val);
        cursor.continue();
      } else {
        resolve();
      }
    };
    req.onerror = (e) => {
      app.log("error", "BookmarkDB.applyServerMove: データの更新に失敗しました");
      reject(e);
    };
  });
};

export const get = async (url: string): Promise<Entry> => {
  try {
    const db = await _openDB();
    const req = db
      .transaction("Bookmark", "read")
      .objectStore("Bookmark")
      .get(url);
    await indexedDBRequestToPromise(req);
  } catch (e) {
    app.log("error", "BookmarkDB.get: データの取得に失敗しました")
    throw new Error(e)
  }
};

export const getAll = async (): Promise<Entry[]> => {
  try {
    const db = await _openDB();
    const req = db
      .transaction("Bookmark", "read")
      .objectStore("Bookmark")
      .getAll();
    await indexedDBRequestToPromise(req);
  } catch (e) {
    app.log("error", "BookmarkDB.getAll: データの取得に失敗しました")
    throw new Error(e)
  }
}

export const getAllThreads = async (): Promise<Entry[]> => {
  try {
    const db = await _openDB();
    const req = db
      .transaction("Bookmark", "read")
      .objectStore("Bookmark")
      .index("type")
      .getAll(IDBKeyRange.only("thread"));
    await indexedDBRequestToPromise(req);
  } catch (e) {
    app.log("error", "BookmarkDB.getAllThreads: データの取得に失敗しました")
    throw new Error(e)
  }
}

export const getAllBoards = async (): Promise<Entry[]> => {
  try {
    const db = await _openDB();
    const req = db
      .transaction("Bookmark", "read")
      .objectStore("Bookmark")
      .index("type")
      .getAll(IDBKeyRange.only("board"));
    await indexedDBRequestToPromise(req);
  } catch (e) {
    app.log("error", "BookmarkDB.getAllBoards: データの取得に失敗しました")
    throw new Error(e)
  }
}

export const getThreadsByBoardUrl = async (url: string): Promise<Entry[]> => {
  try {
    const db = await _openDB();
    const req = db
      .transaction("Bookmark", "read")
      .objectStore("Bookmark")
      .index("board_url")
      .getAll(IDBKeyRange.only(url));
    await indexedDBRequestToPromise(req);
  } catch (e) {
    app.log("error", "BookmarkDB.getThreadsByBoardUrl: データの取得に失敗しました")
    throw new Error(e)
  }
}
