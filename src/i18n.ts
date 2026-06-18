export interface Translations {
  ops: string; tools: string; searchPh: string;
  nav_dashboard: string; nav_inventory: string; nav_po: string; nav_bc: string; nav_sku: string; nav_sup: string;
  role: string; store: string; plan: string;
  export: string; addProduct: string; viewAll: string; back: string;
  dashTitle: string; dashDate: string; period: string;
  kVal: string; kSku: string; kLow: string; kOut: string; kInc: string;
  vsLast: string; needsAttention: string; chartVal: string; chartCat: string;
  alertsTitle: string; alertsSub: string; recentTitle: string; reorderPt: string;
  invTitle: string; searchInv: string; all: string;
  hProd: string; hSku: string; hCat: string; hCentral: string; hNorte: string; hPos: string; hTotal: string; hStatus: string; hValue: string;
  stIn: string; stLow: string; stOut: string;
  details: string; barcode: string; invByLoc: string; history: string;
  fCat: string; fSup: string; fCost: string; fPrice: string; fMargin: string; fReorder: string; fBin: string;
  adjustInv: string; printLabel: string; hDate: string; hMov: string; hChange: string; hLoc: string; hUser: string;
  adjTitle: string; mLoc: string; mType: string; mQty: string; mReason: string;
  tAdd: string; tRemove: string; tSet: string;
  rCount: string; rDamage: string; rTheft: string; rRecv: string; rCorr: string;
  applyAdj: string; cancel: string; currentStock: string; newStock: string; units: string;
  poTitle: string; newOrder: string; cOrder: string; cSup: string; cStatus: string; cItems: string; cTotal: string; cExp: string;
  sDraft: string; sOrdered: string; sPartial: string; sReceived: string;
  receiveItems: string; lOrdered: string; lRecd: string; lPending: string; lRecvNow: string;
  subtotal: string; tax: string; total: string; expected: string; notes: string; supplier: string;
  bcTitle: string; bcProduct: string; bcSym: string; printer: string; labelSize: string; copies: string; print: string; addQueue: string;
  labelPrev: string; queueTitle: string; qEmpty: string; printQ: string; remove: string;
  skuTitle: string; sCatg: string; sType: string; sSize: string; sSeq: string; skuHelp: string; preview: string; genBatch: string; batchTitle: string; apply: string;
  supTitle: string; supAdd: string; contact: string; sProducts: string; onTime: string; leadTime: string; days: string; lastOrder: string; newPO: string;
}

export const es: Translations = {
  ops:'Operaciones', tools:'Herramientas', searchPh:'Buscar productos, SKU, órdenes…',
  nav_dashboard:'Panel', nav_inventory:'Inventario', nav_po:'Órdenes de compra', nav_bc:'Códigos y etiquetas', nav_sku:'Generador de SKU', nav_sup:'Proveedores',
  role:'Administrador', store:'Veterinaria El Campo', plan:'Plan Pro · 3 ubicaciones',
  export:'Exportar', addProduct:'Agregar producto', viewAll:'Ver todo', back:'Volver',
  dashTitle:'Panel general', dashDate:'Lunes, 16 de junio de 2026', period:'Últimos 6 meses',
  kVal:'Valor de inventario', kSku:'SKU activos', kLow:'Bajo stock', kOut:'Agotados', kInc:'Órdenes entrantes',
  vsLast:'vs. mes anterior', needsAttention:'requieren atención', chartVal:'Valor de inventario', chartCat:'Stock por categoría',
  alertsTitle:'Alertas de stock', alertsSub:'Productos en o bajo el punto de reorden', recentTitle:'Actividad reciente', reorderPt:'Reorden',
  invTitle:'Inventario', searchInv:'Buscar por nombre o SKU…', all:'Todos',
  hProd:'Producto', hSku:'SKU', hCat:'Categoría', hCentral:'Central', hNorte:'Norte', hPos:'POS', hTotal:'Total', hStatus:'Estado', hValue:'Valor',
  stIn:'En stock', stLow:'Bajo', stOut:'Agotado',
  details:'Detalles del producto', barcode:'Código de barras', invByLoc:'Inventario por ubicación', history:'Historial de movimientos',
  fCat:'Categoría', fSup:'Proveedor', fCost:'Costo unitario', fPrice:'Precio venta', fMargin:'Margen', fReorder:'Punto de reorden', fBin:'Ubicación en bodega',
  adjustInv:'Ajustar inventario', printLabel:'Imprimir etiqueta', hDate:'Fecha', hMov:'Movimiento', hChange:'Cambio', hLoc:'Ubicación', hUser:'Usuario',
  adjTitle:'Ajustar inventario', mLoc:'Ubicación', mType:'Tipo de ajuste', mQty:'Cantidad', mReason:'Motivo',
  tAdd:'Agregar', tRemove:'Retirar', tSet:'Establecer',
  rCount:'Recuento de ciclo', rDamage:'Daño en almacén', rTheft:'Robo', rRecv:'Recepción manual', rCorr:'Corrección',
  applyAdj:'Aplicar ajuste', cancel:'Cancelar', currentStock:'Stock actual', newStock:'Nuevo stock', units:'u',
  poTitle:'Órdenes de compra', newOrder:'Nueva orden', cOrder:'Orden', cSup:'Proveedor', cStatus:'Estado', cItems:'Artículos', cTotal:'Total', cExp:'Esperado',
  sDraft:'Borrador', sOrdered:'Ordenada', sPartial:'Parcial', sReceived:'Recibida',
  receiveItems:'Recibir artículos', lOrdered:'Ordenado', lRecd:'Recibido', lPending:'Pendiente', lRecvNow:'Recibir',
  subtotal:'Subtotal', tax:'IVA (16%)', total:'Total', expected:'Entrega esperada', notes:'Notas de recepción', supplier:'Proveedor',
  bcTitle:'Códigos de barras y etiquetas', bcProduct:'Producto', bcSym:'Simbología', printer:'Impresora', labelSize:'Tamaño de etiqueta', copies:'Copias', print:'Imprimir', addQueue:'Agregar a la cola',
  labelPrev:'Vista previa de etiqueta', queueTitle:'Cola de impresión', qEmpty:'La cola está vacía', printQ:'Imprimir cola completa', remove:'Quitar',
  skuTitle:'Generador de SKU', sCatg:'Categoría', sType:'Tipo / Especie', sSize:'Tamaño / Variante', sSeq:'Secuencia inicial',
  skuHelp:'El SKU se construye con CATEGORÍA · TIPO · TAMAÑO · SECUENCIA. La secuencia se incrementa automáticamente en cada producto del lote.',
  preview:'Vista previa', genBatch:'Generar lote de 6', batchTitle:'Próximos SKU del lote', apply:'Asignar y crear',
  supTitle:'Proveedores', supAdd:'Agregar proveedor', contact:'Contacto', sProducts:'productos', onTime:'A tiempo', leadTime:'Entrega', days:'días', lastOrder:'Última orden', newPO:'Nueva orden'
};

