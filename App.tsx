
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Database, 
  FileText, 
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { SORItem } from './types.ts';

// Components
import RateForm from './components/RateForm.tsx';
import RateList from './components/RateList.tsx';
import TenderProcessor from './components/TenderProcessor.tsx';

const App: React.FC = () => {
  const [view, setView] = useState<'database' | 'tender'>('database');
  const [sorData, setSorData] = useState<SORItem[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SORItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Persist Data
  useEffect(() => {
    const saved = localStorage.getItem('smart_rate_sor');
    if (saved) {
      try {
        setSorData(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved rates", e);
        setSorData([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('smart_rate_sor', JSON.stringify(sorData));
  }, [sorData]);

  const handleAddOrUpdateRate = (item: Omit<SORItem, 'id' | 'timestamp'>) => {
    if (editingItem) {
      setSorData(prev => prev.map(r => r.id === editingItem.id ? { ...item, id: r.id, timestamp: r.timestamp } : r));
    } else {
      const newItem: SORItem = {
        ...item,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };
      setSorData(prev => [...prev, newItem]);
    }
    setIsFormOpen(false);
    setEditingItem(null);
  };

  const addBulkRates = (items: Omit<SORItem, 'id' | 'timestamp'>[]) => {
    const newItems: SORItem[] = items.map(item => ({
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }));
    setSorData(prev => [...prev, ...newItems]);
    setIsFormOpen(false);
  };

  const deleteRate = (id: string) => {
    setSorData(sorData.filter(item => item.id !== id));
  };

  const openEdit = (item: SORItem) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  // Robust CSV conversion for Excel
  const generateCSV = (rows: any[][]) => {
    const content = rows.map(row => 
      row.map(cell => {
        const val = cell === null || cell === undefined ? "" : String(cell);
        // Escape quotes by doubling them and wrap in quotes
        return `"${val.replace(/"/g, '""')}"`;
      }).join(",")
    ).join("\r\n");
    return "\uFEFF" + content; // Add BOM for Excel UTF-8 support
  };

  const handleDownloadDatabaseExcel = () => {
    const headers = ['Item Name', 'Unit', 'Rate (INR)', 'Source', 'Scope of Work'];
    const data = sorData.map(r => [r.name, r.unit, r.rate, r.source, r.scopeOfWork]);
    const csvContent = generateCSV([headers, ...data]);
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `SOR_Database_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  const groupedRates = useMemo(() => {
    return sorData
      .filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.scopeOfWork.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.source.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [sorData, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Navigation Header - Fixed for Mobile */}
      <header className="sticky top-0 z-30 w-full bg-white border-b border-slate-200 shadow-sm no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-2">
            <div className="flex items-center space-x-2 flex-shrink-0">
              <div className="bg-indigo-600 p-1.5 sm:p-2 rounded-lg shadow-md">
                <Database className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="text-base sm:text-xl font-bold tracking-tight text-slate-800 hidden xs:block">SmartRate</span>
            </div>
            
            <nav className="flex items-center space-x-1 p-1 bg-slate-100 rounded-xl overflow-hidden">
              <button 
                onClick={() => setView('database')}
                className={`flex items-center px-2.5 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${view === 'database' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
              >
                <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span>DB</span>
              </button>
              <button 
                onClick={() => setView('tender')}
                className={`flex items-center px-2.5 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${view === 'tender' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
              >
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span>Quote</span>
              </button>
            </nav>

            <button 
              onClick={() => { setEditingItem(null); setIsFormOpen(true); }}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-700 transition-all flex items-center text-xs sm:text-sm font-bold flex-shrink-0"
            >
              <Plus className="w-4 h-4 mr-1 sm:mr-1.5" />
              <span>Add</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {view === 'database' ? (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-800">SOR Database</h1>
                <p className="text-slate-500 text-xs sm:text-sm">{sorData.length} active records in memory.</p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-2xl">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    className="w-full pl-9 pr-3 py-2 sm:py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                    placeholder="Search name, scope, source..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleDownloadDatabaseExcel} className="flex-1 sm:flex-none flex items-center justify-center px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-indigo-200 transition-all shadow-sm">
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Excel
                  </button>
                  <button onClick={handleDownloadPDF} className="flex-1 sm:flex-none flex items-center justify-center px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-red-200 transition-all shadow-sm">
                    <Download className="w-3.5 h-3.5 mr-1.5 text-red-600" /> PDF
                  </button>
                </div>
              </div>
            </div>

            <RateList 
              rates={groupedRates} 
              onDelete={deleteRate} 
              onEdit={openEdit}
              allRates={sorData} 
            />
          </div>
        ) : (
          <TenderProcessor sorData={sorData} />
        )}
      </main>

      {/* Modal - Fully responsive height and positioning */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto no-print">
          <div className="flex items-end sm:items-center justify-center min-h-screen px-0 sm:px-4 pb-0 sm:pb-20">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => { setIsFormOpen(false); setEditingItem(null); }}></div>
            <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden transform transition-all animate-in slide-in-from-bottom sm:slide-in-from-top-4 duration-300">
              <RateForm 
                editingItem={editingItem}
                onSubmit={handleAddOrUpdateRate} 
                onBulkSubmit={addBulkRates}
                onCancel={() => { setIsFormOpen(false); setEditingItem(null); }} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
