export type Screen = 'dashboard' | 'inventory' | 'product' | 'po' | 'poDetail' | 'bc' | 'sku' | 'sup' | 'ai' | 'settings' | 'poCreate';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
}
export type Theme = 'light' | 'dark';
export type Lang = 'es' | 'en';

export interface Product {
  id: string;
  es: string;
  en: string;
  sku: string;
  bc: string;
  cat: string;
  sup: string;
  cost: number;
  price: number;
  c: number;
  n: number;
  s: number;
  reorder: number;
}

export interface POLine {
  pid: string;
  qty: number;
  recd: number;
  cost: number;
}

export interface PO {
  id: string;
  num: string;
  sup: string;
  status: 'draft' | 'ordered' | 'partial' | 'received';
  exp: string;
  lines: POLine[];
}

export interface HistoryEntry {
  pid: string;
  date: string;
  type: string;
  es: string;
  en: string;
  change: number;
  loc: string;
  user: string;
}

export interface SupplierMeta {
  name: string;
  contact: string;
  count: number;
  lead: number;
  onTime: number;
  last: string;
}

export interface QueueItem {
  pid: string;
  copies: number;
  size: string;
  printer: string;
}
