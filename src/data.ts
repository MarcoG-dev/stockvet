import type { Product, PO, HistoryEntry, SupplierMeta, QueueItem } from './types';

export const initialProducts: Product[] = [
  {id:'p1',es:'Alimento Perro Adulto 20kg',en:'Adult Dog Food 20kg',sku:'ALI-DOG-AD-20',bc:'7501234500011',cat:'ALI',sup:'s1',cost:480,price:720,c:24,n:8,s:3,reorder:15},
  {id:'p2',es:'Alimento Gato Premium 3kg',en:'Premium Cat Food 3kg',sku:'ALI-CAT-PR-03',bc:'7501234500028',cat:'ALI',sup:'s1',cost:95,price:165,c:6,n:2,s:4,reorder:18},
  {id:'p3',es:'Vacuna Triple Felina',en:'Feline Triple Vaccine',sku:'BIO-FEL-TR-01',bc:'7501234500035',cat:'BIO',sup:'s2',cost:120,price:240,c:40,n:12,s:0,reorder:20},
  {id:'p4',es:'Desparasitante Bovino 500ml',en:'Cattle Dewormer 500ml',sku:'FAR-BOV-DW-500',bc:'7501234500042',cat:'FAR',sup:'s2',cost:210,price:360,c:0,n:0,s:0,reorder:12},
  {id:'p5',es:'Vitaminas Equinas 1L',en:'Equine Vitamins 1L',sku:'FAR-EQ-VT-1L',bc:'7501234500059',cat:'FAR',sup:'s2',cost:340,price:560,c:18,n:5,s:2,reorder:8},
  {id:'p6',es:'Antibiótico Inyectable 100ml',en:'Injectable Antibiotic 100ml',sku:'FAR-INJ-AB-100',bc:'7501234500066',cat:'FAR',sup:'s2',cost:180,price:310,c:9,n:3,s:1,reorder:14},
  {id:'p7',es:'Shampoo Antipulgas 500ml',en:'Flea Shampoo 500ml',sku:'HIG-FLE-SH-500',bc:'7501234500073',cat:'HIG',sup:'s3',cost:70,price:130,c:52,n:20,s:14,reorder:25},
  {id:'p8',es:'Alimento Aves Postura 40kg',en:'Layer Poultry Feed 40kg',sku:'ALI-AVE-PO-40',bc:'7501234500080',cat:'ALI',sup:'s1',cost:410,price:640,c:11,n:0,s:0,reorder:14},
  {id:'p9',es:'Suero Oral Veterinario 1L',en:'Veterinary Oral Serum 1L',sku:'FAR-SER-OR-1L',bc:'7501234500097',cat:'FAR',sup:'s2',cost:45,price:85,c:130,n:40,s:22,reorder:50},
  {id:'p10',es:'Jeringa 10ml Caja/100',en:'Syringe 10ml Box/100',sku:'INS-SYR-10-CJ',bc:'7501234500103',cat:'INS',sup:'s3',cost:60,price:110,c:75,n:30,s:18,reorder:30}
];

export const initialPOs: PO[] = [
  {id:'po1',num:'PO-1042',sup:'s1',status:'ordered',exp:'22 Jun 2026',lines:[{pid:'p1',qty:30,recd:0,cost:480},{pid:'p8',qty:20,recd:0,cost:410},{pid:'p2',qty:40,recd:0,cost:95}]},
  {id:'po2',num:'PO-1041',sup:'s2',status:'partial',exp:'18 Jun 2026',lines:[{pid:'p3',qty:50,recd:30,cost:120},{pid:'p6',qty:24,recd:24,cost:180},{pid:'p4',qty:18,recd:0,cost:210}]},
  {id:'po3',num:'PO-1040',sup:'s3',status:'received',exp:'10 Jun 2026',lines:[{pid:'p10',qty:50,recd:50,cost:60},{pid:'p7',qty:60,recd:60,cost:70}]},
  {id:'po4',num:'PO-1043',sup:'s1',status:'draft',exp:'28 Jun 2026',lines:[{pid:'p1',qty:50,recd:0,cost:480}]}
];

export const initialHistory: HistoryEntry[] = [
  {pid:'p4',date:'14 Jun · 09:12',type:'count',es:'Recuento de ciclo',en:'Cycle count',change:-3,loc:'central',user:'Ana L.'},
  {pid:'p3',date:'13 Jun · 16:40',type:'receive',es:'Recepción PO-1041',en:'Received PO-1041',change:30,loc:'central',user:'Sistema'},
  {pid:'p1',date:'12 Jun · 11:05',type:'adjust',es:'Daño en almacén',en:'Warehouse damage',change:-2,loc:'norte',user:'Luis C.'},
  {pid:'p6',date:'11 Jun · 10:20',type:'receive',es:'Recepción PO-1041',en:'Received PO-1041',change:24,loc:'central',user:'Sistema'},
  {pid:'p2',date:'10 Jun · 14:30',type:'sale',es:'Venta en POS',en:'POS sale',change:-5,loc:'pos',user:'POS'},
  {pid:'p7',date:'09 Jun · 09:00',type:'transfer',es:'Transferencia a Norte',en:'Transfer to Norte',change:-10,loc:'central',user:'Roberto M.'}
];

export const supMeta: Record<string, SupplierMeta> = {
  s1:{name:'Nutrición Animal del Bajío',contact:'Roberto Méndez',count:3,lead:5,onTime:96,last:'08 Jun 2026'},
  s2:{name:'Laboratorios VetMex',contact:'Dra. Ana López',count:5,lead:7,onTime:91,last:'13 Jun 2026'},
  s3:{name:'AgroInsumos Premium',contact:'Luis Carrillo',count:2,lead:4,onTime:98,last:'10 Jun 2026'}
};

export const catMeta: Record<string, {es:string;en:string;c:string}> = {
  ALI:{es:'Alimentos',en:'Food',c:'#2c6ecb'},
  FAR:{es:'Farmacia',en:'Pharmacy',c:'#1a9d6f'},
  BIO:{es:'Biológicos',en:'Biologics',c:'#8a55d6'},
  HIG:{es:'Higiene',en:'Hygiene',c:'#c8911b'},
  INS:{es:'Insumos',en:'Supplies',c:'#5c6ac4'}
};

export const bins: Record<string, string> = {
  p1:'A-04 · E2 · B1',p2:'A-02 · E1 · B3',p3:'C-01 · E3 · B2',p4:'B-03 · E1 · B1',
  p5:'B-03 · E2 · B4',p6:'C-02 · E1 · B1',p7:'D-01 · E2 · B2',p8:'A-05 · E1 · B1',
  p9:'C-03 · E2 · B3',p10:'D-02 · E3 · B1'
};

export const initialQueue: QueueItem[] = [
  {pid:'p7',copies:30,size:'2x1',printer:'zebra'},
  {pid:'p9',copies:50,size:'2.25x1.25',printer:'dymo'}
];
