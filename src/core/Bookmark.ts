import * as BookmarkDB from "./BookmarkDB";
import BrowserBookmarkList from "./BrowserBookmarkList";
import {nodeToEntry} from "./BookmarkListInterface";
// @ts-ignore
import {get as getReadState} from "./ReadState.coffee"

export default class Bookmark {
  private browserList: BrowserBookmarkList;

  constructor(rootIdNode: string) {
    this.browserList = new BrowserBookmarkList(rootIdNode);
  }

  async add(url: string, title: string, resCount?: number): Promise<boolean> {
    const entry = nodeToEntry({url, title});

    const readState = getReadState(entry.url);
    if (readState) {
      entry.readState = readState;
    }

    if (
      typeof resCount === "number" &&
      (!entry.resCount || entry.resCount < resCount)
    ) {
      entry.resCount = resCount;
    } else if (entry.readState) {
      entry.resCount = entry.readState.received;
    }

    // TODO: -------------------------------------------------------------------
    const res = await Promise.all([
      BookmarkDB.add(entry),
      this.browserList.add(entry)
    ]);
    return res.every( (r) => r);
  }
}
