///<reference path="../global.d.ts" />
import {threadToBoard, fix as fixUrl} from "./URL"

export class SyncableEntryList extends EntryList{
  onChanged = new app.Callbacks({persistent: true});
  private observerForSync:Function;

  constructor () {
    super();

    this.observerForSync = (e:BookmarkUpdateEvent) => {
      this.manipulateByBookmarkUpdateEvent(e);
    };
  }

  async add (entry:Entry):Promise<boolean> {
    if (!super.add(entry)) return false;

    this.onChanged.call({
      type: "ADD",
      entry: app.deepCopy(entry)
    });
    return true;
  }

  async update (entry:Entry):Promise<boolean> {
    var before = this.get(entry.url);

    if (!super.update(entry)) return false;

    if (before.title !== entry.title) {
      this.onChanged.call({
        type: "TITLE",
        entry: app.deepCopy(entry)
      });
    }

    if (before.resCount !== entry.resCount) {
      this.onChanged.call({
        type: "RES_COUNT",
        entry: app.deepCopy(entry)
      });
    }

    if (
      (!before.readState && entry.readState) ||
      (
        (before.readState && entry.readState) && (
          before.readState.received !== entry.readState.received ||
          before.readState.read !== entry.readState.read ||
          before.readState.last !== entry.readState.last ||
          before.readState.offset !== entry.readState.offset
        )
      )
    ) {
      this.onChanged.call({
        type: "READ_STATE",
        entry: app.deepCopy(entry)
      });
    }

    if (before.expired !== entry.expired) {
      this.onChanged.call({
        type: "EXPIRED",
        entry: app.deepCopy(entry)
      });
    }
    return true;
  }

  async remove (url:string):Promise<boolean> {
    var entry:Entry = this.get(url);

    if (!super.remove(url)) return false;

    this.onChanged.call({
      type: "REMOVE",
      entry: entry
    });
    return true;
  }

  private manipulateByBookmarkUpdateEvent (e:BookmarkUpdateEvent) {
    switch (e.type) {
      case "ADD":
        this.add(e.entry);
        break;
      case "TITLE":
      case "RES_COUNT":
      case "READ_STATE":
      case "EXPIRED":
        this.update(e.entry);
        break;
      case "REMOVE":
        this.remove(e.entry.url);
        break;
    }
  }

  private followDeletion (b:EntryList):void {
    var aList:string[], bList:string[], rmList:string[];

    aList = this.getAll().map( ({url}) => url);
    bList = b.getAll().map( ({url}) => url);

    rmList = aList.filter( url => !bList.includes(url));

    for(var url of rmList) {
      this.remove(url);
    }
  }

  syncStart (b:SyncableEntryList):void {
    b.import(this);

    this.syncResume(b);
  }

  syncResume (b:SyncableEntryList):void {
    this.import(b);
    this.followDeletion(b);

    this.onChanged.add(b.observerForSync);
    b.onChanged.add(this.observerForSync);
  }

  syncStop (b:SyncableEntryList):void {
    this.onChanged.remove(b.observerForSync);
    b.onChanged.remove(this.observerForSync);
  }
}
