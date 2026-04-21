export type ColumnType = 
  | 'text' 
  | 'number' 
  | 'date' 
  | 'dropdown' 
  | 'multi_select' 
  | 'checkbox' 
  | 'image' 
  | 'file' 
  | 'formula' 
  | 'relation' 
  | 'multi_text' 
  | 'text_with_copy_button' 
  | 'system_serial';

export interface Column {
  key: string;
  name: string;
  type: ColumnType;
  locked?: boolean;
  movable?: boolean;
  copyPerItem?: boolean;
  multiInput?: boolean;
  magicPasteDisabled?: boolean;
  sortEnabled?: boolean;
  sortDirection?: "asc" | "desc";
  sortLocked?: boolean;
  sortPriority?: number;
  width?: number;
  resizeLocked?: boolean;
}

export interface PageConfig {
  rowReorderEnabled: boolean;
  hoverPreviewEnabled?: boolean;
  columns: Column[];
  secondarySearchPage?: string;
  searchBarOrder?: ('primary' | 'secondary')[];
  rowHeight?: number;
  independentSearchBars?: boolean;
}

export interface RowData {
  id: string;
  [key: string]: any;
}

export interface CopyBoxConfig {
  id: string;
  label: string;
  sourcePage: string;
  sourceColumn: string;
  lookupColumn: string;
  enabled: boolean;
  currentValue: string;
  currentLookupValue: string;
}

export interface GlobalCopyBoxConfig {
  sourcePage: string;
  sourceColumn: string;
  label?: string;
}

export interface GlobalCopyBoxesSettings {
  enabled: boolean;
  box1: GlobalCopyBoxConfig;
  box2: GlobalCopyBoxConfig;
  box3Label?: string;
  separator: string;
  order: ('box1' | 'box2' | 'box3')[];
}

export interface AppState {
  pages: string[];
  activePage: string;
  pageConfigs: Record<string, PageConfig>;
  pageRows: Record<string, RowData[]>;
  globalCopyBoxes?: GlobalCopyBoxesSettings;
  globalRowNoWidth?: number;
}
