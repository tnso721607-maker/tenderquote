
import React from 'react';
import { Trash2, Edit3, TrendingDown, Info } from 'lucide-react';
import { SORItem } from '../types';

interface RateListProps {
  rates: SORItem[];
  allRates: SORItem[];
  onDelete: (id: string) => void;
  onEdit: (item: SORItem) => void;
}

const RateList: React.FC<RateListProps> = ({ rates, allRates, onDelete, onEdit }) => {
  const isLowest = (item: SORItem) => {
    const sameItems = allRates.filter(r => r.name.toLowerCase() === item.name.toLowerCase());
    if (sameItems.length <= 1) return false;
    const lowestRate = Math.min(...sameItems.map(r => r.rate));
    return item.rate === lowestRate;
  };

  if (rates.length === 0) {
    return (
      <div className="text-center py-20 bg-white border border-dashed border-slate-300 rounded-2xl no-print">
        <Info className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-900">No rates found</h3>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {rates.map(item => {
        const lowest = isLowest(item);
        return (
          <div key={item.id} className={`bg-white rounded-xl border p-5 transition-all hover:shadow-md relative flex flex-col ${lowest ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-slate-200'}`}>
            {lowest && (
              <div className="absolute top-4 right-4 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center uppercase tracking-wider no-print">
                <TrendingDown className="w-3 h-3 mr-1" />
                Benchmark
              </div>
            )}
            
            <div className="mb-4 pr-16 md:pr-0">
              <span className="text-[10px] uppercase font-semibold text-indigo-500 tracking-wider mb-1 block">
                {item.source || 'Standard Reference'}
              </span>
              <h4 className="text-lg font-bold text-slate-800 leading-tight">{item.name}</h4>
              <p className="text-sm text-slate-500 mt-1">Unit: {item.unit}</p>
            </div>

            <div className="flex-1 mb-4">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Scope of Work</div>
              <p className="text-sm text-slate-600 line-clamp-3 italic leading-relaxed">"{item.scopeOfWork}"</p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block mb-1">Rate</span>
                <span className="text-2xl font-black text-slate-900">₹{item.rate.toLocaleString()}</span>
              </div>
              <div className="flex items-center space-x-1 no-print">
                <button onClick={() => onEdit(item)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(item.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RateList;
