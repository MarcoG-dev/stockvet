import React, { useState, useRef, useCallback, useEffect } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import { money, num, generateBarcode, ValueChart } from './utils';
import { es as esT, en as enT } from './i18n';
import { initialProducts, initialPOs, initialHistory, supMeta, catMeta, bins, initialQueue } from './data';
import type { Product, PO, HistoryEntry, QueueItem, Screen, Theme, Lang, AIMessage } from './types';

const SS: React.CSSProperties = { fontFamily: "-apple-system,BlinkMacSystemFont,'San Francisco','Segoe UI',Helvetica,sans-serif" };

export default function App() {
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [theme, setTheme] = useState<Theme>('light');
  const [lang, setLang] = useState<Lang>('es');
  const [search, setSearch] = useState('');
  const [selProd, setSelProd] = useState('p1');
  const [selPO, setSelPO] = useState('po2');
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjLoc, setAdjLoc] = useState('central');
  const [adjType, setAdjType] = useState('add');
  const [adjQty, setAdjQty] = useState('');
  const [adjReason, setAdjReason] = useState('rCount');
  const [skuCat, setSkuCat] = useState('ALI');
  const [skuType, setSkuType] = useState('DOG');
  const [skuSize, setSkuSize] = useState('20');
  const [skuSeq, setSkuSeq] = useState('001');
  const [bcProd, setBcProd] = useState('p1');
  const [bcSym, setBcSym] = useState('code128');
  const [printer, setPrinter] = useState('zebra');
  const [labelSize, setLabelSize] = useState('2x1');
  const [copies, setCopies] = useState('12');
  const [recv, setRecv] = useState<Record<string, string>>({});
  const [queue, setQueue] = useState<QueueItem[]>(initialQueue);
  const [toast, setToast] = useState('');
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [pos, setPos] = useState<PO[]>(initialPOs);
  const [history, setHistory] = useState<HistoryEntry[]>(initialHistory);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // PO Create state
  const [newPOSup, setNewPOSup] = useState('s1');
  const [newPOLines, setNewPOLines] = useState<Array<{pid:string;qty:number;cost:number}>>([]);
  const [newPOExp, setNewPOExp] = useState('');
  const [poSearch, setPoSearch] = useState('');
  const [poColsOpen, setPoColsOpen] = useState(false);
  const [poCols, setPoCols] = useState({sku:true,bc:false,cat:false,margin:false});
  // Add product state
  const [addProdOpen, setAddProdOpen] = useState(false);
  const [npEs, setNpEs] = useState('');
  const [npEn, setNpEn] = useState('');
  const [npCat, setNpCat] = useState('ALI');
  const [npSup, setNpSup] = useState('s1');
  const [npCost, setNpCost] = useState('');
  const [npPrice, setNpPrice] = useState('');
  const [npReorder, setNpReorder] = useState('10');
  // AI Assistant state
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('sv_apikey') || '');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const aiScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (apiKey) setApiKeyInput(apiKey); }, []);

  useEffect(() => {
    if (aiScrollRef.current) aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
  }, [aiMessages]);

  const saveApiKey = () => {
    const k = apiKeyInput.trim();
    if (!k) return;
    localStorage.setItem('sv_apikey', k);
    setApiKey(k);
    notify(T.skApiKeyOk);
  };

  const clearApiKey = () => {
    localStorage.removeItem('sv_apikey');
    setApiKey('');
    setApiKeyInput('');
  };

  const buildSystemPrompt = () => {
    const prods = products.map(p => {
      const total = p.c + p.n + p.s;
      const status = total <= 0 ? 'AGOTADO' : total <= p.reorder ? 'BAJO STOCK' : 'OK';
      return `  - ${p.es} | SKU: ${p.sku} | Central: ${p.c}, Norte: ${p.n}, POS: ${p.s} (Total: ${total}) | Reorden: ${p.reorder} | Costo: $${p.cost} | Precio: $${p.price} | Estado: ${status}`;
    }).join('\n');
    const poSummary = pos.map(po => `  - ${po.num} (${po.sup}): ${po.status}, ${po.lines.length} artículos`).join('\n');
    return `Eres el asistente de inventario de StockVet, una app de gestión de inventario veterinario para "${ES ? 'Veterinaria El Campo' : 'El Campo Veterinary'}" con 3 ubicaciones: Bodega Central, Sucursal Norte y Punto de Venta.

INVENTARIO ACTUAL (${products.length} productos):
${prods}

RESUMEN: ${nOut} agotados, ${nLow} con stock bajo, valor total ${money(invValue)}

ÓRDENES DE COMPRA:
${poSummary}

Responde en el idioma del usuario. Sé conciso, útil y específico. Usa los datos reales del inventario para tus respuestas. Puedes sugerir qué productos ordenar, analizar tendencias, calcular costos, y dar recomendaciones prácticas.`;
  };

  const sendAI = async (text?: string) => {
    const msg = (text || aiInput).trim();
    if (!msg || aiLoading || !apiKey) return;
    setAiInput('');
    const userMsg: AIMessage = { role: 'user', content: msg };
    const placeholderMsg: AIMessage = { role: 'assistant', content: '', loading: true };
    setAiMessages(prev => [...prev, userMsg, placeholderMsg]);
    setAiLoading(true);
    try {
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      const history2 = aiMessages.filter(m => !m.loading).map(m => ({ role: m.role, content: m.content }));
      let full = '';
      const stream = client.messages.stream({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        system: buildSystemPrompt(),
        messages: [...history2, { role: 'user', content: msg }],
        thinking: { type: 'adaptive' },
      });
      stream.on('text', (chunk) => {
        full += chunk;
        setAiMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: full, loading: false } : m));
      });
      await stream.finalMessage();
      if (!full) setAiMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: '(sin respuesta)', loading: false } : m));
    } catch (err: unknown) {
      const msg2 = err instanceof Error ? err.message : 'Error desconocido';
      setAiMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: `Error: ${msg2}`, loading: false } : m));
    } finally {
      setAiLoading(false);
    }
  };

  const ES = lang === 'es';
  const T = ES ? esT : enT;

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  const exportCSV = () => {
    const headers = [ES?'SKU':'SKU', ES?'Producto':'Product', ES?'Categoría':'Category', ES?'Central':'Central', ES?'Norte':'North', 'POS', ES?'Total':'Total', ES?'Costo':'Cost', ES?'Precio':'Price', ES?'Valor':'Value', ES?'Estado':'Status'];
    const rows = allProds.map(p => [p.sku, p.name, p.catName, p.c, p.n, p.s, p.total, p.cost, p.price, Math.round(p.value), p.statusText]);
    const csv = '﻿' + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `stockvet-inventario-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify(ES ? 'CSV descargado' : 'CSV downloaded');
  };

  const startNewPO = (supId?: string) => {
    setNewPOLines([]); setNewPOExp(''); setPoSearch(''); setPoColsOpen(false);
    if (supId) setNewPOSup(supId);
    setScreen('poCreate');
  };

  const addLineItem = (pid: string) => {
    if (newPOLines.find(l => l.pid === pid)) { notify(ES ? 'Producto ya en la orden' : 'Product already in order'); return; }
    const p = pById(pid);
    if (!p) return;
    setNewPOLines(prev => [...prev, {pid, qty:1, cost:p.cost}]);
  };

  const removeLineItem = (pid: string) => setNewPOLines(prev => prev.filter(l => l.pid !== pid));

  const updateLineQty = (pid: string, v: string) => {
    const n = Math.max(1, parseInt(v) || 1);
    setNewPOLines(prev => prev.map(l => l.pid === pid ? {...l, qty:n} : l));
  };

  const updateLineCost = (pid: string, v: string) => {
    const n = parseFloat(v) || 0;
    setNewPOLines(prev => prev.map(l => l.pid === pid ? {...l, cost:n} : l));
  };

  const savePO = (status: 'draft' | 'ordered') => {
    if (newPOLines.length === 0) { notify(ES ? 'Agrega al menos un producto' : 'Add at least one product'); return; }
    const maxNum = Math.max(1043, ...pos.map(p => parseInt(p.num.replace('PO-',''))));
    const newNum = 'PO-' + (maxNum + 1);
    const newPO: PO = {
      id: 'po' + Date.now(), num: newNum, sup: newPOSup, status,
      exp: newPOExp || (ES ? 'Por definir' : 'TBD'),
      lines: newPOLines.map(l => ({pid:l.pid, qty:l.qty, recd:0, cost:l.cost})),
    };
    setPos(prev => [newPO, ...prev]);
    setNewPOLines([]); setNewPOExp(''); setPoSearch('');
    setSelPO(newPO.id); setScreen('poDetail');
    notify(status === 'draft' ? (ES ? 'Borrador guardado' : 'Draft saved') : (ES ? `${newNum} enviada` : `${newNum} submitted`));
  };

  const addProduct = () => {
    if (!npEs.trim()) { notify(ES ? 'El nombre es requerido' : 'Name is required'); return; }
    const id = 'p' + Date.now();
    const seq = String(products.length + 1).padStart(3, '0');
    const sku = npCat + '-GEN-XX-' + seq;
    const bc = '750123' + String(Date.now()).slice(-7);
    const newP: Product = {
      id, es: npEs.trim(), en: (npEn.trim() || npEs.trim()),
      sku, bc, cat: npCat, sup: npSup,
      cost: parseFloat(npCost) || 0,
      price: parseFloat(npPrice) || 0,
      c:0, n:0, s:0,
      reorder: parseInt(npReorder) || 10,
    };
    setProducts(prev => [...prev, newP]);
    setAddProdOpen(false);
    setNpEs(''); setNpEn(''); setNpCost(''); setNpPrice(''); setNpReorder('10');
    notify(ES ? 'Producto creado' : 'Product created');
  };

  const locName = (k: string) => k === 'central' ? (ES ? 'Bodega Central' : 'Central Warehouse') : k === 'norte' ? (ES ? 'Sucursal Norte' : 'North Branch') : (ES ? 'Punto de Venta' : 'Point of Sale');

  const stMeta = (s: string) => s === 'out'
    ? { t: T.stOut, bg: 'var(--c-red-bg)', c: 'var(--c-red-text)', dot: 'var(--c-red)' }
    : s === 'low'
    ? { t: T.stLow, bg: 'var(--c-yellow-bg)', c: 'var(--c-yellow-text)', dot: 'var(--c-yellow)' }
    : { t: T.stIn, bg: 'var(--c-green-bg)', c: 'var(--c-green-text)', dot: 'var(--c-green)' };

  const enrich = (p: Product) => {
    const total = p.c + p.n + p.s;
    const status = total <= 0 ? 'out' : total <= p.reorder ? 'low' : 'ok';
    const b = stMeta(status);
    const cm = catMeta[p.cat];
    const name = ES ? p.es : p.en;
    return {
      ...p, name, total, totalTxt: num(total), status,
      catName: ES ? cm.es : cm.en, catColor: cm.c,
      cTxt: num(p.c), nTxt: num(p.n), sTxt: num(p.s),
      value: p.cost * total, valueTxt: money(p.cost * total),
      costTxt: money(p.cost), priceTxt: money(p.price),
      margin: Math.round((1 - p.cost / p.price) * 100) + '%',
      reorderTxt: num(p.reorder),
      statusText: b.t, statusBg: b.bg, statusColor: b.c, statusDot: b.dot,
      initials: name.replace(/[^A-Za-zÁÉÍÓÚÑ ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase(),
      bin: bins[p.id] || 'A-01 · E1 · B1',
      rowBg: status === 'out' ? 'var(--c-red-soft)' : 'transparent',
    };
  };

  const allProds = products.map(enrich);
  const pById = (id: string) => allProds.find(p => p.id === id);

  const invValue = allProds.reduce((a, p) => a + p.value, 0);
  const nLow = allProds.filter(p => p.status === 'low').length;
  const nOut = allProds.filter(p => p.status === 'out').length;
  const nInc = pos.filter(p => p.status === 'ordered' || p.status === 'partial').length;

  const poBadge = (s: string) => ({
    draft: { t: T.sDraft, bg: 'var(--c-neutral-bg)', c: 'var(--c-sub)', dot: 'var(--c-faint)' },
    ordered: { t: T.sOrdered, bg: 'var(--c-blue-bg)', c: 'var(--c-blue-text)', dot: 'var(--c-blue)' },
    partial: { t: T.sPartial, bg: 'var(--c-yellow-bg)', c: 'var(--c-yellow-text)', dot: 'var(--c-yellow)' },
    received: { t: T.sReceived, bg: 'var(--c-green-bg)', c: 'var(--c-green-text)', dot: 'var(--c-green)' },
  }[s] || { t: s, bg: 'var(--c-neutral-bg)', c: 'var(--c-sub)', dot: 'var(--c-faint)' });

  const poTotal = (po: PO) => po.lines.reduce((a, l) => a + l.qty * l.cost, 0);

  const applyAdjust = () => {
    const q = parseInt(adjQty) || 0;
    if (adjType !== 'set' && q <= 0) { notify(ES ? 'Ingresa una cantidad' : 'Enter a quantity'); return; }
    const key = adjLoc === 'central' ? 'c' : adjLoc === 'norte' ? 'n' : 's';
    let change = 0;
    const newProds = products.map(p => {
      if (p.id !== selProd) return p;
      const np = { ...p };
      const old = np[key as keyof Pick<Product, 'c' | 'n' | 's'>] as number;
      if (adjType === 'add') np[key as 'c' | 'n' | 's'] = old + q;
      else if (adjType === 'remove') np[key as 'c' | 'n' | 's'] = Math.max(0, old - q);
      else np[key as 'c' | 'n' | 's'] = parseInt(adjQty) || 0;
      change = np[key as 'c' | 'n' | 's'] - old;
      return np;
    });
    const rmap: Record<string, [string, string]> = {
      rCount: ['Recuento de ciclo', 'Cycle count'],
      rDamage: ['Daño en almacén', 'Warehouse damage'],
      rTheft: ['Robo', 'Theft'],
      rRecv: ['Recepción manual', 'Manual receipt'],
      rCorr: ['Corrección', 'Correction'],
    };
    const r = rmap[adjReason] || ['Ajuste', 'Adjustment'];
    const h: HistoryEntry = { pid: selProd, date: ES ? 'Ahora' : 'Now', type: 'adjust', es: r[0], en: r[1], change, loc: adjLoc, user: ES ? 'Tú' : 'You' };
    setProducts(newProds);
    setHistory([h, ...history]);
    setAdjOpen(false);
    setAdjQty('');
    notify(ES ? 'Ajuste aplicado correctamente' : 'Adjustment applied');
  };

  const receivePO = () => {
    let newProds = [...products];
    let added = 0;
    const newHist: HistoryEntry[] = [];
    const newPos = pos.map(po => {
      if (po.id !== selPO) return po;
      const lines = po.lines.map((ln, i) => {
        const pend = ln.qty - ln.recd;
        const k = po.id + ':' + i;
        let qv = recv[k] !== undefined ? (parseInt(recv[k]) || 0) : pend;
        qv = Math.max(0, Math.min(qv, pend));
        if (qv <= 0) return ln;
        added += qv;
        newProds = newProds.map(p => p.id === ln.pid ? { ...p, c: p.c + qv } : p);
        newHist.push({ pid: ln.pid, date: ES ? 'Ahora' : 'Now', type: 'receive', es: 'Recepción ' + po.num, en: 'Received ' + po.num, change: qv, loc: 'central', user: ES ? 'Tú' : 'You' });
        return { ...ln, recd: ln.recd + qv };
      });
      const all = lines.every(l => l.recd >= l.qty);
      const any = lines.some(l => l.recd > 0);
      return { ...po, lines, status: (all ? 'received' : any ? 'partial' : po.status) as PO['status'] };
    });
    setProducts(newProds);
    setPos(newPos);
    setHistory([...newHist, ...history]);
    setRecv({});
    notify(added > 0 ? (ES ? added + ' unidades recibidas' : added + ' units received') : (ES ? 'Nada pendiente por recibir' : 'Nothing pending'));
  };

  // Nav styles
  const navItem = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px',
    borderRadius: 9, cursor: 'pointer', fontSize: 13.5, fontWeight: active ? 600 : 500,
    color: active ? 'var(--c-primary)' : 'var(--c-nav-text)',
    background: active ? 'var(--c-nav-active)' : 'transparent',
    border: 'none', width: '100%', textAlign: 'left', transition: 'background .12s,color .12s',
    fontFamily: 'inherit',
  });

  const isInvActive = screen === 'inventory' || screen === 'product';
  const isPOActive = screen === 'po' || screen === 'poDetail';

  const segActive: React.CSSProperties = { padding: '5px 13px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'var(--c-surface)', color: 'var(--c-text)', boxShadow: '0 1px 2px rgba(0,0,0,.08)', fontFamily: 'inherit' };
  const segIdle: React.CSSProperties = { padding: '5px 13px', borderRadius: 7, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--c-sub)', fontFamily: 'inherit' };

  // Adjust modal preview
  const adjProd = pById(selProd);
  const adjCurrent = adjProd ? (adjLoc === 'central' ? adjProd.c : adjLoc === 'norte' ? adjProd.n : adjProd.s) : 0;
  const adjQtyN = parseInt(adjQty) || 0;
  const adjNew = adjType === 'add' ? adjCurrent + adjQtyN : adjType === 'remove' ? Math.max(0, adjCurrent - adjQtyN) : adjQtyN;
  const adjName = adjProd?.name || '';

  // Barcode screen
  const bcP = pById(bcProd) || allProds[0];
  const labelDims: Record<string, { w: number; h: number }> = { '2x1': { w: 230, h: 120 }, '2.25x1.25': { w: 250, h: 140 }, '4x6': { w: 200, h: 300 } };
  const ld = labelDims[labelSize] || { w: 230, h: 120 };
  const printerName: Record<string, string> = { zebra: 'Zebra ZD420', brother: 'Brother QL-820NWB', dymo: 'Dymo LabelWriter 550' };
  const queueCount = queue.reduce((a, it) => a + Number(it.copies), 0);

  // SKU
  const seqNum = parseInt(skuSeq) || 1;
  const skuPreview = skuCat + '-' + skuType + '-' + skuSize + '-' + String(seqNum).padStart(3, '0');
  const skuBatch = Array.from({ length: 6 }, (_, i) => skuCat + '-' + skuType + '-' + skuSize + '-' + String(seqNum + i).padStart(3, '0'));

  const catAgg: Record<string, number> = {};
  allProds.forEach(p => catAgg[p.cat] = (catAgg[p.cat] || 0) + p.value);
  const maxCat = Math.max(1, ...Object.values(catAgg));

  const q = search.trim().toLowerCase();
  const prodRows = allProds.filter(p => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));

  const selProdData = selProd ? pById(selProd) : null;
  const selPOData = selPO ? pos.find(x => x.id === selPO) : null;

  const btn: React.CSSProperties = { height: 36, padding: '0 15px', borderRadius: 9, border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
  const btnPrimary: React.CSSProperties = { height: 36, padding: '0 16px', borderRadius: 9, border: 'none', background: 'var(--c-primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(0,128,96,.4)' };
  const inputStyle: React.CSSProperties = { border: '1px solid var(--c-border)', background: 'var(--c-surface-2)', borderRadius: 9, padding: '0 12px', fontSize: 13, color: 'var(--c-text)', outline: 'none', fontFamily: 'inherit', height: 38, width: '100%' };
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
  const cardStyle: React.CSSProperties = { background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: 18, boxShadow: 'var(--c-shadow)' };

  const skuCatOptions = Object.keys(catMeta).map(k => ({ value: k, label: k + ' · ' + (ES ? catMeta[k].es : catMeta[k].en) }));
  const skuTypeOptions = [
    { value: 'DOG', label: 'DOG · ' + (ES ? 'Perro' : 'Dog') },
    { value: 'CAT', label: 'CAT · ' + (ES ? 'Gato' : 'Cat') },
    { value: 'AVE', label: 'AVE · ' + (ES ? 'Aves' : 'Poultry') },
    { value: 'BOV', label: 'BOV · ' + (ES ? 'Bovino' : 'Cattle') },
    { value: 'EQ', label: 'EQ · ' + (ES ? 'Equino' : 'Equine') },
    { value: 'GEN', label: 'GEN · ' + (ES ? 'General' : 'General') },
  ];

  return (
    <div data-theme={theme} style={{ ...SS, background: 'var(--c-bg)', color: 'var(--c-text)', minHeight: '100vh', display: 'flex', flexDirection: 'column', WebkitFontSmoothing: 'antialiased', letterSpacing: '-0.01em' }}>

      {/* TOP BAR */}
      <header style={{ height: 56, flexShrink: 0, background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 16, padding: '0 18px', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(140deg,#00a37a,#006e52)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15, boxShadow: '0 1px 3px rgba(0,128,96,.4)' }}>S</div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em' }}>StockVet</span>
            <span style={{ fontSize: 10.5, color: 'var(--c-faint)', fontWeight: 500 }}>{T.store}</span>
          </div>
        </div>
        <div style={{ flex: 1, maxWidth: 520, margin: '0 auto', position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-faint)', fontSize: 14 }}>⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={T.searchPh} style={{ width: '100%', height: 36, border: '1px solid var(--c-border)', background: 'var(--c-surface-2)', borderRadius: 9, padding: '0 12px 0 32px', fontSize: 13, color: 'var(--c-text)', outline: 'none', fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', background: 'var(--c-neutral-bg)', borderRadius: 9, padding: 3, gap: 2 }}>
            <button onClick={() => setLang('es')} style={ES ? segActive : segIdle}>ES</button>
            <button onClick={() => setLang('en')} style={!ES ? segActive : segIdle}>EN</button>
          </div>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--c-border)', background: 'var(--c-surface-2)', color: 'var(--c-sub)', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <div style={{ width: 1, height: 24, background: 'var(--c-border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(140deg,#8a55d6,#5c6ac4)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 600 }}>MR</div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>M. Ramírez</span>
              <span style={{ fontSize: 10.5, color: 'var(--c-faint)' }}>{T.role}</span>
            </div>
          </div>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* SIDEBAR */}
        <nav style={{ width: 230, flexShrink: 0, background: 'var(--c-surface)', borderRight: '1px solid var(--c-border)', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--c-faint)', padding: '4px 12px 6px' }}>{T.ops}</span>
          <button onClick={() => setScreen('dashboard')} style={navItem(screen === 'dashboard')}>◧ {T.nav_dashboard}</button>
          <button onClick={() => { setScreen('inventory'); setSearch(''); }} style={navItem(isInvActive)}>▤ {T.nav_inventory}</button>
          <button onClick={() => setScreen('po')} style={navItem(isPOActive)}>◰ {T.nav_po}</button>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--c-faint)', padding: '14px 12px 6px' }}>{T.tools}</span>
          <button onClick={() => setScreen('bc')} style={navItem(screen === 'bc')}>▥ {T.nav_bc}</button>
          <button onClick={() => setScreen('sku')} style={navItem(screen === 'sku')}>⌗ {T.nav_sku}</button>
          <button onClick={() => setScreen('sup')} style={navItem(screen === 'sup')}>⚇ {T.nav_sup}</button>
          <button onClick={() => setScreen('ai')} style={{ ...navItem(screen === 'ai'), background: screen === 'ai' ? 'var(--c-nav-active)' : 'linear-gradient(135deg,rgba(0,163,122,.08),rgba(92,106,196,.08))', border: screen === 'ai' ? 'none' : '1px solid var(--c-border-2)' }}>✦ {T.nav_ai}</button>
          <div style={{ marginTop: 'auto', background: 'var(--c-surface-2)', border: '1px solid var(--c-border-2)', borderRadius: 11, padding: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--c-primary)' }} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>{T.plan}</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'var(--c-border)', overflow: 'hidden' }}>
              <div style={{ width: '68%', height: '100%', background: 'var(--c-primary)', borderRadius: 3 }} />
            </div>
          </div>
          <button onClick={() => setScreen('settings')} style={{ ...navItem(screen === 'settings'), marginTop: 6 }}>⚙ {T.nav_settings}</button>
        </nav>

        {/* MAIN CONTENT */}
        <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', maxHeight: 'calc(100vh - 56px)' }}>
          <div style={{ padding: '26px 30px 60px', maxWidth: 1180, margin: '0 auto' }}>

            {/* DASHBOARD */}
            {screen === 'dashboard' && (
              <div style={{ animation: 'svfade .25s ease' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
                  <div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>{T.dashTitle}</h1>
                    <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--c-sub)' }}>{T.dashDate}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 9 }}>
                    <button onClick={exportCSV} style={btn}>↧ {T.export}</button>
                    <button onClick={() => setAddProdOpen(true)} style={btnPrimary}>+ {T.addProduct}</button>
                  </div>
                </div>

                {/* KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 13, marginBottom: 16 }}>
                  {[
                    { label: T.kVal, value: money(invValue), delta: '+6.2%', deltaColor: 'var(--c-green-text)', accent: 'var(--c-primary)' },
                    { label: T.kSku, value: num(allProds.length), delta: '+2', deltaColor: 'var(--c-green-text)', accent: '#5c6ac4' },
                    { label: T.kLow, value: num(nLow), delta: T.needsAttention, deltaColor: 'var(--c-yellow-text)', accent: 'var(--c-yellow)' },
                    { label: T.kOut, value: num(nOut), delta: T.needsAttention, deltaColor: 'var(--c-red-text)', accent: 'var(--c-red)' },
                    { label: T.kInc, value: num(nInc), delta: T.period, deltaColor: 'var(--c-sub)', accent: '#2c6ecb' },
                  ].map((k, i) => (
                    <div key={i} style={{ ...cardStyle, position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: k.accent }} />
                      <p style={{ margin: '0 0 9px', fontSize: 11.5, color: 'var(--c-sub)', fontWeight: 600, letterSpacing: '.01em' }}>{k.label}</p>
                      <p style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>{k.value}</p>
                      <p style={{ margin: '9px 0 0', fontSize: 11, fontWeight: 600, color: k.deltaColor }}>{k.delta}</p>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{T.chartVal}</h3>
                      <span style={{ fontSize: 11.5, color: 'var(--c-faint)', fontWeight: 500 }}>{T.period}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>$1,147,200</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-green-text)' }}>+6.2%</span>
                    </div>
                    <ValueChart />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10.5, color: 'var(--c-faint)', fontWeight: 500 }}>
                      {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'].map(m => <span key={m}>{m}</span>)}
                    </div>
                  </div>
                  <div style={cardStyle}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>{T.chartCat}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {Object.keys(catMeta).filter(k => catAgg[k]).map(k => (
                        <div key={k}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <span style={{ width: 9, height: 9, borderRadius: 3, background: catMeta[k].c }} />
                              <span style={{ fontSize: 12.5, fontWeight: 500 }}>{ES ? catMeta[k].es : catMeta[k].en}</span>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-sub)' }}>{money(catAgg[k])}</span>
                          </div>
                          <div style={{ height: 7, borderRadius: 4, background: 'var(--c-neutral-bg)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 4, width: Math.round(catAgg[k] / maxCat * 100) + '%', background: catMeta[k].c }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 16 }}>
                  {/* Alerts */}
                  <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, boxShadow: 'var(--c-shadow)', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--c-border-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{T.alertsTitle}</h3>
                        <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'var(--c-sub)' }}>{T.alertsSub}</p>
                      </div>
                      <button onClick={() => setScreen('inventory')} style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{T.viewAll} →</button>
                    </div>
                    {allProds.filter(p => p.status !== 'ok').sort((a, b) => (a.status === 'out' ? 0 : 1) - (b.status === 'out' ? 0 : 1)).map(p => (
                      <div key={p.id} onClick={() => { setSelProd(p.id); setScreen('product'); }} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 18px', borderBottom: '1px solid var(--c-border-2)', cursor: 'pointer' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: p.catColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{p.initials}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--c-faint)', fontVariantNumeric: 'tabular-nums' }}>{p.sku}</p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{p.totalTxt}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 10.5, color: 'var(--c-faint)' }}>{T.reorderPt} {p.reorderTxt}</p>
                        </div>
                        <span style={{ padding: '3px 9px', borderRadius: 7, fontSize: 11, fontWeight: 600, flexShrink: 0, background: p.statusBg, color: p.statusColor }}>{p.statusText}</span>
                      </div>
                    ))}
                  </div>
                  {/* Activity */}
                  <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, boxShadow: 'var(--c-shadow)', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--c-border-2)' }}>
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{T.recentTitle}</h3>
                    </div>
                    {history.slice(0, 6).map((h, i) => {
                      const p = pById(h.pid) || { name: '—', initials: '—', catColor: '#888' };
                      const pos2 = h.change > 0;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 18px', borderBottom: '1px solid var(--c-border-2)' }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: p.catColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700, flexShrink: 0 }}>{p.initials}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ES ? h.es : h.en}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--c-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name} · {h.date}</p>
                          </div>
                          <span style={{ padding: '3px 9px', borderRadius: 7, fontSize: 12, fontWeight: 700, flexShrink: 0, fontVariantNumeric: 'tabular-nums', color: pos2 ? 'var(--c-green-text)' : 'var(--c-red-text)', background: pos2 ? 'var(--c-green-bg)' : 'var(--c-red-bg)' }}>
                            {(pos2 ? '+' : '') + num(h.change)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* INVENTORY */}
            {screen === 'inventory' && (
              <div style={{ animation: 'svfade .25s ease' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
                  <div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>{T.invTitle}</h1>
                    <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--c-sub)' }}>{allProds.length + (ES ? ' productos · ' : ' products · ') + money(invValue) + (ES ? ' valor total' : ' total value')}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 9 }}>
                    <button onClick={exportCSV} style={btn}>↧ {T.export}</button>
                    <button onClick={() => setAddProdOpen(true)} style={btnPrimary}>+ {T.addProduct}</button>
                  </div>
                </div>
                <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, boxShadow: 'var(--c-shadow)', overflow: 'hidden' }}>
                  <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--c-border-2)', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 28, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-faint)', fontSize: 14 }}>⌕</span>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder={T.searchInv} style={{ width: '100%', maxWidth: 340, height: 34, border: '1px solid var(--c-border)', background: 'var(--c-surface-2)', borderRadius: 8, padding: '0 12px 0 30px', fontSize: 13, color: 'var(--c-text)', outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 880 }}>
                      <thead>
                        <tr style={{ background: 'var(--c-surface-2)' }}>
                          {[T.hProd, T.hSku, T.hCentral, T.hNorte, T.hPos, T.hTotal, T.hValue, T.hStatus].map((h, i) => (
                            <th key={i} style={{ textAlign: i <= 1 || i === 7 ? 'left' : 'right', padding: i === 0 || i === 7 ? '10px 16px' : '10px 12px', fontSize: 11, fontWeight: 600, color: 'var(--c-sub)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {prodRows.map(p => (
                          <tr key={p.id} onClick={() => { setSelProd(p.id); setScreen('product'); }} style={{ borderTop: '1px solid var(--c-border-2)', cursor: 'pointer', background: p.rowBg }}>
                            <td style={{ padding: '11px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                                <div style={{ width: 34, height: 34, borderRadius: 8, background: p.catColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{p.initials}</div>
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ margin: 0, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 230 }}>{p.name}</p>
                                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--c-faint)' }}>{p.catName}</p>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '11px 12px', fontSize: 12, color: 'var(--c-sub)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{p.sku}</td>
                            <td style={{ padding: '11px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.cTxt}</td>
                            <td style={{ padding: '11px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--c-sub)' }}>{p.nTxt}</td>
                            <td style={{ padding: '11px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--c-sub)' }}>{p.sTxt}</td>
                            <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{p.totalTxt}</td>
                            <td style={{ padding: '11px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--c-sub)' }}>{p.valueTxt}</td>
                            <td style={{ padding: '11px 16px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', background: p.statusBg, color: p.statusColor }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.statusDot }} />{p.statusText}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* PRODUCT DETAIL */}
            {screen === 'product' && selProdData && (
              <div style={{ animation: 'svfade .25s ease' }}>
                <button onClick={() => setScreen('inventory')} style={{ background: 'none', border: 'none', color: 'var(--c-sub)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 14, fontFamily: 'inherit' }}>← {T.invTitle}</button>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 12, background: selProdData.catColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, flexShrink: 0 }}>{selProdData.initials}</div>
                    <div>
                      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em' }}>{selProdData.name}</h1>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
                        <span style={{ fontSize: 12.5, color: 'var(--c-sub)', fontVariantNumeric: 'tabular-nums' }}>{selProdData.sku}</span>
                        <span style={{ padding: '2px 9px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, background: selProdData.statusBg, color: selProdData.statusColor }}>{selProdData.statusText}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 9 }}>
                    <button onClick={() => setScreen('bc')} style={btn}>▥ {T.printLabel}</button>
                    <button onClick={() => setAdjOpen(true)} style={btnPrimary}>⇄ {T.adjustInv}</button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div style={cardStyle}>
                    <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600 }}>{T.details}</h3>
                    {[
                      [T.fCat, selProdData.catName],
                      [T.fSup, supMeta[selProdData.sup].name],
                      [T.fCost, selProdData.costTxt],
                      [T.fPrice, selProdData.priceTxt],
                      [T.fMargin, selProdData.margin],
                      [T.fReorder, selProdData.reorderTxt],
                      [T.fBin, selProdData.bin],
                    ].map(([label, val], i, arr) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--c-border-2)' : 'none' }}>
                        <span style={{ fontSize: 12.5, color: 'var(--c-sub)' }}>{label}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: label === T.fMargin ? 'var(--c-green-text)' : undefined }}>{val}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600 }}>{T.barcode}</h3>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid var(--c-border-2)', borderRadius: 11, padding: 18, gap: 10 }}>
                      {generateBarcode(selProdData.bc, 56)}
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#16181a', letterSpacing: '.18em', fontVariantNumeric: 'tabular-nums' }}>{selProdData.bc}</span>
                    </div>
                    <button onClick={() => setScreen('bc')} style={{ ...btn, marginTop: 13, height: 36, background: 'var(--c-surface-2)' }}>▥ {T.printLabel}</button>
                  </div>
                </div>

                <div style={{ ...cardStyle, marginBottom: 16 }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>{T.invByLoc}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                    {[
                      { key: 'c', name: locName('central'), qty: selProdData.c },
                      { key: 'n', name: locName('norte'), qty: selProdData.n },
                      { key: 's', name: locName('pos'), qty: selProdData.s },
                    ].map(l => {
                      const pct = Math.round(l.qty / Math.max(1, selProdData.total) * 100);
                      return (
                        <div key={l.key}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ width: 9, height: 9, borderRadius: 3, background: selProdData.catColor }} />
                              <span style={{ fontSize: 13, fontWeight: 500 }}>{l.name}</span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{num(l.qty)}</span>
                          </div>
                          <div style={{ height: 7, borderRadius: 4, background: 'var(--c-neutral-bg)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 4, width: pct + '%', background: selProdData.catColor }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, boxShadow: 'var(--c-shadow)', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--c-border-2)' }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{T.history}</h3>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--c-surface-2)' }}>
                        {[T.hDate, T.hMov, T.hChange, T.hLoc, T.hUser].map((h, i) => (
                          <th key={i} style={{ textAlign: i === 2 ? 'right' : 'left', padding: i === 0 || i === 4 ? '9px 18px' : '9px 12px', fontSize: 11, fontWeight: 600, color: 'var(--c-sub)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.filter(h => h.pid === selProd).map((h, i) => {
                        const pos2 = h.change > 0;
                        return (
                          <tr key={i} style={{ borderTop: '1px solid var(--c-border-2)' }}>
                            <td style={{ padding: '10px 18px', color: 'var(--c-sub)', whiteSpace: 'nowrap' }}>{h.date}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 500 }}>{ES ? h.es : h.en}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: pos2 ? 'var(--c-green-text)' : 'var(--c-red-text)' }}>{(pos2 ? '+' : '') + num(h.change)}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--c-sub)' }}>{locName(h.loc)}</td>
                            <td style={{ padding: '10px 18px', color: 'var(--c-sub)' }}>{h.user}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PURCHASE ORDERS LIST */}
            {screen === 'po' && (
              <div style={{ animation: 'svfade .25s ease' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
                  <div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>{T.poTitle}</h1>
                    <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--c-sub)' }}>{T.plan}</p>
                  </div>
                  <button onClick={() => startNewPO()} style={btnPrimary}>+ {T.newOrder}</button>
                </div>
                <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, boxShadow: 'var(--c-shadow)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--c-surface-2)' }}>
                        {[T.cOrder, T.cSup, T.cStatus, T.cItems, T.cTotal, T.cExp].map((h, i) => (
                          <th key={i} style={{ textAlign: i >= 3 && i <= 4 ? 'right' : 'left', padding: i === 0 || i === 5 ? '11px 18px' : '11px 12px', fontSize: 11, fontWeight: 600, color: 'var(--c-sub)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pos.map(po => {
                        const b = poBadge(po.status);
                        const items = po.lines.reduce((a, l) => a + l.qty, 0);
                        return (
                          <tr key={po.id} onClick={() => { setSelPO(po.id); setScreen('poDetail'); }} style={{ borderTop: '1px solid var(--c-border-2)', cursor: 'pointer' }}>
                            <td style={{ padding: '13px 18px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{po.num}</td>
                            <td style={{ padding: '13px 12px' }}>{supMeta[po.sup].name}</td>
                            <td style={{ padding: '13px 12px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, background: b.bg, color: b.c }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: b.dot }} />{b.t}
                              </span>
                            </td>
                            <td style={{ padding: '13px 12px', textAlign: 'right', color: 'var(--c-sub)', fontVariantNumeric: 'tabular-nums' }}>{num(items) + ' ' + (ES ? 'art.' : 'items')}</td>
                            <td style={{ padding: '13px 12px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(poTotal(po) * 1.16)}</td>
                            <td style={{ padding: '13px 18px', color: 'var(--c-sub)', whiteSpace: 'nowrap' }}>{po.exp}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PO DETAIL */}
            {screen === 'poDetail' && selPOData && (() => {
              const b = poBadge(selPOData.status);
              const sub = poTotal(selPOData);
              const canReceive = selPOData.status !== 'received' && selPOData.status !== 'draft';
              return (
                <div style={{ animation: 'svfade .25s ease' }}>
                  <button onClick={() => setScreen('po')} style={{ background: 'none', border: 'none', color: 'var(--c-sub)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 14, fontFamily: 'inherit' }}>← {T.poTitle}</button>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{selPOData.num}</h1>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: b.bg, color: b.c }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: b.dot }} />{b.t}
                        </span>
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--c-sub)' }}>{supMeta[selPOData.sup].name} · {supMeta[selPOData.sup].contact}</p>
                    </div>
                    {canReceive && (
                      <button onClick={receivePO} style={{ ...btnPrimary, height: 38, padding: '0 18px' }}>↓ {T.receiveItems}</button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 13, marginBottom: 16 }}>
                    {[
                      [T.supplier, supMeta[selPOData.sup].name],
                      [T.expected, selPOData.exp],
                      [T.total, money(sub * 1.16)],
                    ].map(([label, val], i) => (
                      <div key={i} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--c-shadow)' }}>
                        <p style={{ margin: '0 0 5px', fontSize: 11.5, color: 'var(--c-sub)', fontWeight: 600 }}>{label}</p>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: i === 2 ? 700 : 600, fontVariantNumeric: 'tabular-nums' }}>{val}</p>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, boxShadow: 'var(--c-shadow)', overflow: 'hidden', marginBottom: 16 }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 760 }}>
                        <thead>
                          <tr style={{ background: 'var(--c-surface-2)' }}>
                            {[T.hProd, T.lOrdered, T.lRecd, T.lPending, T.cTotal, T.lRecvNow].map((h, i) => (
                              <th key={i} style={{ textAlign: i === 0 ? 'left' : i === 5 ? 'center' : 'right', padding: i === 0 ? '10px 18px' : i === 5 ? '10px 18px' : '10px 12px', fontSize: 11, fontWeight: 600, color: 'var(--c-sub)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selPOData.lines.map((ln, i) => {
                            const p = pById(ln.pid);
                            if (!p) return null;
                            const pend = ln.qty - ln.recd;
                            const k = selPOData.id + ':' + i;
                            const recvVal = recv[k] !== undefined ? recv[k] : (pend > 0 ? String(pend) : '0');
                            return (
                              <tr key={i} style={{ borderTop: '1px solid var(--c-border-2)' }}>
                                <td style={{ padding: '12px 18px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: p.catColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700, flexShrink: 0 }}>{p.initials}</div>
                                    <div style={{ minWidth: 0 }}>
                                      <p style={{ margin: 0, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>{p.name}</p>
                                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--c-faint)', fontVariantNumeric: 'tabular-nums' }}>{p.sku}</p>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{num(ln.qty)}</td>
                                <td style={{ padding: '12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--c-sub)' }}>{num(ln.recd)}</td>
                                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: pend > 0 ? 'var(--c-yellow-text)' : 'var(--c-green-text)' }}>{num(pend)}</td>
                                <td style={{ padding: '12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--c-sub)' }}>{money(ln.qty * ln.cost)}</td>
                                <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                                  <input value={recvVal} onChange={e => setRecv({ ...recv, [k]: e.target.value.replace(/[^0-9]/g, '') })} style={{ width: 64, height: 34, border: '1px solid var(--c-border)', background: 'var(--c-surface-2)', borderRadius: 8, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--c-text)', outline: 'none', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' }} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 18px', borderTop: '1px solid var(--c-border-2)', background: 'var(--c-surface-2)' }}>
                      <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 7 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: 'var(--c-sub)' }}>{T.subtotal}</span><span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{money(sub)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: 'var(--c-sub)' }}>{T.tax}</span><span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{money(sub * 0.16)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, paddingTop: 8, borderTop: '1px solid var(--c-border)' }}>
                          <span style={{ fontWeight: 700 }}>{T.total}</span><span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(sub * 1.16)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ ...cardStyle }}>
                    <p style={{ margin: '0 0 5px', fontSize: 11.5, color: 'var(--c-sub)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{T.notes}</p>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{ES ? 'Entregar en Bodega Central. Verificar lote y caducidad en biológicos antes de aceptar.' : 'Deliver to Central Warehouse. Verify batch and expiry on biologics before accepting.'}</p>
                  </div>
                </div>
              );
            })()}

            {/* PO CREATE */}
            {screen === 'poCreate' && (() => {
              const q2 = poSearch.trim().toLowerCase();
              const searchResults = allProds.filter(p =>
                !q2 || p.name.toLowerCase().includes(q2) || p.sku.toLowerCase().includes(q2) || p.bc.includes(q2)
              );
              const newPOSub = newPOLines.reduce((a, l) => a + l.qty * l.cost, 0);
              const lineProds = newPOLines.map(l => ({ l, p: pById(l.pid)! })).filter(x => x.p);
              return (
                <div style={{ animation: 'svfade .25s ease' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
                    <div>
                      <button onClick={() => setScreen('po')} style={{ background: 'none', border: 'none', color: 'var(--c-sub)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 6, fontFamily: 'inherit' }}>← {T.poTitle}</button>
                      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>{T.poCreate}</h1>
                      <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--c-sub)' }}>{T.poCreateSub}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 9, flexShrink: 0 }}>
                      <button onClick={() => setScreen('po')} style={btn}>{T.cancel}</button>
                      <button onClick={() => savePO('draft')} style={btn}>{T.poCreateDraft}</button>
                      <button onClick={() => savePO('ordered')} style={btnPrimary}>{T.poCreateSend}</button>
                    </div>
                  </div>

                  {/* Order metadata */}
                  <div style={{ ...cardStyle, marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.cSup}</label>
                      <select value={newPOSup} onChange={e => setNewPOSup(e.target.value)} style={{ ...selectStyle, height: 40 }}>
                        {Object.entries(supMeta).map(([k, s]) => <option key={k} value={k}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.expected}</label>
                      <input type="date" value={newPOExp} onChange={e => setNewPOExp(e.target.value)} style={{ ...inputStyle, height: 40 }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
                    {/* Product search panel */}
                    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--c-border-2)' }}>
                        <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>{ES ? 'Agregar productos' : 'Add products'}</p>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-faint)', fontSize: 14 }}>⌕</span>
                          <input value={poSearch} onChange={e => setPoSearch(e.target.value)} placeholder={T.poSearchPh} style={{ ...inputStyle, paddingLeft: 30, height: 36 }} />
                        </div>
                      </div>
                      <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                        {searchResults.length === 0 ? (
                          <p style={{ textAlign: 'center', color: 'var(--c-faint)', fontSize: 13, padding: '24px 16px', margin: 0 }}>{ES ? 'Sin resultados' : 'No results'}</p>
                        ) : searchResults.map(p => {
                          const inOrder = newPOLines.some(l => l.pid === p.id);
                          return (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', borderBottom: '1px solid var(--c-border-2)', background: inOrder ? 'var(--c-green-bg)' : undefined }}>
                              <div style={{ width: 34, height: 34, borderRadius: 8, background: p.catColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{p.initials}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</p>
                                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--c-faint)' }}>{p.sku} · {ES ? 'Stock' : 'Stock'}: {p.total}</p>
                              </div>
                              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-sub)', flexShrink: 0, marginRight: 6 }}>{money(p.cost)}</span>
                              <button
                                onClick={() => inOrder ? removeLineItem(p.id) : addLineItem(p.id)}
                                style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: inOrder ? 'var(--c-green-text)' : 'var(--c-primary)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, fontFamily: 'inherit' }}
                              >{inOrder ? '−' : '+'}</button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Line items table */}
                    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--c-border-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{T.poLineItems} <span style={{ color: 'var(--c-faint)', fontWeight: 500 }}>({lineProds.length})</span></p>
                        <div style={{ position: 'relative' }}>
                          <button onClick={() => setPoColsOpen(o => !o)} style={{ ...btn, height: 30, padding: '0 10px', fontSize: 12 }}>{T.poCols} ▾</button>
                          {poColsOpen && (
                            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: 36, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.15)', zIndex: 50, padding: '8px 0', minWidth: 170 }}>
                              {([['sku', T.poColSku], ['bc', T.poColBc], ['cat', T.poColCat], ['margin', T.poColMargin]] as [keyof typeof poCols, string][]).map(([k, label]) => (
                                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 14px', cursor: 'pointer', fontSize: 13 }}>
                                  <input type="checkbox" checked={poCols[k]} onChange={e => setPoCols(c => ({...c, [k]: e.target.checked}))} style={{ width: 15, height: 15, cursor: 'pointer' }} />
                                  {label}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {lineProds.length === 0 ? (
                        <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--c-faint)', fontSize: 13 }}>
                          <p style={{ margin: 0 }}>{T.poLinesEmpty}</p>
                        </div>
                      ) : (
                        <>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                              <thead>
                                <tr style={{ background: 'var(--c-surface-2)' }}>
                                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--c-sub)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{T.hProd}</th>
                                  {poCols.sku && <th style={{ textAlign: 'left', padding: '8px 8px', fontSize: 11, fontWeight: 600, color: 'var(--c-sub)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{T.poColSku}</th>}
                                  {poCols.cat && <th style={{ textAlign: 'left', padding: '8px 8px', fontSize: 11, fontWeight: 600, color: 'var(--c-sub)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{T.poColCat}</th>}
                                  <th style={{ textAlign: 'right', padding: '8px 8px', fontSize: 11, fontWeight: 600, color: 'var(--c-sub)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{T.poQtyCol}</th>
                                  <th style={{ textAlign: 'right', padding: '8px 8px', fontSize: 11, fontWeight: 600, color: 'var(--c-sub)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{T.poCostCol}</th>
                                  <th style={{ textAlign: 'right', padding: '8px 8px', fontSize: 11, fontWeight: 600, color: 'var(--c-sub)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{T.poRetail}</th>
                                  {poCols.margin && <th style={{ textAlign: 'right', padding: '8px 8px', fontSize: 11, fontWeight: 600, color: 'var(--c-sub)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{T.poColMargin}</th>}
                                  <th style={{ textAlign: 'right', padding: '8px 8px', fontSize: 11, fontWeight: 600, color: 'var(--c-sub)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{T.cTotal}</th>
                                  <th style={{ padding: '8px 12px', width: 32 }}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {lineProds.map(({l, p}) => {
                                  const lineTotal = l.qty * l.cost;
                                  const margin = p.price > 0 ? Math.round((1 - l.cost / p.price) * 100) : 0;
                                  return (
                                    <tr key={l.pid} style={{ borderTop: '1px solid var(--c-border-2)' }}>
                                      <td style={{ padding: '10px 12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                          <div style={{ width: 30, height: 30, borderRadius: 7, background: p.catColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{p.initials}</div>
                                          <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>{p.name}</span>
                                        </div>
                                      </td>
                                      {poCols.sku && <td style={{ padding: '10px 8px', color: 'var(--c-faint)', fontSize: 11.5, whiteSpace: 'nowrap' }}>{p.sku}</td>}
                                      {poCols.cat && <td style={{ padding: '10px 8px', fontSize: 11.5 }}>{p.catName}</td>}
                                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                                        <input value={l.qty} onChange={e => updateLineQty(l.pid, e.target.value)} style={{ width: 52, height: 30, border: '1px solid var(--c-border)', background: 'var(--c-surface-2)', borderRadius: 7, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--c-text)', outline: 'none', fontFamily: 'inherit' }} />
                                      </td>
                                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                                        <input value={l.cost} onChange={e => updateLineCost(l.pid, e.target.value)} style={{ width: 70, height: 30, border: '1px solid var(--c-border)', background: 'var(--c-surface-2)', borderRadius: 7, textAlign: 'right', paddingRight: 6, fontSize: 12, fontWeight: 600, color: 'var(--c-text)', outline: 'none', fontFamily: 'inherit' }} />
                                      </td>
                                      <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--c-sub)', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{money(p.price)}</td>
                                      {poCols.margin && <td style={{ padding: '10px 8px', textAlign: 'right', color: margin >= 0 ? 'var(--c-green-text)' : 'var(--c-red-text)', fontWeight: 600, fontSize: 12 }}>{margin}%</td>}
                                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{money(lineTotal)}</td>
                                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                        <button onClick={() => removeLineItem(l.pid)} style={{ background: 'none', border: 'none', color: 'var(--c-faint)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px', fontFamily: 'inherit' }}>×</button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <div style={{ padding: '14px 16px', borderTop: '1px solid var(--c-border-2)', background: 'var(--c-surface-2)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', width: 220, fontSize: 13 }}>
                                <span style={{ color: 'var(--c-sub)' }}>{T.subtotal}</span>
                                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{money(newPOSub)}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', width: 220, fontSize: 13 }}>
                                <span style={{ color: 'var(--c-sub)' }}>{T.tax}</span>
                                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{money(newPOSub * 0.16)}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', width: 220, fontSize: 15, paddingTop: 8, borderTop: '1px solid var(--c-border)', marginTop: 2 }}>
                                <span style={{ fontWeight: 700 }}>{T.total}</span>
                                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(newPOSub * 1.16)}</span>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* BARCODES & LABELS */}
            {screen === 'bc' && bcP && (
              <div style={{ animation: 'svfade .25s ease' }}>
                <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>{T.bcTitle}</h1>
                <p style={{ margin: '0 0 22px', fontSize: 13, color: 'var(--c-sub)' }}>Zebra · Brother · Dymo</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 16 }}>
                  {/* Controls */}
                  <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.bcProduct}</label>
                      <select value={bcProd} onChange={e => setBcProd(e.target.value)} style={selectStyle}>
                        {allProds.map(p => <option key={p.id} value={p.id}>{p.name + ' · ' + p.sku}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.bcSym}</label>
                        <select value={bcSym} onChange={e => setBcSym(e.target.value)} style={selectStyle}>
                          {[['code128', 'Code 128'], ['ean13', 'EAN-13'], ['qr', 'QR Code'], ['upca', 'UPC-A']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.labelSize}</label>
                        <select value={labelSize} onChange={e => setLabelSize(e.target.value)} style={selectStyle}>
                          {[['2x1', '2" × 1"'], ['2.25x1.25', '2.25" × 1.25"'], ['4x6', '4" × 6" (envío)']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.printer}</label>
                        <select value={printer} onChange={e => setPrinter(e.target.value)} style={selectStyle}>
                          {[['zebra', 'Zebra ZD420'], ['brother', 'Brother QL-820NWB'], ['dymo', 'Dymo LabelWriter 550']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.copies}</label>
                        <input value={copies} onChange={e => setCopies(e.target.value.replace(/[^0-9]/g, ''))} style={inputStyle} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                      <button onClick={() => { setQueue([...queue, { pid: bcProd, copies: parseInt(copies) || 1, size: labelSize, printer }]); notify(ES ? 'Agregado a la cola' : 'Added to queue'); }} style={{ ...btn, flex: 1, height: 38 }}>+ {T.addQueue}</button>
                      <button onClick={() => { notify(ES ? 'Enviando a ' + printerName[printer] + '…' : 'Sending to ' + printerName[printer] + '…'); setTimeout(() => window.print(), 400); }} style={{ ...btnPrimary, flex: 1, height: 38 }}>▥ {T.print}</button>
                    </div>
                  </div>

                  {/* Preview */}
                  <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600 }}>{T.labelPrev}</h3>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'repeating-conic-gradient(#0000 0% 25%,rgba(140,145,150,.06) 0% 50%) 50% / 18px 18px', border: '1px dashed var(--c-border)', borderRadius: 11, padding: 20 }}>
                      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 3px 12px rgba(0,0,0,.12)', width: ld.w, minHeight: ld.h }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#16181a', textAlign: 'center', lineHeight: 1.2, maxWidth: 200 }}>{bcP.name}</span>
                        {generateBarcode(bcP.bc, ld.h > 200 ? 60 : 48)}
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#16181a', letterSpacing: '.14em', fontVariantNumeric: 'tabular-nums' }}>{bcP.bc}</span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                          <span style={{ fontSize: 9, color: '#555', fontVariantNumeric: 'tabular-nums' }}>{bcP.sku}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#16181a', fontVariantNumeric: 'tabular-nums' }}>{bcP.priceTxt}</span>
                        </div>
                      </div>
                    </div>
                    <p style={{ margin: '13px 0 0', fontSize: 11.5, color: 'var(--c-faint)', textAlign: 'center' }}>{printerName[printer]}</p>
                  </div>

                  {/* Queue */}
                  <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, boxShadow: 'var(--c-shadow)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--c-border-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{T.queueTitle}</h3>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-primary)', background: 'var(--c-nav-active)', padding: '2px 9px', borderRadius: 7, fontVariantNumeric: 'tabular-nums' }}>{num(queueCount)}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      {queue.map((it, i) => {
                        const p = pById(it.pid);
                        const pName = ({ zebra: 'Zebra', brother: 'Brother', dymo: 'Dymo' } as Record<string, string>)[it.printer];
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', borderBottom: '1px solid var(--c-border-2)' }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: p?.catColor || '#888', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{p?.initials || '—'}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p?.name || '—'}</p>
                              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--c-faint)', fontVariantNumeric: 'tabular-nums' }}>{it.copies} × {it.size} · {pName}</p>
                            </div>
                            <button onClick={() => setQueue(queue.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--c-faint)', fontSize: 16, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>×</button>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ padding: '14px 18px', borderTop: '1px solid var(--c-border-2)' }}>
                      <button onClick={() => { notify(ES ? queueCount + ' etiquetas enviadas' : queueCount + ' labels sent'); setQueue([]); }} style={{ ...btnPrimary, width: '100%', height: 38 }}>▥ {T.printQ}</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SKU GENERATOR */}
            {screen === 'sku' && (
              <div style={{ animation: 'svfade .25s ease' }}>
                <h1 style={{ margin: '0 0 22px', fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>{T.skuTitle}</h1>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={cardStyle}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.sCatg}</label>
                        <select value={skuCat} onChange={e => setSkuCat(e.target.value)} style={{ ...selectStyle, height: 40 }}>
                          {skuCatOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.sType}</label>
                        <select value={skuType} onChange={e => setSkuType(e.target.value)} style={{ ...selectStyle, height: 40 }}>
                          {skuTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.sSize}</label>
                          <input value={skuSize} onChange={e => setSkuSize(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))} style={{ ...inputStyle, height: 40, textTransform: 'uppercase' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.sSeq}</label>
                          <input value={skuSeq} onChange={e => setSkuSeq(e.target.value.replace(/[^0-9]/g, ''))} style={{ ...inputStyle, height: 40, fontVariantNumeric: 'tabular-nums' }} />
                        </div>
                      </div>
                      <div style={{ background: 'var(--c-surface-2)', border: '1px solid var(--c-border-2)', borderRadius: 10, padding: '12px 14px' }}>
                        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--c-sub)', lineHeight: 1.5 }}>{T.skuHelp}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 9 }}>
                        <button onClick={() => notify(ES ? 'Lote de 6 SKU generado' : 'Batch of 6 SKUs generated')} style={{ ...btn, flex: 1, height: 40 }}>⌗ {T.genBatch}</button>
                        <button onClick={() => { setNpCat(skuCat); setAddProdOpen(true); }} style={{ ...btnPrimary, flex: 1, height: 40 }}>{T.apply}</button>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: 'linear-gradient(150deg,#0c5132,#008060)', borderRadius: 14, padding: 26, boxShadow: 'var(--c-shadow)', color: '#fff' }}>
                      <p style={{ margin: '0 0 12px', fontSize: 11.5, fontWeight: 600, opacity: .8, letterSpacing: '.04em', textTransform: 'uppercase' }}>{T.preview}</p>
                      <p style={{ margin: '0 0 18px', fontSize: 26, fontWeight: 700, letterSpacing: '.02em', fontVariantNumeric: 'tabular-nums' }}>{skuPreview}</p>
                      <div style={{ background: '#fff', borderRadius: 9, padding: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                        {generateBarcode('SKU' + skuPreview, 44)}
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#16181a', letterSpacing: '.12em', fontVariantNumeric: 'tabular-nums' }}>{skuPreview}</span>
                      </div>
                    </div>
                    <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, boxShadow: 'var(--c-shadow)', overflow: 'hidden' }}>
                      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--c-border-2)' }}>
                        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{T.batchTitle}</h3>
                      </div>
                      {skuBatch.map((sku, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 18px', borderBottom: '1px solid var(--c-border-2)' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '.02em' }}>{sku}</span>
                          <span style={{ fontSize: 11, color: 'var(--c-faint)' }}>●</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUPPLIERS */}
            {screen === 'sup' && (
              <div style={{ animation: 'svfade .25s ease' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
                  <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>{T.supTitle}</h1>
                  <button onClick={() => notify(ES ? 'Acción de demostración' : 'Demo action')} style={btnPrimary}>+ {T.supAdd}</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                  {Object.keys(supMeta).map(k => {
                    const s = supMeta[k];
                    const initials = s.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
                    return (
                      <div key={k} style={cardStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 11, background: 'linear-gradient(140deg,#5c6ac4,#8a55d6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.25 }}>{s.name}</p>
                            <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'var(--c-faint)' }}>{T.contact}: {s.contact}</p>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                          <div style={{ background: 'var(--c-surface-2)', borderRadius: 9, padding: '10px 12px' }}>
                            <p style={{ margin: '0 0 3px', fontSize: 10.5, color: 'var(--c-faint)', fontWeight: 600 }}>{s.count} {T.sProducts}</p>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--c-green-text)' }}>{s.onTime}% {T.onTime}</p>
                          </div>
                          <div style={{ background: 'var(--c-surface-2)', borderRadius: 9, padding: '10px 12px' }}>
                            <p style={{ margin: '0 0 3px', fontSize: 10.5, color: 'var(--c-faint)', fontWeight: 600 }}>{T.leadTime}</p>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.lead} {T.days}</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11.5, color: 'var(--c-faint)' }}>{T.lastOrder}: {s.last}</span>
                          <button onClick={() => startNewPO(k)} style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-primary)', background: 'var(--c-nav-active)', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>{T.newPO}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI ASSISTANT */}
            {screen === 'ai' && (
              <div style={{ animation: 'svfade .25s ease', maxWidth: 780 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
                  <div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>{T.aiTitle}</h1>
                    <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--c-sub)' }}>{T.aiSub}</p>
                  </div>
                  {apiKey && aiMessages.length > 0 && (
                    <button onClick={() => setAiMessages([])} style={btn}>{T.aiClear}</button>
                  )}
                </div>

                {!apiKey ? (
                  <div style={{ ...cardStyle, textAlign: 'center', padding: '40px 30px' }}>
                    <div style={{ fontSize: 36, marginBottom: 14 }}>✦</div>
                    <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600 }}>{T.aiNoKey}</p>
                    <button onClick={() => setScreen('settings')} style={{ ...btnPrimary, marginTop: 14 }}>{T.aiNoKeyLink}</button>
                  </div>
                ) : (
                  <>
                    {aiMessages.length === 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {[T.aiChip1, T.aiChip2, T.aiChip3, T.aiChip4].map((chip) => (
                            <button key={chip} onClick={() => sendAI(chip)} style={{ padding: '8px 14px', borderRadius: 20, border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>{chip}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div ref={aiScrollRef} style={{ ...cardStyle, padding: 0, minHeight: 340, maxHeight: 480, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                      {aiMessages.length === 0 ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: 'var(--c-faint)', padding: 40 }}>
                          <div style={{ fontSize: 32 }}>✦</div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>Powered by Claude</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                          {aiMessages.map((m, i) => (
                            <div key={i} style={{ padding: '14px 18px', borderBottom: '1px solid var(--c-border-2)', background: m.role === 'user' ? 'var(--c-surface-2)' : 'var(--c-surface)' }}>
                              <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', background: m.role === 'user' ? 'linear-gradient(140deg,#8a55d6,#5c6ac4)' : 'linear-gradient(140deg,#00a37a,#006e52)' }}>
                                  {m.role === 'user' ? 'MR' : '✦'}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 600, color: 'var(--c-faint)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{m.role === 'user' ? 'M. Ramírez' : 'StockVet IA'}</p>
                                  {m.loading ? (
                                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 20 }}>
                                      {[0, 1, 2].map(d => <span key={d} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--c-primary)', display: 'inline-block', animation: `svpop .9s ease ${d * 0.2}s infinite` }} />)}
                                    </div>
                                  ) : (
                                    <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 9, marginTop: 12 }}>
                      <input
                        value={aiInput}
                        onChange={e => setAiInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendAI()}
                        placeholder={T.aiPh}
                        disabled={aiLoading}
                        style={{ ...inputStyle, flex: 1, opacity: aiLoading ? 0.6 : 1 }}
                      />
                      <button onClick={() => sendAI()} disabled={aiLoading || !aiInput.trim()} style={{ ...btnPrimary, opacity: (aiLoading || !aiInput.trim()) ? 0.5 : 1, cursor: (aiLoading || !aiInput.trim()) ? 'default' : 'pointer', flexShrink: 0 }}>
                        {aiLoading ? '…' : T.aiSend}
                      </button>
                    </div>
                    <p style={{ margin: '8px 0 0', fontSize: 10.5, color: 'var(--c-faint)', textAlign: 'center' }}>Powered by Claude · claude-opus-4-8</p>
                  </>
                )}
              </div>
            )}

            {/* SETTINGS */}
            {screen === 'settings' && (
              <div style={{ animation: 'svfade .25s ease', maxWidth: 640 }}>
                <div style={{ marginBottom: 26 }}>
                  <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>{T.settingsTitle}</h1>
                  <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--c-sub)' }}>{T.settingsSub}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(140deg,#00a37a,#006e52)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16 }}>✦</div>
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Claude AI</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--c-faint)' }}>Anthropic · claude-opus-4-8</p>
                      </div>
                      {apiKey && <span style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 20, background: 'var(--c-green-bg)', color: 'var(--c-green-text)', fontSize: 11.5, fontWeight: 600 }}>● Activo</span>}
                    </div>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.skApiKey}</label>
                    <div style={{ display: 'flex', gap: 9 }}>
                      <input
                        type="password"
                        value={apiKeyInput}
                        onChange={e => setApiKeyInput(e.target.value)}
                        placeholder={T.skApiKeyPh}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button onClick={saveApiKey} disabled={!apiKeyInput.trim()} style={{ ...btnPrimary, opacity: apiKeyInput.trim() ? 1 : 0.5, flexShrink: 0 }}>{T.skApiKeySave}</button>
                      {apiKey && <button onClick={clearApiKey} style={{ ...btn, color: 'var(--c-red-text)', flexShrink: 0 }}>{T.skApiKeyClear}</button>}
                    </div>
                    <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--c-faint)' }}>🔒 {T.skApiKeyHint}</p>
                  </div>

                  <div style={cardStyle}>
                    <p style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>{ES ? 'Información de la clínica' : 'Clinic information'}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.skStoreName}</label>
                        <input defaultValue={T.skStoreVal} style={{ ...inputStyle }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{ES ? 'Zona horaria' : 'Timezone'}</label>
                        <select style={{ ...selectStyle }}>
                          <option>America/Mexico_City (UTC-6)</option>
                          <option>America/Bogota (UTC-5)</option>
                          <option>America/Lima (UTC-5)</option>
                          <option>America/Santiago (UTC-4)</option>
                          <option>America/Buenos_Aires (UTC-3)</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={() => notify(T.skSaved)} style={btnPrimary}>{ES ? 'Guardar cambios' : 'Save changes'}</button>
                    </div>
                  </div>

                  <div style={cardStyle}>
                    <p style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>{ES ? 'Apariencia' : 'Appearance'}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{ES ? 'Modo oscuro' : 'Dark mode'}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--c-faint)' }}>{ES ? 'También disponible en la barra superior' : 'Also available in the top bar'}</p>
                      </div>
                      <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ width: 48, height: 26, borderRadius: 13, border: 'none', background: theme === 'dark' ? 'var(--c-primary)' : 'var(--c-border)', cursor: 'pointer', position: 'relative', transition: 'background .2s' }}>
                        <span style={{ position: 'absolute', top: 3, left: theme === 'dark' ? 24 : 4, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ADD PRODUCT MODAL */}
      {addProdOpen && (
        <div onClick={() => setAddProdOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,23,28,.45)', backdropFilter: 'blur(2px)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 480, maxWidth: '100%', background: 'var(--c-surface)', borderRadius: 16, boxShadow: 'var(--c-shadow-lg)', overflow: 'hidden', animation: 'svpop .2s ease' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--c-border-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{T.apTitle}</h3>
              <button onClick={() => setAddProdOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--c-faint)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.apEs} *</label>
                  <input value={npEs} onChange={e => setNpEs(e.target.value)} placeholder={ES ? 'Ej: Vitamina C 500ml' : 'E.g. Vitamin C 500ml'} style={{ ...inputStyle, height: 38 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.apEn} <span style={{ fontWeight: 400 }}>{T.apOptional}</span></label>
                  <input value={npEn} onChange={e => setNpEn(e.target.value)} placeholder="E.g. Vitamin C 500ml" style={{ ...inputStyle, height: 38 }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.fCat}</label>
                  <select value={npCat} onChange={e => setNpCat(e.target.value)} style={{ ...selectStyle, height: 38 }}>
                    {Object.entries(catMeta).map(([k, c]) => <option key={k} value={k}>{k} · {ES ? c.es : c.en}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.fSup}</label>
                  <select value={npSup} onChange={e => setNpSup(e.target.value)} style={{ ...selectStyle, height: 38 }}>
                    {Object.entries(supMeta).map(([k, s]) => <option key={k} value={k}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.fCost}</label>
                  <input value={npCost} onChange={e => setNpCost(e.target.value)} placeholder="0.00" type="number" min="0" step="0.01" style={{ ...inputStyle, height: 38 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.fPrice}</label>
                  <input value={npPrice} onChange={e => setNpPrice(e.target.value)} placeholder="0.00" type="number" min="0" step="0.01" style={{ ...inputStyle, height: 38 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.fReorder}</label>
                  <input value={npReorder} onChange={e => setNpReorder(e.target.value)} placeholder="10" type="number" min="0" style={{ ...inputStyle, height: 38 }} />
                </div>
              </div>
              {npCost && npPrice && parseFloat(npPrice) > 0 && (
                <div style={{ background: 'var(--c-surface-2)', border: '1px solid var(--c-border-2)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 20 }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 10.5, color: 'var(--c-faint)', fontWeight: 600 }}>{T.fMargin}</p>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--c-green-text)' }}>
                      {Math.round((1 - parseFloat(npCost || '0') / parseFloat(npPrice || '1')) * 100)}%
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--c-border-2)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setAddProdOpen(false)} style={btn}>{T.cancel}</button>
              <button onClick={addProduct} style={{ ...btnPrimary, height: 38, padding: '0 18px' }}>{T.apCreate}</button>
            </div>
          </div>
        </div>
      )}

      {/* ADJUST MODAL */}
      {adjOpen && (
        <div onClick={() => setAdjOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,23,28,.45)', backdropFilter: 'blur(2px)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 440, maxWidth: '100%', background: 'var(--c-surface)', borderRadius: 16, boxShadow: 'var(--c-shadow-lg)', overflow: 'hidden', animation: 'svpop .2s ease' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--c-border-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{T.adjTitle}</h3>
                <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--c-sub)' }}>{adjName}</p>
              </div>
              <button onClick={() => setAdjOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--c-faint)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 15 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.mLoc}</label>
                <select value={adjLoc} onChange={e => setAdjLoc(e.target.value)} style={{ ...selectStyle, height: 40 }}>
                  {[['central', locName('central')], ['norte', locName('norte')], ['pos', locName('pos')]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.mType}</label>
                  <select value={adjType} onChange={e => setAdjType(e.target.value)} style={{ ...selectStyle, height: 40 }}>
                    {[['add', T.tAdd], ['remove', T.tRemove], ['set', T.tSet]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.mQty}</label>
                  <input value={adjQty} onChange={e => setAdjQty(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" style={{ ...inputStyle, height: 40 }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-sub)', display: 'block', marginBottom: 6 }}>{T.mReason}</label>
                <select value={adjReason} onChange={e => setAdjReason(e.target.value)} style={{ ...selectStyle, height: 40 }}>
                  {[['rCount', T.rCount], ['rDamage', T.rDamage], ['rTheft', T.rTheft], ['rRecv', T.rRecv], ['rCorr', T.rCorr]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--c-surface-2)', border: '1px solid var(--c-border-2)', borderRadius: 11, padding: '13px 16px' }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <p style={{ margin: '0 0 3px', fontSize: 10.5, color: 'var(--c-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{T.currentStock}</p>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{num(adjCurrent)}</p>
                </div>
                <span style={{ fontSize: 18, color: 'var(--c-faint)' }}>→</span>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <p style={{ margin: '0 0 3px', fontSize: 10.5, color: 'var(--c-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{T.newStock}</p>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--c-primary)', fontVariantNumeric: 'tabular-nums' }}>{num(adjNew)}</p>
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--c-border-2)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setAdjOpen(false)} style={btn}>{T.cancel}</button>
              <button onClick={applyAdjust} style={{ ...btnPrimary, height: 38, padding: '0 18px' }}>{T.applyAdj}</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1a1c1d', color: '#fff', padding: '11px 20px', borderRadius: 11, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.3)', zIndex: 100, animation: 'svtoast .25s ease', display: 'flex', alignItems: 'center', gap: 9, fontFamily: 'inherit' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3fd99a' }} />{toast}
        </div>
      )}
    </div>
  );
}