export const en: Translations = {
  ops:'Operations', tools:'Tools', searchPh:'Search products, SKU, orders…',
  nav_dashboard:'Dashboard', nav_inventory:'Inventory', nav_po:'Purchase orders', nav_bc:'Barcodes & labels', nav_sku:'SKU generator', nav_sup:'Suppliers',
  role:'Administrator', store:'El Campo Veterinary', plan:'Pro plan · 3 locations',
  export:'Export', addProduct:'Add product', viewAll:'View all', back:'Back',
  dashTitle:'Dashboard', dashDate:'Monday, June 16, 2026', period:'Last 6 months',
  kVal:'Inventory value', kSku:'Active SKUs', kLow:'Low stock', kOut:'Out of stock', kInc:'Incoming orders',
  vsLast:'vs. last month', needsAttention:'need attention', chartVal:'Inventory value', chartCat:'Stock by category',
  alertsTitle:'Stock alerts', alertsSub:'Items at or below reorder point', recentTitle:'Recent activity', reorderPt:'Reorder',
  invTitle:'Inventory', searchInv:'Search by name or SKU…', all:'All',
  hProd:'Product', hSku:'SKU', hCat:'Category', hCentral:'Central', hNorte:'North', hPos:'POS', hTotal:'Total', hStatus:'Status', hValue:'Value',
  stIn:'In stock', stLow:'Low', stOut:'Out',
  details:'Product details', barcode:'Barcode', invByLoc:'Inventory by location', history:'Movement history',
  fCat:'Category', fSup:'Supplier', fCost:'Unit cost', fPrice:'Sale price', fMargin:'Margin', fReorder:'Reorder point', fBin:'Warehouse bin',
  adjustInv:'Adjust inventory', printLabel:'Print label', hDate:'Date', hMov:'Movement', hChange:'Change', hLoc:'Location', hUser:'User',
  adjTitle:'Adjust inventory', mLoc:'Location', mType:'Adjustment type', mQty:'Quantity', mReason:'Reason',
  tAdd:'Add', tRemove:'Remove', tSet:'Set',
  rCount:'Cycle count', rDamage:'Warehouse damage', rTheft:'Theft', rRecv:'Manual receipt', rCorr:'Correction',
  applyAdj:'Apply adjustment', cancel:'Cancel', currentStock:'Current stock', newStock:'New stock', units:'u',
  poTitle:'Purchase orders', newOrder:'New order', cOrder:'Order', cSup:'Supplier', cStatus:'Status', cItems:'Items', cTotal:'Total', cExp:'Expected',
  sDraft:'Draft', sOrdered:'Ordered', sPartial:'Partial', sReceived:'Received',
  receiveItems:'Receive items', lOrdered:'Ordered', lRecd:'Received', lPending:'Pending', lRecvNow:'Receive',
  subtotal:'Subtotal', tax:'Tax (16%)', total:'Total', expected:'Expected delivery', notes:'Receiving notes', supplier:'Supplier',
  bcTitle:'Barcodes & labels', bcProduct:'Product', bcSym:'Symbology', printer:'Printer', labelSize:'Label size', copies:'Copies', print:'Print', addQueue:'Add to queue',
  labelPrev:'Label preview', queueTitle:'Print queue', qEmpty:'The queue is empty', printQ:'Print entire queue', remove:'Remove',
  skuTitle:'SKU generator', sCatg:'Category', sType:'Type / Species', sSize:'Size / Variant', sSeq:'Start sequence',
  skuHelp:'The SKU is built from CATEGORY · TYPE · SIZE · SEQUENCE. The sequence auto-increments for each product in the batch.',
  preview:'Preview', genBatch:'Generate batch of 6', batchTitle:'Next batch SKUs', apply:'Assign & create',
  supTitle:'Suppliers', supAdd:'Add supplier', contact:'Contact', sProducts:'products', onTime:'On-time', leadTime:'Lead time', days:'days', lastOrder:'Last order', newPO:'New order'
};
