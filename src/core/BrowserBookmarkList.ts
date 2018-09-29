///<reference path="../global.d.ts" />
import {SyncBookmarkList, Entry, newerEntry, nodeToEntry, entryToNode} from "./BookmarkListInterface";
import {fix as fixUrl, buildQuery, GuessResult, guessType, parseHashQuery} from "./URL";

interface BookmarkTreeNode {
  id: string;
  parentId: string;
  index: number;
  url: string;
  title: string;
  dateAdded: number;
  dateGroupModified: number;
  children: BookmarkTreeNode[];
}

export default class BrowserBookmarkList implements SyncBookmarkList {
  private rootNodeId: string;
  readonly nodeIdStore = new Map<string, string>();
  readonly target = $__("div");

  constructor(rootNodeId: string) {
    this.setWatcher();
    this.setRootNode(rootNodeId);
  }

  private validateRootNode(): Promise<void> {
    if (this.rootNodeId === "") return;
    try {
      await browser.bookmarks.getChildren(this.rootNodeId);
    } catch (e) {
      this.target.emit(new Event("root_node_reconfigure_needed"));
    }
  }

  setRootNode (rootNodeId: string): Promise<boolean> {
    this.rootNodeId = rootNodeId;
    this.loadFromBrowser();
  }

  private getURLFromNodeId(nodeId: string): string|null {
    for (var [url, id] of this.nodeIdStore) {
      if (id === nodeId) {
        return url;
      }
    }
    return null;
  }

  private onAddFromBrowser(node: BookmarkTreeNode): void {
    if (!node.url || !node.title) return;

    const entry = nodeToEntry(node);

    const oldNode = this.getNode(entry.url);
    const oldEntry = oldNode ? nodeToEntry(oldNode) : null;

    // 同一URLのEntryが存在しない場合
    if (!oldNode || !oldEntry) {
      this.target.emit(new CustomEvent("add", {
        detail: entry
      }));
      this.nodeIdStore.set(entry.url, node.id);
      return;
    }

    // node側の方が新しいと判定された場合はupdate
    if (newerEntry(entry, oldEntry) === entry) {
      // 重複していた古い元のnodeを削除
      browser.bookmarks.remove(this.nodeIdStore.get(entry.url));

      // TODO:------------------------------------------------------------
      this.target.emit(new CustomEvent("update", {
        detail: entry
      }));
      this.nodeIdStore.set(entry.url, node.id);
      return;
    }

    // addによりcreateBrowserBookmarkが呼ばれた場合
    if (!this.nodeIdStore.has(entry.url))
      this.nodeIdStore.set(entry.url, node.id);
      return;
    }

