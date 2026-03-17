export type ReaderState = {
  desktop: boolean;
  reader_available: boolean;
  launcher_available: boolean;
  reader_path: string | null;
  launcher_path: string | null;
  model: string | null;
  total_space: string | null;
  free_space: string | null;
  used_space: string | null;
  total_bytes: number | null;
  free_bytes: number | null;
  used_bytes: number | null;
};

export type ReaderEntry = {
  name: string;
  relative_path: string;
  absolute_path: string;
  is_dir: boolean;
  size: number;
  extension: string | null;
  modified_at: number | null;
};

export type ReaderEntryDetails = ReaderEntry & {
  item_count: number | null;
};

export type DrawerView =
  | { kind: "closed" }
  | { kind: "device" }
  | { kind: "entry"; entry: ReaderEntry };

export type AppMode = "live" | "preview";
