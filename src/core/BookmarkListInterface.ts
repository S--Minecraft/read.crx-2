
export interface SyncBookmarkList {
  private import(): void;
  private setWatcher(): void;
  async add(entry: Entry): Promise<boolean>;
  async update(entry: Entry): Promise<boolean>;
  async remove(url: string): Promise<boolean>;
}