    // 古い追加されたnodeを削除
    browser.bookmarks.remove(node.id);
  }

  private onUpdateFromBrowser(nodeId: string, changes: {url?: string, title?: string}): void {
    const node = this.getURLFromNodeId(nodeId);
    const entry = nodeToEntry(node);
    if (!entry) return;

    if (changes.url) {
      newEntry = nodeToEntry(changes)!;

      if (entry.url === newEntry.url) {
        const {url: oldURL, title: oldTitle} = entryToNode(entry);
        const {url: newURL, title: newTitle} = entryToNode(newEntry);

        if ((oldURL !== newURL) || (oldTitle !== newTitle)) {
          // TODO:------------------------------------------------------------
          this.target.emit(new CustomEvent("update", {
            detail: entry
          }));
        }
      } else {
        // ノードのURLが他の板/スレを示す物に変更された時
        this.nodeIdStore.delete(url);
        this.nodeIdStore.set(newEntry.url, nodeId);

        this.target.emit(new CustomEvent("remove", {
          detail: entry
        }));
        this.target.emit(new CustomEvent("add", {
          detail: newEntry
        }));
      }
    } else if (changes.title) {
      if (entry.title !== changes.title) {
        // TODO:------------------------------------------------------------
        entry.title = changes.title;
        this.target.emit(new CustomEvent("update", {
          detail: entry
        }));
      }
    }
  }

  private onRemoveFromBrowser(nodeId: string): void {
    const url = this.getURLFromNodeId(nodeId);
    if (url !== null) {
      this.nodeIdStore.delete(url);
      this.target.emit(new CustomEvent("remove", {
        detail: entry
      }));
    }
  }

  private setWatcher(): void {
    let watching = true;

    // Firefoxではbookmarks.onImportBegan/Endedは実装されていない
    if (browser.bookmarks.onImportBegan !== void 0) {
      browser.bookmarks.onImportBegan.addListener( () => {
        watching = false;
      });

      browser.bookmarks.onImportEnded.addListener( () => {
        watching = true;
        this.loadFromBrowser();
      });
    }

    browser.bookmarks.onCreated.addListener( (nodeId:string, node:BookmarkTreeNode) => {
      if (!watching) return;
      if (node.parentId === this.rootNodeId && node.url) {
        this.onAddFromBrowser(node);
      }
    });

    browser.bookmarks.onRemoved.addListener( (nodeId:string) => {
      if (!watching) return;
      this.onRemoveFromBrowser(nodeId);
    });

    browser.bookmarks.onChanged.addListener( (nodeId:string, changes) => {
      if (!watching) return;
      this.onUpdateFromBrowser(nodeId, changes);
    });

    browser.bookmarks.onMoved.addListener( async (nodeId:string, e) => {
      if (!watching) return;

      if (e.parentId === this.rootNodeId) {
        var res:BookmarkTreeNode[] = await browser.bookmarks.get(nodeId);
        if (res.length === 1 && res[0].url) {
          this.onAddFromBrowser(res[0]);
        }
      } else if (e.oldParentId === this.rootNodeId) {
        this.onRemoveFromBrowser(nodeId);
      }
    });
  }

  private loadFromBrowser(): Promise<boolean> {
    try {
      const res: BookmarkTreeNode[] = await browser.bookmarks.getChildren(this.rootNodeId);
      for(let node of res) {
        this.onAddFromBrowser(node);
      }

      this.emit("ready");
      return true;
    } catch (e) {
      app.log("warn", "ブラウザのブックマークからの読み込みに失敗しました。");
      this.validateRootNode();

      return false;
    }
  }

  private getNode(url: string): Promise<Entry|null> {
    const id = this.nodeIdStore.get(url);
    if (!id) return null;
    const res: BookmarkTreeNode[] = browser.bookmarks.get(id);
    if (res.length > 0) return res[0];
    return null;
  }

  async add(entry: Entry): Promise<boolean> {
    const {url, title} = entryToNode(entry);
    const res: BookmarkTreeNode = await browser.bookmarks.create({
      parentId: this.rootNodeId,
      url,
      title
    });
    if (!res) {
      app.log("error", "ブラウザのブックマークへの追加に失敗しました");
      this.validateRootNode();
    }

    return !!res;
  }

  async update(entry: Entry): Promise<boolean> {
    if (!this.nodeIdStore.has(newEntry.url)) return false;

    const node = await this.get(newEntry.url)!;
    const changes = {};
    const {url: newURL, title: newTitle} = entryToNode(newEntry);

    if (node.title !== newTitle) {
      changes.title = newTitle;
    }

    if (node.url !== newURL) {
      changes.url = newURL;
    }

    if (Object.keys(changes).length === 0) return true;

    res = await browser.bookmarks.update(id, changes);
    if (res) return true;

    app.log("error", "ブラウザのブックマーク更新に失敗しました");
    this.validateRootNode();
    return false;
  }

  async remove(url: string): Promise<boolean> {
    if (this.nodeIdStore.has(url)) {
      this.nodeIdStore.delete(url);
    }

    const res: BookmarkTreeNode[] = await browser.bookmarks.getChildren(this.rootNodeId);
    const removeIdList: string[] = [];

    if (!res) return false;

    for(let node of res) {
      if (!node.url || !node.title) continue;
      const entry = nodeToEntry(node)!;

      if (entry && entry.url === url) {
        removeIdList.push(node.id);
      }
    }

    if (removeIdList.length === 0) return false;

    await Promise.all(removeIdList.map( (id) => {
      return browser.bookmarks.remove(id).catch(e => {return});
    }));
    return true;
  }
}
