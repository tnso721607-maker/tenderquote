
import React, { useState, useEffect } from 'react';
import { X, ClipboardPaste, ListPlus, Loader2, Sparkles } from 'lucide-react';
import { parseRatesFromText } from '../services/geminiService';
import { SORItem } from '../types';

interface RateFormProps {
  editingItem?: SORItem | null;
  onSubmit: (data: Omit<SORItem, 'id' | 'timestamp'>) => void;
  onBulkSubmit: (items: Omit<SORItem, 'id' | 'timestamp'>[]) => void;
  onCancel: () => void;
}

const RateForm: React.FC<RateFormProps> = ({ editingItem, onSubmit, onBulkSubmit, onCancel }) => {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [isProcessing, setIsProcessing] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [previewItems, setPreviewItems] = useState<Omit<SORItem, 'id' | 'timestamp'>[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    unit: '',
    rate: '',
    scopeOfWork: '',
    source: '',
  });

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

  const handleSubmitSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.rate) return;
    onSubmit({
      ...formData,
      rate: parseFloat(formData.rate),
    });
  };

  const handleScrape = async () => {
    if (!bulkText.trim()) return;
    setIsProcessing(true);
    try {
      const extracted = await parseRatesFromText(bulkText);
      setPreviewItems(extracted);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col max-h-[90vh]">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div>
          <h3 className="text-xl font-bold text-slate-800">{editingItem ? 'Edit Rate' : 'Add Rates'}</h3>
          <p className="text-sm text-slate-500">{editingItem ? 'Updating existing entry' : 'New entry in SOR Database'}</p>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
          <X className="w-5 h-5" />
        </button>
      </div>

      {!editingItem && (
        <div className="flex p-1 bg-slate-100 mx-6 mt-4 rounded-xl border border-slate-200">
          <button onClick={() => setMode('single')} className={`flex-1 py-2 text-sm font-medium rounded-lg ${mode === 'single' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Single Entry</button>
          <button onClick={() => setMode('bulk')} className={`flex-1 py-2 text-sm font-medium rounded-lg ${mode === 'bulk' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>AI Bulk Scrape</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {mode === 'single' ? (
          <form onSubmit={handleSubmitSingle} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Item Name</label>
              <input type="text" required className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50/30" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Unit</label>
                <input type="text" required className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50/30" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Rate (₹)</label>
                <input type="number" required step="0.01" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50/30" value={formData.rate} onChange={e => setFormData({ ...formData, rate: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Scope of Work</label>
              <textarea required rows={4} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none bg-slate-50/30" value={formData.scopeOfWork} onChange={e => setFormData({ ...formData, scopeOfWork: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Source</label>
              <input type="text" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50/30" value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })} />
            </div>
            <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg font-bold mt-4 transition-all">
              {editingItem ? 'Update Rate Card' : 'Add to Database'}
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            {!previewItems.length ? (
              <div className="space-y-4">
                <textarea rows={8} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50/30 font-mono text-sm" placeholder="Paste SOR text here..." value={bulkText} onChange={e => setBulkText(e.target.value)} />
                <button onClick={handleScrape} disabled={isProcessing || !bulkText.trim()} className="w-full py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg font-bold flex items-center justify-center disabled:opacity-50">
                  {isProcessing ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analysing...</> : <><ClipboardPaste className="w-5 h-5 mr-2" /> Scrape Data</>}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  {previewItems.map((item, idx) => (
                    <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                      <div className="flex justify-between items-start mb-1"><span className="font-bold text-slate-800 text-sm">{item.name}</span><span className="font-black text-indigo-600 text-sm">₹{item.rate}</span></div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 italic">{item.scopeOfWork}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => onBulkSubmit(previewItems)} className="w-full py-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-lg font-bold flex items-center justify-center">
                  <ListPlus className="w-5 h-5 mr-2" /> Import All Verified
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RateForm;
