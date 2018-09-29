export default class BrowserBookmarkList implements SyncBookmarkList {
  target = $__("div");

  constructor() {
    this.setWatcher()
  }

  private import(): Promise<boolean> {

  }

  private setWatcher(): void {

  }

  async add(entry: Entry): Promise<boolean> {

  }
  async update(entry: Entry): Promise<boolean> {

  }
  async remove(url: string): Promise<boolean> {

  }
}
