
import React, { useState } from 'react';
import { ClipboardList, CheckCircle, AlertCircle, Loader2, Trash2, FileSpreadsheet, Sparkles, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { SORItem, TenderItem } from '../types.ts';
import { parseBulkItems, findBestMatchingItem } from '../services/geminiService.ts';

interface TenderProcessorProps {
  sorData: SORItem[];
}

const TenderProcessor: React.FC<TenderProcessorProps> = ({ sorData }) => {
  const [inputText, setInputText] = useState('');
  const [items, setItems] = useState<TenderItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [confirmingItem, setConfirmingItem] = useState<string | null>(null);

  const handleProcess = async () => {
    if (!inputText.trim()) return;
    setProcessing(true);
    
    // 1. Parse bulk text into structured items
    const parsed = await parseBulkItems(inputText);
    
    const initialTenderItems: TenderItem[] = parsed.map(p => ({
      id: crypto.randomUUID(),
      name: p.name,
      quantity: p.quantity || 1,
      requestedScope: p.requestedScope,
      estimatedRate: p.estimatedRate,
      status: 'pending' as const
    }));

    const processedItems: TenderItem[] = [];

    // 2. Intelligent Matching Loop
    for (const tenderItem of initialTenderItems) {
      // Step A: Try Exact Name Match
      const exactMatches = sorData.filter(sor => sor.name.toLowerCase() === tenderItem.name.toLowerCase());
      
      if (exactMatches.length > 0) {
        // Pick the lowest rate among exact matches
        const lowestExact = [...exactMatches].sort((a, b) => a.rate - b.rate)[0];
        
        // Check if scope is identical
        const isScopeIdentical = lowestExact.scopeOfWork.toLowerCase().trim() === tenderItem.requestedScope.toLowerCase().trim();
        
        processedItems.push({
          ...tenderItem,
          status: isScopeIdentical ? 'matched' : 'review',
          matchedRate: lowestExact
        });
        continue;
      }

      // Step B: Try Semantic/Similar Match via Gemini
      const dbItemSummary = sorData.map(d => ({ id: d.id, name: d.name }));
      
      const matchedId = await findBestMatchingItem(tenderItem.name, tenderItem.requestedScope, dbItemSummary);
      
      if (matchedId) {
        const bestMatch = sorData.find(d => d.id === matchedId);
        if (bestMatch) {
          processedItems.push({
            ...tenderItem,
            status: 'review', // Semantic matches always require manual review
            matchedRate: bestMatch
          });
          continue;
        }
      }

      // Step C: No Match Found
      processedItems.push({ ...tenderItem, status: 'no-match' });
    }

    setItems(processedItems);
    setProcessing(false);
  };

  const calculateDiff = (est?: number, quoted?: number) => {
    if (!est || !quoted) return null;
    return ((quoted - est) / est) * 100;
  };

  const handleExportExcel = () => {
    const headers = [
      'Tender Item', 
      'Quantity', 
      'Requested Scope', 
      'Estimated Rate (INR)', 
      'Quoted Rate (INR)', 
      'Unit', 
      'Percentage Diff (%)',
      'Total Quoted (INR)', 
      'Matched Database Item',
      'Source', 
      'Status'
    ];
    
    const rows = items.map(i => {
      const quoted = i.matchedRate?.rate || 0;
      const est = i.estimatedRate || 0;
      const diff = est ? ((quoted - est) / est) * 100 : 0;
      return [
        i.name,
        i.quantity,
        i.requestedScope,
        est || 'N/A',
        quoted || 'N/A',
        i.matchedRate?.unit || 'N/A',
        est ? diff.toFixed(2) + '%' : 'N/A',
        (i.quantity * quoted).toFixed(2),
        i.matchedRate?.name || 'N/A',
        i.matchedRate?.source || '',
        i.status.toUpperCase()
      ];
    });

    const generateCSV = (data: any[][]) => {
      const content = data.map(row => 
        row.map(cell => {
          const val = cell === null || cell === undefined ? "" : String(cell);
          return `"${val.replace(/"/g, '""')}"`;
        }).join(",")
      ).join("\r\n");
      return "\uFEFF" + content;
    };

    const csvContent = generateCSV([headers, ...rows]);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Quotation_Builder_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-12 shadow-sm transition-all">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-indigo-50 p-3 rounded-2xl">
              <ClipboardList className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">New Quote Analysis</h2>
              <p className="text-slate-500 text-sm">Upload items. AI will find lowest rates and compare with your estimated prices.</p>
            </div>
          </div>
          
          <textarea 
            className="w-full h-64 p-5 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-xs sm:text-sm bg-slate-50 leading-relaxed border-dashed" 
            placeholder={`Example:\n1. 5HP Centrifugal Pump, 2 units, with installation. Est Rate: 25000\n2. LT Control Panel, 400V, standard wiring. Price: 120000`} 
            value={inputText} 
            onChange={(e) => setInputText(e.target.value)} 
          />
          
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center text-xs text-slate-400">
              <Sparkles className="w-4 h-4 mr-2 text-indigo-400" />
              Upload includes estimated rates? AI will calculate the variance automatically.
            </div>
            <button 
              disabled={processing || !inputText.trim() || sorData.length === 0} 
              onClick={handleProcess} 
              className="w-full sm:w-auto px-10 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 disabled:opacity-50 flex items-center justify-center transition-all active:scale-95"
            >
              {processing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Search className="w-5 h-5 mr-2" />} 
              Analyze & Quote
            </button>
          </div>
          {sorData.length === 0 && (
            <p className="text-center mt-4 text-xs text-red-400 font-medium">Please add rates to your database first!</p>
          )}
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Quotation Builder</h2>
              <p className="text-slate-500 text-xs font-medium">Comparing list estimates with lowest database benchmarks.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setItems([])} className="px-3 py-2 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-red-500 transition-all">
                <Trash2 className="w-5 h-5" />
              </button>
              <button onClick={handleExportExcel} className="flex-1 sm:flex-none flex items-center px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-emerald-700 transition-all">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Export to Excel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {items.map((item) => {
              const diff = calculateDiff(item.estimatedRate, item.matchedRate?.rate);
              return (
                <div key={item.id} className={`bg-white rounded-2xl border p-4 sm:p-6 shadow-sm transition-all ${item.status === 'review' ? 'border-amber-200 bg-amber-50/10' : item.status === 'no-match' ? 'border-slate-100 opacity-80' : 'border-slate-200'}`}>
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center flex-wrap gap-2">
                        <h4 className="font-bold text-slate-800 text-base sm:text-lg">{item.name}</h4>
                        <span className="text-[10px] font-black bg-slate-900 px-2 py-0.5 rounded text-white uppercase tracking-tighter">Qty: {item.quantity}</span>
                        
                        {item.status === 'review' && (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1" /> Verify Similarity
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 italic leading-relaxed line-clamp-2">Requested: {item.requestedScope}</p>
                      
                      {item.status !== 'no-match' && item.matchedRate && (
                        <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Quoted Benchmark (Lowest):</div>
                          <div className="font-semibold text-slate-700 text-sm">{item.matchedRate.name}</div>
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">Source: {item.matchedRate.source}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-3 min-w-[240px]">
                      <div className="grid grid-cols-2 gap-4 w-full text-right">
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Est. Rate</div>
                          <div className="text-sm font-bold text-slate-500">₹{item.estimatedRate?.toLocaleString() || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Quoted Rate</div>
                          <div className="text-lg font-black text-slate-900">₹{item.matchedRate?.rate?.toLocaleString() || 'N/A'}</div>
                        </div>
                      </div>

                      {diff !== null && (
                        <div className={`text-xs font-bold flex items-center px-3 py-1 rounded-full ${diff <= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {diff <= 0 ? <TrendingDown className="w-3 h-3 mr-1" /> : <TrendingUp className="w-3 h-3 mr-1" />}
                          {Math.abs(diff).toFixed(2)}% {diff <= 0 ? 'Lower' : 'Higher'}
                        </div>
                      )}

                      <div className="text-right border-t border-slate-100 pt-2 w-full">
                        <div className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-1">Total Quoted</div>
                        <div className="text-2xl font-black text-indigo-600 tracking-tighter">
                          ₹{(item.quantity * (item.matchedRate?.rate || 0)).toLocaleString()}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {item.status === 'review' && (
                          <button 
                            onClick={() => setConfirmingItem(item.id)} 
                            className="px-4 py-2 bg-amber-500 text-white text-[11px] font-bold rounded-xl shadow-lg hover:bg-amber-600 transition-all uppercase"
                          >
                            Accept Match
                          </button>
                        )}
                        {item.status === 'matched' && (
                          <div className="flex items-center text-emerald-600 font-bold text-xs uppercase bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">
                            <CheckCircle className="w-4 h-4 mr-1.5" /> Confirmed
                          </div>
                        )}
                        <button 
                          onClick={() => setItems(prev => prev.filter(p => p.id !== item.id))} 
                          className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {confirmingItem === item.id && (
                    <div className="mt-6 pt-6 border-t border-amber-100 animate-in slide-in-from-top-4 duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tender Requirement</div>
                          <div className="p-4 bg-white border border-slate-200 rounded-2xl text-xs text-slate-600 italic shadow-inner">
                            {item.requestedScope}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest flex items-center">
                            <Sparkles className="w-3 h-3 mr-1" /> Suggested Benchmark Scope
                          </div>
                          <div className="p-4 bg-indigo-50/30 border border-indigo-100 rounded-2xl text-xs text-slate-600 italic shadow-inner">
                            {item.matchedRate?.scopeOfWork}
                          </div>
                        </div>
                      </div>
                      <div className="mt-6 flex justify-end items-center gap-4">
                        <span className="text-[10px] text-slate-400 italic">Is this item a valid substitute at this rate?</span>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmingItem(null)} className="px-5 py-2 text-xs font-bold text-slate-400 hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
                          <button 
                            onClick={() => { setItems(prev => prev.map(i => i.id === item.id ? {...i, status: 'matched'} : i)); setConfirmingItem(null); }} 
                            className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs shadow-xl hover:bg-black transition-all"
                          >
                            Accept & Quote
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="mt-10 p-8 bg-slate-900 rounded-[3rem] text-white flex flex-col sm:flex-row items-center justify-between shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-[100px]"></div>
             <div className="relative z-10 text-center sm:text-left">
               <h3 className="text-2xl font-bold">Quotation Summary</h3>
               <p className="text-slate-400 text-sm mt-1">Sum of all database matched benchmark rates.</p>
             </div>
             <div className="mt-6 sm:mt-0 relative z-10 text-right">
               <div className="text-4xl sm:text-6xl font-black tabular-nums tracking-tighter text-indigo-400">
                 ₹{items.reduce((sum, item) => sum + (item.quantity * (item.matchedRate?.rate || 0)), 0).toLocaleString()}
               </div>
               <div className="text-[10px] font-bold uppercase text-slate-500 mt-2 tracking-widest">
                 {items.filter(i => i.status === 'matched').length} Matches / {items.length} Total Items
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenderProcessor;
