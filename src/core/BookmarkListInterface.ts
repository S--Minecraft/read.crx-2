import {threadToBoard, fix as fixUrl} from "./URL";

export interface ReadState {
  url: string;
  received: number;
  read: number;
  last: number;
  offset: number|null;
}

export interface Entry {
  url: string;
  title: string;
  type: string;
  bbsType: string;
  boardUrl: string;
  resCount: number|null;
  readState: ReadState|null;
  expired: boolean;
}

export interface SyncBookmarkList {
  private import(): void;
  private setWatcher(): void;
  async add(entry: Entry): Promise<boolean>;
  async update(entry: Entry): Promise<boolean>;
  async remove(url: string): Promise<boolean>;
}

export interface BookmarkUpdateEvent {
  type: "ADD"|"TITLE"|"RES_COUNT"|"READ_STATE"|"EXPIRED"|"REMOVE";
  entry: Entry;
}

export const entryToNode = (entry: Entry): string => {
  const url = fixUrl(entry.url);
  const param = {};

  if (entry.resCount !== null && Number.isFinite(entry.resCount)) {
    param.res_count = entry.resCount;
  }

  if (entry.readState) {
    param.last = entry.readState.last;
    param.read = entry.readState.read;
    param.received = entry.readState.received;
    if (entry.readState.offset) {
      param.offset = entry.readState.offset;
    }
  }

  if (entry.expired === true) {
    param.expired = true;
  }

  const hash = buildQuery(param);
  return {
    url: url + (hash ? "#" + hash : ""),
    title: entry.title
  }
}

export const nodeToEntry = ({url: string, title?: string}): Entry|null => {
  const fixedURL = fixUrl(url);
  const {type, bbsType}: GuessResult = guessType(fixedURL);

  if (type === "unknown") return null;

  const arg = parseHashQuery(url);
  const boardURL = threadToBoard(fixedURL);

  const entry = {
    type,
    bbsType,
    url: fixedURL,
    title: title ? title : fixedURL,
    boardUrl: boardURL,
    resCount: null,
    readState: null,
    expired: false
  };

  const reg = /^\d+$/;
  if (reg.test(arg.get("res_count"))) {
    entry.resCount = +arg.get("res_count");
  }

  if (
    reg.test(arg.get("received")) &&
    reg.test(arg.get("read")) &&
    reg.test(arg.get("last"))
  ) {
    entry.readState = {
      url: fixedURL,
      received: +arg.get("received"),
      read: +arg.get("read"),
      last: +arg.get("last"),
      offset: arg.get("offset") ? +arg.get("offset") : null
    };
  }

  if (arg.get("expired") === "true") {
    entry.expired = true;
  }

  return entry;
}

export function newerEntry(a:Entry, b:Entry): Entry|null {
  if (a.resCount !== null && b.resCount !== null && a.resCount !== b.resCount) {
    return a.resCount > b.resCount ? a : b;
  }

  if (Boolean(a.readState) !== Boolean(b.readState)) {
    return a.readState ? a : b;
  }

  if (a.readState && b.readState) {
    if (a.readState.read !== b.readState.read) {
      return a.readState.read > b.readState.read ? a : b;
    }

    if (a.readState.received !== b.readState.received) {
      return a.readState.received > b.readState.received ? a : b;
    }
  }

  return null;
}
