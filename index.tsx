import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Plus, Search, Database, X, ClipboardPaste, Loader2, Trash2, 
  Edit3, TrendingDown, Info, ClipboardList, CheckCircle, 
  AlertCircle, Sparkles, FileSpreadsheet, TrendingUp
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

// --- GEMINI INITIALIZATION ---
// Using process.env.API_KEY as strictly required.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const gemini = {
  async findBestMatchingItem(targetItemName: string, targetScope: string, dbItems: { id: string; name: string }[]): Promise<string | null> {
    if (dbItems.length === 0) return null;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `I have a tender item: "${targetItemName}" with scope: "${targetScope}".
        Select the best matching item ID from this list or return null if no good match exists:
        ${dbItems.map(item => `- ${item.name} (ID: ${item.id})`).join('\n')}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: { matchedId: { type: Type.STRING, nullable: true } },
            required: ["matchedId"]
          },
        },
      });
      const result = JSON.parse(response.text || '{}');
      return result.matchedId || null;
    } catch (error) {
      console.error("Matching failed:", error);
      return null;
    }
  },

  async parseBulkItems(text: string): Promise<any[]> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Extract tender items (name, quantity, scope, estimatedRate) from this text: ${text}`,
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
                estimatedRate: { type: Type.NUMBER, nullable: true }
              },
              required: ["name", "quantity", "requestedScope"]
            }
          }
        }
      });
      return JSON.parse(response.text || '[]');
    } catch (e) {
      return [];
    }
  },

  async parseRatesFromText(text: string): Promise<Omit<SORItem, 'id' | 'timestamp'>[]> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Extract Schedule of Rates data (name, unit, rate, scope, source) from: ${text}`,
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
    } catch (error) {
      return [];
    }
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
        <h3 className="text-xl font-bold text-slate-800">{editingItem ? 'Edit Rate' : 'Add Rates'}</h3>
        <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
      </div>

      {!editingItem && (
        <div className="flex p-1 bg-slate-100 mx-6 mt-4 rounded-xl">
          <button onClick={() => setMode('single')} className={`flex-1 py-2 text-sm font-medium rounded-lg ${mode === 'single' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Single</button>
          <button onClick={() => setMode('bulk')} className={`flex-1 py-2 text-sm font-medium rounded-lg ${mode === 'bulk' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>AI Bulk</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {mode === 'single' ? (
          <form onSubmit={e => { e.preventDefault(); onSubmit({ ...formData, rate: parseFloat(formData.rate) }); }} className="space-y-4">
            <input placeholder="Item Name" required className="w-full px-4 py-3 border rounded-xl bg-slate-50/50 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <input placeholder="Unit (e.g. m3)" required className="w-full px-4 py-3 border rounded-xl bg-slate-50/50 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} />
              <input placeholder="Rate (₹)" type="number" required step="0.01" className="w-full px-4 py-3 border rounded-xl bg-slate-50/50 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.rate} onChange={e => setFormData({ ...formData, rate: e.target.value })} />
            </div>
            <textarea placeholder="Scope of Work" required rows={4} className="w-full px-4 py-3 border rounded-xl bg-slate-50/50 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.scopeOfWork} onChange={e => setFormData({ ...formData, scopeOfWork: e.target.value })} />
            <input placeholder="Source/Reference" className="w-full px-4 py-3 border rounded-xl bg-slate-50/50 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })} />
            <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100">Save Rate Card</button>
          </form>
        ) : (
          <div className="space-y-4">
            {!previewItems.length ? (
              <>
                <textarea rows={8} className="w-full px-4 py-3 border rounded-xl bg-slate-50/50 font-mono text-sm" placeholder="Paste SOR data text here..." value={bulkText} onChange={e => setBulkText(e.target.value)} />
                <button onClick={handleScrape} disabled={isProcessing || !bulkText.trim()} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center">
                  {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <ClipboardPaste className="mr-2" />} Extract Data
                </button>
              </>
            ) : (
              <div className="space-y-3">
                {previewItems.map((item, idx) => (
                  <div key={idx} className="p-3 bg-white border rounded-xl shadow-sm">
                    <div className="flex justify-between font-bold text-sm"><span>{item.name}</span><span className="text-indigo-600">₹{item.rate}</span></div>
                    <p className="text-[10px] text-slate-500 mt-1 italic line-clamp-1">{item.scopeOfWork}</p>
                  </div>
                ))}
                <button onClick={() => onBulkSubmit(previewItems)} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold">Confirm & Import All</button>
                <button onClick={() => setPreviewItems([])} className="w-full py-2 text-slate-400 text-sm">Cancel</button>
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

  if (rates.length === 0) return (
    <div className="text-center py-20 bg-white border-dashed border-2 rounded-3xl flex flex-col items-center">
      <Database className="w-12 h-12 text-slate-200 mb-4" />
      <p className="text-slate-400 font-medium">No rate cards found in database</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {rates.map(item => (
        <div key={item.id} className={`bg-white rounded-2xl border p-5 transition-all hover:shadow-lg group ${isLowest(item) ? 'border-emerald-200 ring-1 ring-emerald-50' : 'border-slate-100'}`}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-indigo-500 tracking-widest">{item.source || 'Standard Reference'}</span>
              <h4 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-indigo-600 transition-colors">{item.name}</h4>
            </div>
            {isLowest(item) && <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-1 rounded-lg font-black flex items-center"><TrendingDown className="w-3 h-3 mr-1" /> BENCHMARK</span>}
          </div>
          <div className="mb-4">
            <p className="text-xs text-slate-400 mb-1">Scope of Work</p>
            <p className="text-sm text-slate-600 line-clamp-3 italic leading-relaxed">"{item.scopeOfWork}"</p>
          </div>
          <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Rate / {item.unit}</span>
              <span className="text-2xl font-black text-slate-900">₹{item.rate.toLocaleString()}</span>
            </div>
            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onEdit(item)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit3 className="w-4 h-4" /></button>
              <button onClick={() => onDelete(item.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
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
    if (!inputText.trim()) return;
    setProcessing(true);
    const parsed = await gemini.parseBulkItems(inputText);
    const results: TenderItem[] = [];
    
    for (const p of parsed) {
      const matchedId = await gemini.findBestMatchingItem(p.name, p.requestedScope, sorData.map(d => ({ id: d.id, name: d.name })));
      const match = sorData.find(d => d.id === matchedId);
      results.push({
        id: crypto.randomUUID(),
        name: p.name,
        quantity: p.quantity || 1,
        requestedScope: p.requestedScope,
        estimatedRate: p.estimatedRate,
        matchedRate: match,
        status: match ? (match.name.toLowerCase() === p.name.toLowerCase() ? 'matched' : 'review') : 'no-match'
      });
    }
    setItems(results);
    setProcessing(false);
  };

  const calculateTotal = () => items.reduce((sum, item) => sum + (item.quantity * (item.matchedRate?.rate || 0)), 0);

  return (
    <div className="space-y-8">
      {items.length === 0 ? (
        <div className="bg-white p-8 sm:p-12 rounded-[2rem] border border-slate-100 shadow-sm text-center">
          <ClipboardList className="w-16 h-16 text-indigo-100 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Analyze Tender Document</h2>
          <p className="text-slate-500 mb-8 max-w-md mx-auto">Paste items from your tender list. AI will find matching rates from your database to build an instant quote.</p>
          <textarea className="w-full h-48 p-5 border border-slate-200 rounded-3xl bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none text-sm leading-relaxed mb-6" placeholder="Paste items (e.g., 50m of 25mm GI Pipe, excavation for foundations...)" value={inputText} onChange={e => setInputText(e.target.value)} />
          <button onClick={handleProcess} disabled={processing || !inputText.trim() || sorData.length === 0} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50">
            {processing ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Sparkles className="w-6 h-6 mr-2" />} Build Quote Analysis
          </button>
          {sorData.length === 0 && <p className="mt-4 text-xs text-red-400 font-bold uppercase tracking-widest">Database is empty! Add rates first.</p>}
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center px-2">
            <div>
              <h2 className="text-2xl font-black text-slate-800">Quotation Summary</h2>
              <p className="text-slate-500 text-sm">Matching results with database benchmark rates</p>
            </div>
            <button onClick={() => setItems([])} className="p-3 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-6 h-6" /></button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {items.map(item => (
              <div key={item.id} className={`bg-white p-6 rounded-3xl border flex flex-col sm:flex-row justify-between gap-6 ${item.status === 'review' ? 'border-amber-200 bg-amber-50/5' : 'border-slate-100'}`}>
                <div className="flex-1">
                  <div className="flex items-center flex-wrap gap-2 mb-2">
                    <h4 className="font-bold text-slate-800 text-lg">{item.name}</h4>
                    <span className="bg-slate-900 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase">Qty: {item.quantity}</span>
                    {item.status === 'review' && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 flex items-center"><AlertCircle className="w-3 h-3 mr-1" /> Semantic Match</span>}
                  </div>
                  <p className="text-xs text-slate-400 italic mb-4 line-clamp-1">Requested: {item.requestedScope}</p>
                  {item.matchedRate ? (
                    <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Matched Item</p>
                      <p className="font-bold text-indigo-700 text-sm">{item.matchedRate.name}</p>
                      <p className="text-[10px] text-indigo-400 mt-1">Ref: {item.matchedRate.source}</p>
                    </div>
                  ) : <div className="p-3 bg-red-50 rounded-2xl border border-red-100 text-red-500 text-xs font-bold uppercase tracking-widest">No benchmark match</div>}
                </div>
                <div className="text-right min-w-[200px] flex flex-col justify-between border-t sm:border-t-0 sm:border-l border-slate-100 pt-4 sm:pt-0 sm:pl-6">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Quoted Rate</span>
                    <div className="text-2xl font-black text-slate-900">₹{(item.matchedRate?.rate || 0).toLocaleString()}</div>
                  </div>
                  <div className="mt-4">
                    <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Total Amount</span>
                    <div className="text-3xl font-black text-indigo-600">₹{(item.quantity * (item.matchedRate?.rate || 0)).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-[100px]" />
            <div className="relative z-10 text-center sm:text-left">
              <h3 className="text-2xl font-bold">Total Estimated Quote</h3>
              <p className="text-slate-400 text-sm mt-1">Based on {items.filter(i => i.matchedRate).length} matched items</p>
            </div>
            <div className="relative z-10 text-center sm:text-right mt-6 sm:mt-0">
              <div className="text-5xl sm:text-6xl font-black text-indigo-400 tracking-tighter">₹{calculateTotal().toLocaleString()}</div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">{items.length} Total Items in Tender</p>
            </div>
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
    const saved = localStorage.getItem('smart_rate_sor_v2');
    if (saved) setSorData(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('smart_rate_sor_v2', JSON.stringify(sorData));
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

  const filteredRates = useMemo(() => sorData.filter(i => 
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    i.source.toLowerCase().includes(searchQuery.toLowerCase())
  ), [sorData, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b h-16 flex items-center px-6 justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-xl"><Database className="text-white w-5 h-5" /></div>
          <span className="font-black text-xl tracking-tight hidden sm:block">SmartRate</span>
        </div>
        
        <nav className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button onClick={() => setView('database')} className={`px-5 py-1.5 rounded-xl text-sm font-bold transition-all ${view === 'database' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500'}`}>Rate Cards</button>
          <button onClick={() => setView('tender')} className={`px-5 py-1.5 rounded-xl text-sm font-bold transition-all ${view === 'tender' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500'}`}>Tender Builder</button>
        </nav>

        <button onClick={() => { setEditingItem(null); setIsFormOpen(true); }} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">
          <Plus className="w-5 h-5 mr-1" /> Add Rate
        </button>
      </header>

      <main className="max-w-7xl mx-auto p-6 sm:p-10">
        {view === 'database' ? (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
              <div>
                <h1 className="text-4xl font-black text-slate-800 tracking-tighter">Database</h1>
                <p className="text-slate-400 font-medium">Manage and search your benchmark Schedule of Rates</p>
              </div>
              <div className="relative w-full sm:w-80 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input placeholder="Filter by name or source..." className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
            </div>
            <RateList rates={filteredRates} allRates={sorData} onDelete={id => setSorData(s => s.filter(i => i.id !== id))} onEdit={i => { setEditingItem(i); setIsFormOpen(true); }} />
          </div>
        ) : <TenderProcessor sorData={sorData} />}
      </main>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsFormOpen(false)} />
          <div className="relative bg-white w-full max-w-xl rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            <RateForm editingItem={editingItem} onSubmit={handleAddOrUpdateRate} onBulkSubmit={items => { setSorData(prev => [...prev, ...items.map(i => ({ ...i, id: crypto.randomUUID(), timestamp: Date.now() }))]); setIsFormOpen(false); }} onCancel={() => setIsFormOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
