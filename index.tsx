import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Plus, Search, Database, FileText, Download, FileSpreadsheet,
  X, ClipboardPaste, ListPlus, Loader2, Trash2, Edit3, 
  TrendingDown, TrendingUp, Info, ClipboardList, CheckCircle, 
  AlertCircle, Sparkles 
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

// --- TYPES ---
interface SORItem {
  id: string;
  name: string;
  unit: string;
  rate: number;
  scopeOfWork: string;
  source: string;
  timestamp: number;
}

interface TenderItem {
  id: string;
  name: string;
  quantity: number;
  requestedScope: string;
  estimatedRate?: number;
  matchedRate?: SORItem;
  status: 'pending' | 'matched' | 'review' | 'no-match';
}

interface MatchResult {
  isMatch: boolean;
  confidence: number;
  reason: string;
}

// --- GEMINI SERVICE ---
const ai = new GoogleGenAI({ apiKey: (window as any).process?.env?.API_KEY || '' });

const gemini = {
  async checkScopeMatch(requestedScope: string, existingScope: string): Promise<MatchResult> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Compare scopes: Req: "${requestedScope}", DB: "${existingScope}". Match?`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isMatch: { type: Type.BOOLEAN },
              confidence: { type: Type.NUMBER },
              reason: { type: Type.STRING },
            },
            required: ["isMatch", "confidence", "reason"],
          },
        },
      });
      return JSON.parse(response.text || '{}');
    } catch (error) {
      return { isMatch: false, confidence: 0, reason: "Error validating scope." };
    }
  },

  async findBestMatchingItem(targetItemName: string, targetScope: string, dbItems: { id: string; name: string }[]): Promise<string | null> {
    if (dbItems.length === 0) return null;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Find best match for "${targetItemName}" (${targetScope}) in: ${dbItems.map(i => `${i.name} (ID:${i.id})`).join(', ')}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: { matchedId: { type: Type.STRING, nullable: true } },
            required: ["matchedId"]
          },
        },
      });
      return JSON.parse(response.text || '{}').matchedId || null;
    } catch (error) { return null; }
  },

  async parseRatesFromText(text: string): Promise<Omit<SORItem, 'id' | 'timestamp'>[]> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Extract SOR items (name, unit, rate, scope, source) from: ${text}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                unit: { type: Type.STRING },
                rate: { type: Type.NUMBER },
                scopeOfWork: { type: Type.STRING },
                source: { type: Type.STRING },
              },
              required: ["name", "unit", "rate", "scopeOfWork", "source"]
            },
          },
        },
      });
      return JSON.parse(response.text || '[]');
    } catch (error) { return []; }
  },

  async parseBulkItems(text: string): Promise<any[]> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Extract tender items (name, quantity, requestedScope, estimatedRate) from: ${text}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                requestedScope: { type: Type.STRING },
                estimatedRate: { type: Type.NUMBER }
              },
              required: ["name", "quantity", "requestedScope"]
            }
          }
        }
      });
      return JSON.parse(response.text || '[]');
    } catch (e) { return []; }
  }
};

// --- COMPONENTS ---

const RateForm: React.FC<{
  editingItem?: SORItem | null;
  onSubmit: (data: Omit<SORItem, 'id' | 'timestamp'>) => void;
  onBulkSubmit: (items: Omit<SORItem, 'id' | 'timestamp'>[]) => void;
  onCancel: () => void;
}> = ({ editingItem, onSubmit, onBulkSubmit, onCancel }) => {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [isProcessing, setIsProcessing] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [previewItems, setPreviewItems] = useState<Omit<SORItem, 'id' | 'timestamp'>[]>([]);
  const [formData, setFormData] = useState({ name: '', unit: '', rate: '', scopeOfWork: '', source: '' });

  useEffect(() => {
    if (editingItem) {
      setFormData({
        name: editingItem.name,
        unit: editingItem.unit,
        rate: editingItem.rate.toString(),
        scopeOfWork: editingItem.scopeOfWork,
        source: editingItem.source,
      });
      setMode('single');
    }
  }, [editingItem]);

  const handleScrape = async () => {
    if (!bulkText.trim()) return;
    setIsProcessing(true);
    const extracted = await gemini.parseRatesFromText(bulkText);
    setPreviewItems(extracted);
    setIsProcessing(false);
  };

  return (
    <div className="flex flex-col max-h-[90vh]">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div>
          <h3 className="text-xl font-bold text-slate-800">{editingItem ? 'Edit Rate' : 'Add Rates'}</h3>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
      </div>

      {!editingItem && (
        <div className="flex p-1 bg-slate-100 mx-6 mt-4 rounded-xl">
          <button onClick={() => setMode('single')} className={`flex-1 py-2 text-sm font-medium rounded-lg ${mode === 'single' ? 'bg-white shadow-sm' : ''}`}>Single</button>
          <button onClick={() => setMode('bulk')} className={`flex-1 py-2 text-sm font-medium rounded-lg ${mode === 'bulk' ? 'bg-white shadow-sm' : ''}`}>AI Bulk</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {mode === 'single' ? (
          <form onSubmit={e => { e.preventDefault(); onSubmit({ ...formData, rate: parseFloat(formData.rate) }); }} className="space-y-4">
            <input placeholder="Item Name" required className="w-full px-4 py-2 border rounded-xl" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <input placeholder="Unit" required className="w-full px-4 py-2 border rounded-xl" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} />
              <input placeholder="Rate" type="number" required step="0.01" className="w-full px-4 py-2 border rounded-xl" value={formData.rate} onChange={e => setFormData({ ...formData, rate: e.target.value })} />
            </div>
            <textarea placeholder="Scope of Work" required rows={4} className="w-full px-4 py-2 border rounded-xl" value={formData.scopeOfWork} onChange={e => setFormData({ ...formData, scopeOfWork: e.target.value })} />
            <input placeholder="Source" className="w-full px-4 py-2 border rounded-xl" value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })} />
            <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold">Save Rate</button>
          </form>
        ) : (
          <div className="space-y-4">
            {!previewItems.length ? (
              <>
                <textarea rows={8} className="w-full px-4 py-3 border rounded-xl font-mono text-sm" placeholder="Paste SOR text..." value={bulkText} onChange={e => setBulkText(e.target.value)} />
                <button onClick={handleScrape} disabled={isProcessing} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center">
                  {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <ClipboardPaste className="mr-2" />} Scrape
                </button>
              </>
            ) : (
              <div className="space-y-3">
                {previewItems.map((item, idx) => (
                  <div key={idx} className="p-3 bg-white border rounded-xl">
                    <div className="flex justify-between font-bold"><span>{item.name}</span><span>₹{item.rate}</span></div>
                    <p className="text-xs text-slate-500 line-clamp-1">{item.scopeOfWork}</p>
                  </div>
                ))}
                <button onClick={() => onBulkSubmit(previewItems)} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold">Import All</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const RateList: React.FC<{ rates: SORItem[]; allRates: SORItem[]; onDelete: (id: string) => void; onEdit: (item: SORItem) => void; }> = ({ rates, allRates, onDelete, onEdit }) => {
  const isLowest = (item: SORItem) => {
    const sameItems = allRates.filter(r => r.name.toLowerCase() === item.name.toLowerCase());
    return sameItems.length > 1 && item.rate === Math.min(...sameItems.map(r => r.rate));
  };

  if (rates.length === 0) return <div className="text-center py-20 bg-white border-dashed border-2 rounded-2xl"><Info className="mx-auto text-slate-300 mb-2" /> No rates found</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {rates.map(item => (
        <div key={item.id} className={`bg-white rounded-xl border p-4 hover:shadow-md transition-all ${isLowest(item) ? 'border-emerald-200 ring-1 ring-emerald-50' : ''}`}>
          <div className="flex justify-between items-start">
            <h4 className="font-bold text-slate-800 line-clamp-1">{item.name}</h4>
            {isLowest(item) && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold">LOWEST</span>}
          </div>
          <p className="text-xs text-slate-400 mt-1">{item.source || 'No Source'}</p>
          <div className="my-3 text-sm text-slate-600 line-clamp-2 italic">"{item.scopeOfWork}"</div>
          <div className="flex justify-between items-end border-t pt-3">
            <div><span className="text-xs text-slate-400 block">Rate / {item.unit}</span><span className="text-xl font-black">₹{item.rate.toLocaleString()}</span></div>
            <div className="flex space-x-1">
              <button onClick={() => onEdit(item)} className="p-2 text-slate-400 hover:text-indigo-600"><Edit3 className="w-4 h-4" /></button>
              <button onClick={() => onDelete(item.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const TenderProcessor: React.FC<{ sorData: SORItem[] }> = ({ sorData }) => {
  const [inputText, setInputText] = useState('');
  const [items, setItems] = useState<TenderItem[]>([]);
  const [processing, setProcessing] = useState(false);

  const handleProcess = async () => {
    setProcessing(true);
    const parsed = await gemini.parseBulkItems(inputText);
    const processed: TenderItem[] = [];
    for (const p of parsed) {
      const matchedId = await gemini.findBestMatchingItem(p.name, p.requestedScope, sorData.map(d => ({ id: d.id, name: d.name })));
      const bestMatch = sorData.find(d => d.id === matchedId);
      processed.push({
        id: crypto.randomUUID(),
        name: p.name,
        quantity: p.quantity || 1,
        requestedScope: p.requestedScope,
        estimatedRate: p.estimatedRate,
        matchedRate: bestMatch,
        status: bestMatch ? 'review' : 'no-match'
      });
    }
    setItems(processed);
    setProcessing(false);
  };

  return (
    <div className="space-y-6">
      {items.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border text-center">
          <ClipboardList className="mx-auto text-indigo-100 w-16 h-16 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Analyze Tender Items</h2>
          <textarea className="w-full h-48 p-4 border rounded-2xl mb-4 text-sm" placeholder="Paste tender items here..." value={inputText} onChange={e => setInputText(e.target.value)} />
          <button onClick={handleProcess} disabled={processing || !inputText.trim()} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center">
            {processing ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />} Build Quote
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Estimated Quote</h2>
            <button onClick={() => setItems([])} className="text-red-500 text-sm font-bold flex items-center"><Trash2 className="w-4 h-4 mr-1" /> Clear All</button>
          </div>
          {items.map(item => (
            <div key={item.id} className="bg-white p-4 rounded-xl border flex justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 font-bold">{item.name} <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px]">x{item.quantity}</span></div>
                <p className="text-xs text-slate-400 mt-1 line-clamp-1 italic">{item.requestedScope}</p>
                {item.matchedRate && <div className="mt-2 text-xs bg-indigo-50 p-2 rounded border border-indigo-100 text-indigo-700">Matched with: {item.matchedRate.name} (₹{item.matchedRate.rate})</div>}
              </div>
              <div className="text-right min-w-[120px]">
                <div className="text-xs text-slate-400 uppercase font-bold">Total</div>
                <div className="text-lg font-black text-indigo-600">₹{(item.quantity * (item.matchedRate?.rate || 0)).toLocaleString()}</div>
              </div>
            </div>
          ))}
          <div className="bg-slate-900 text-white p-8 rounded-3xl flex justify-between items-center">
            <div><h3 className="text-xl font-bold">Grand Total</h3><p className="text-slate-400 text-xs">Based on lowest benchmark matches</p></div>
            <div className="text-4xl font-black text-indigo-400">₹{items.reduce((s, i) => s + (i.quantity * (i.matchedRate?.rate || 0)), 0).toLocaleString()}</div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- APP ROOT ---

const App: React.FC = () => {
  const [view, setView] = useState<'database' | 'tender'>('database');
  const [sorData, setSorData] = useState<SORItem[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SORItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('smart_rate_sor');
    if (saved) setSorData(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('smart_rate_sor', JSON.stringify(sorData));
  }, [sorData]);

  const handleAddOrUpdateRate = (item: Omit<SORItem, 'id' | 'timestamp'>) => {
    if (editingItem) {
      setSorData(prev => prev.map(r => r.id === editingItem.id ? { ...item, id: r.id, timestamp: r.timestamp } : r));
    } else {
      setSorData(prev => [...prev, { ...item, id: crypto.randomUUID(), timestamp: Date.now() }]);
    }
    setIsFormOpen(false);
    setEditingItem(null);
  };

  const filteredRates = useMemo(() => sorData.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())), [sorData, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 w-full bg-white border-b h-16 flex items-center px-4 justify-between shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="bg-indigo-600 p-2 rounded-lg"><Database className="text-white w-5 h-5" /></div>
          <span className="font-bold text-xl hidden sm:block">SmartRate</span>
        </div>
        <nav className="flex bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setView('database')} className={`px-4 py-1.5 rounded-lg text-sm font-bold ${view === 'database' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>DB</button>
          <button onClick={() => setView('tender')} className={`px-4 py-1.5 rounded-lg text-sm font-bold ${view === 'tender' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Quote</button>
        </nav>
        <button onClick={() => { setEditingItem(null); setIsFormOpen(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold flex items-center text-sm"><Plus className="w-4 h-4 mr-1" /> Add</button>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-8">
        {view === 'database' ? (
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <div><h1 className="text-2xl font-black">SOR Database</h1><p className="text-slate-400 text-sm">{sorData.length} records</p></div>
              <div className="relative w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input placeholder="Search items..." className="w-full pl-9 pr-4 py-2 border rounded-xl" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
            </div>
            <RateList rates={filteredRates} allRates={sorData} onDelete={id => setSorData(s => s.filter(i => i.id !== id))} onEdit={i => { setEditingItem(i); setIsFormOpen(true); }} />
          </div>
        ) : <TenderProcessor sorData={sorData} />}
      </main>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsFormOpen(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <RateForm editingItem={editingItem} onSubmit={handleAddOrUpdateRate} onBulkSubmit={items => { setSorData(prev => [...prev, ...items.map(i => ({ ...i, id: crypto.randomUUID(), timestamp: Date.now() }))]); setIsFormOpen(false); }} onCancel={() => setIsFormOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
