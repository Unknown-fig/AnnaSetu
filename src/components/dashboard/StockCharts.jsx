import React, { useMemo } from 'react';
import { useStore } from '../../context/store';
import { COMMODITIES, calculateAgeDays, round2 } from '../../types/models';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';

export const StockCharts = React.memo(function StockCharts({ language = 'en' }) {
  const { state } = useStore();
  const { batches } = state;

  // 1. Stock by Commodity Data (Memoized)
  const commodityData = useMemo(() => {
    return COMMODITIES.map(comm => {
      const totalQtl = round2(
        batches
          .filter(b => b.commodity === comm)
          .reduce((sum, b) => sum + (b.remainingQtl || 0), 0)
      );
      return {
        commodity: comm,
        quintals: totalQtl,
      };
    });
  }, [batches]);

  // 2. Ageing Distribution Data (Memoized)
  const { ageingData, totalStock } = useMemo(() => {
    let freshQtl = 0;
    let moderateQtl = 0;
    let criticalQtl = 0;

    batches.forEach(b => {
      if (b.remainingQtl <= 0) return;
      const age = calculateAgeDays(b.receiptDate);
      if (age <= 20) {
        freshQtl = round2(freshQtl + b.remainingQtl);
      } else if (age <= 59) {
        moderateQtl = round2(moderateQtl + b.remainingQtl);
      } else {
        criticalQtl = round2(criticalQtl + b.remainingQtl);
      }
    });

    const data = [
      { name: 'Fresh (0-20d)', value: freshQtl, color: '#15803d' },
      { name: 'Moderate (21-59d)', value: moderateQtl, color: '#b45309' },
      { name: 'Critical (60+d)', value: criticalQtl, color: '#b91c1c' },
    ];

    return {
      ageingData: data,
      totalStock: round2(freshQtl + moderateQtl + criticalQtl)
    };
  }, [batches]);


  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
      {/* Chart 1: Stock by Commodity */}
      <div className="bg-white border border-slate-300 rounded-md p-4 flex flex-col shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#1e3a8a]" />
            <div>
              <span className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wide block">
                Stock Distribution by Commodity (Quintals)
              </span>
              <span className="text-[10px] text-slate-500 font-hind">
                जिंसवार खाद्यान्न भंडारण स्थिति
              </span>
            </div>
          </div>
          <span className="text-[11px] text-slate-600 font-mono font-medium">
            {batches.length} Total Batches
          </span>
        </div>

        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={commodityData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <XAxis 
                dataKey="commodity" 
                stroke="#475569" 
                fontSize={10} 
                tickLine={false}
                interval={0}
                angle={-15}
                textAnchor="end"
              />
              <YAxis 
                stroke="#475569" 
                fontSize={10} 
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  borderColor: '#cbd5e1', 
                  borderRadius: '6px',
                  color: '#0f172a',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(val) => [`${val} Qtl`, 'Current Stock']}
              />
              <Bar dataKey="quintals" radius={[4, 4, 0, 0]}>
                {commodityData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.commodity === 'Wheat' ? '#1e3a8a' : entry.commodity === 'Rice' ? '#2563eb' : '#0284c7'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Ageing Distribution */}
      <div className="bg-white border border-slate-300 rounded-md p-4 flex flex-col shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-[#b45309]" />
            <div>
              <span className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wide block">
                Stock Ageing Profile (FIFO Priority)
              </span>
              <span className="text-[10px] text-slate-500 font-hind">
                भंडारण आयु वितरण एवं प्राथमिकता
              </span>
            </div>
          </div>
          <span className="text-[11px] text-slate-600 font-mono font-medium">
            {totalStock} Qtl Active
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 h-48">
          <div className="h-44 w-44 relative flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ageingData}
                  cx="50%"
                  cy="50%"
                  innerRadius={36}
                  outerRadius={62}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {ageingData.map((entry, index) => (
                    <Cell key={`slice-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    borderRadius: '6px',
                    color: '#0f172a',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(val) => [`${val} Qtl (${totalStock > 0 ? Math.round((val/totalStock)*100) : 0}%)`, 'Stock']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 w-full space-y-2 text-xs">
            {ageingData.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between p-1.5 rounded bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                  <span className="font-semibold text-slate-800 text-[11px]">{entry.name}</span>
                </div>
                <span className="font-mono font-bold text-slate-900 text-[11px]">
                  {entry.value} Qtl ({totalStock > 0 ? Math.round((entry.value/totalStock)*100) : 0}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

