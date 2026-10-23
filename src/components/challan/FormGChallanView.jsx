import React, { useCallback } from 'react';
import { 
  Printer, 
  Download, 
  CheckCircle2, 
  QrCode, 
  FileText, 
  ShieldCheck, 
  Building2, 
  Calendar, 
  Truck, 
  ArrowLeft,
  Stamp,
  Lock
} from 'lucide-react';
import { round2 } from '../../types/models';

export const FormGChallanView = React.memo(function FormGChallanView({ challan, onBack, onPrint }) {
  // Fallback demo challan if none is currently active
  const activeData = challan || {
    challanId: 'UP-GBN-CH-2026-89412',
    fps: {
      id: 'FPS-GN-101',
      name: 'Kasna Village Market PDS Outlet',
      sector: 'Kasna Zone, Greater Noida',
      licenseNo: 'UP-GBN-PDS-101'
    },
    commodity: 'Wheat',
    requestedQty: 120,
    allocations: [
      {
        batchId: 'WH-102',
        bay: 'A2',
        supplier: 'FCI Hapur Depot',
        receiptDate: '2026-08-29',
        ageDays: 55,
        take: 50,
        remainingBefore: 50,
        remainingAfter: 0,
        isExhausted: true
      },
      {
        batchId: 'WH-103',
        bay: 'A3',
        supplier: 'FCI Hapur Depot',
        receiptDate: '2026-09-08',
        ageDays: 45,
        take: 55,
        remainingBefore: 55,
        remainingAfter: 0,
        isExhausted: true
      },
      {
        batchId: 'WH-104',
        bay: 'B3',
        supplier: 'UP State Agro',
        receiptDate: '2026-10-03',
        ageDays: 20,
        take: 15,
        remainingBefore: 50,
        remainingAfter: 35,
        isExhausted: false
      }
    ],
    isManualOverride: false,
    status: 'FULFILLED',
    stagedAt: new Date().toISOString(),
    fulfilledAt: new Date().toISOString()
  };

  const handlePrint = useCallback(() => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  }, [onPrint]);


  const totalBags = Math.round(activeData.requestedQty * 2); // 50kg bags = 2 bags per Quintal
  const dispatchDate = new Date(activeData.fulfilledAt || activeData.stagedAt || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const dispatchTime = new Date(activeData.fulfilledAt || activeData.stagedAt || Date.now()).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-300 rounded-md p-3 shadow-xs no-print">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Engine</span>
            </button>
          )}
          <span className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wide flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-[#1e3a8a]" />
            Official Form-G Gate Pass & Challan Document Preview
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            type="button"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#1e3a8a] hover:bg-blue-800 text-white text-xs font-bold transition-colors shadow-sm"
          >
            <Printer className="h-4 w-4" />
            <span>Print Official Form-G Challan</span>
          </button>
        </div>
      </div>

      {/* Official Printed Gate Pass / Challan Document (Form-G) */}
      <div className="print-challan-container bg-white border-2 border-slate-800 rounded-lg p-6 sm:p-8 max-w-4xl mx-auto shadow-md text-slate-900 font-sans relative">
        {/* Subtle Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none">
          <div className="text-8xl font-black font-serif text-slate-900 text-center uppercase tracking-widest rotate-[-25deg]">
            GOVERNMENT OF UTTAR PRADESH • FOOD & CIVIL SUPPLIES
          </div>
        </div>

        {/* Official Header */}
        <div className="border-b-2 border-slate-900 pb-4 text-center space-y-1 relative">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 mb-1">
            <span>DEPARTMENT OF FOOD & CIVIL SUPPLIES, UP</span>
            <span className="font-bold text-[#b91c1c]">FORM-G (e-PDS RULE 14-B)</span>
          </div>

          <h2 className="text-lg sm:text-xl font-extrabold uppercase tracking-tight text-[#1e3a8a] font-serif">
            उत्तर प्रदेश सरकार — खाद्य तथा रसद विभाग
          </h2>
          <h3 className="text-sm sm:text-base font-bold text-slate-800 uppercase tracking-wide">
            OFFICIAL PDS COMMODITY DELIVERY CHALLAN & GODOWN GATE PASS
          </h3>
          <p className="text-xs text-slate-600 font-medium">
            Surajpur Central Godown • Depot Code: DEP-UP-GBN-04 • Greater Noida (Gautam Buddha Nagar)
          </p>
        </div>

        {/* Challan Meta Details Table */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-b border-slate-300 text-xs">
          {/* Left Column: Challan & Depot info */}
          <div className="space-y-1.5 bg-slate-50 p-3 rounded border border-slate-200">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Challan / Gate Pass No:</span>
              <span className="font-mono font-bold text-slate-900">{activeData.challanId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Dispatched Date & Time:</span>
              <span className="font-mono text-slate-800">{dispatchDate} at {dispatchTime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Issuing Depot:</span>
              <span className="font-semibold text-slate-900">Surajpur Central Buffer Godown</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Weighbridge Slip Ref:</span>
              <span className="font-mono text-slate-800">WB-GBN-2026-9041</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Vehicle / Truck No:</span>
              <span className="font-mono font-bold text-slate-900">UP-16-BT-9421 (GPS Tracked)</span>
            </div>
          </div>

          {/* Right Column: Destination Fair Price Shop (FPS) */}
          <div className="space-y-1.5 bg-slate-50 p-3 rounded border border-slate-200">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">FPS Dealer Name:</span>
              <span className="font-bold text-slate-900">{activeData.fps.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">FPS License Code:</span>
              <span className="font-mono font-bold text-blue-900">{activeData.fps.licenseNo || activeData.fps.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Ward / Sector / Village:</span>
              <span className="text-slate-800 font-medium">{activeData.fps.sector}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Target Allocation Month:</span>
              <span className="font-semibold text-slate-900">OCTOBER 2026 (NFSA Quota)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">FIFO Compliance Status:</span>
              <span className={`font-mono font-bold px-1.5 py-0.2 rounded text-[10px] ${
                activeData.isManualOverride
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}>
                {activeData.isManualOverride ? 'APPROVED EXCEPTION OVERRIDE' : 'VERIFIED 100% FIFO COMPLIANT'}
              </span>
            </div>
          </div>
        </div>

        {/* Commodity Summary Bar */}
        <div className="my-3 p-2.5 bg-blue-50 border border-blue-200 rounded flex flex-wrap items-center justify-between text-xs font-semibold text-blue-950">
          <div>
            <span>Commodity: </span>
            <strong className="text-blue-900 text-sm">{activeData.commodity}</strong>
          </div>
          <div>
            <span>Total Weight: </span>
            <strong className="text-blue-900 text-sm font-mono">{activeData.requestedQty} Quintals</strong>
          </div>
          <div>
            <span>Approximate Standard Bag Count: </span>
            <strong className="text-blue-900 text-sm font-mono">{totalBags} Bags (50 Kg each)</strong>
          </div>
        </div>

        {/* Multi-Batch Split Allocation Table */}
        <div className="my-4">
          <div className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center justify-between">
            <span>Batch-Level Allocation & Age Verification Details (बैच आवंटन विवरण)</span>
            <span className="text-[11px] font-mono text-slate-500 font-normal">
              {activeData.allocations?.length || 0} Batches Multi-Split
            </span>
          </div>

          <table className="w-full text-left text-xs border border-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                <th className="py-2 px-2.5 border-r border-slate-300 w-10 text-center">S.No.</th>
                <th className="py-2 px-3 border-r border-slate-300">Batch ID</th>
                <th className="py-2 px-2.5 border-r border-slate-300 text-center">Bay No.</th>
                <th className="py-2 px-3 border-r border-slate-300">Supplier Depot</th>
                <th className="py-2 px-2.5 border-r border-slate-300 text-center">Receipt Date</th>
                <th className="py-2 px-2.5 border-r border-slate-300 text-center">Stock Age</th>
                <th className="py-2 px-3 border-r border-slate-300 text-right">Dispatched Qtl</th>
                <th className="py-2 px-3 text-right">Balance Kept</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {activeData.allocations && activeData.allocations.map((alloc, idx) => (
                <tr key={alloc.batchId} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                  <td className="py-2 px-2.5 border-r border-slate-300 text-center font-mono text-slate-600 font-medium">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3 border-r border-slate-300 font-mono font-bold text-slate-900">
                    {alloc.batchId}
                  </td>
                  <td className="py-2 px-2.5 border-r border-slate-300 text-center font-mono font-bold text-amber-800">
                    {alloc.bay}
                  </td>
                  <td className="py-2 px-3 border-r border-slate-300 text-slate-700">
                    {alloc.supplier}
                  </td>
                  <td className="py-2 px-2.5 border-r border-slate-300 text-center font-mono text-slate-700">
                    {alloc.receiptDate}
                  </td>
                  <td className="py-2 px-2.5 border-r border-slate-300 text-center font-mono">
                    <span className="font-bold text-slate-900">{alloc.ageDays}</span> days
                  </td>
                  <td className="py-2 px-3 border-r border-slate-300 text-right font-mono font-bold text-emerald-800">
                    {round2(alloc.take)} Qtl
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-slate-600">
                    {round2(alloc.remainingAfter)} Qtl
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-900">
                <td colSpan={6} className="py-2 px-3 border-r border-slate-300 text-right uppercase">
                  Total Dispatched Quantity:
                </td>
                <td className="py-2 px-3 border-r border-slate-300 text-right font-mono text-sm text-[#1e3a8a]">
                  {activeData.requestedQty} Qtl
                </td>
                <td className="py-2 px-3 text-right font-mono text-slate-600">
                  {totalBags} Bags
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Exception Reason Callout if Override */}
        {activeData.isManualOverride && (
          <div className="p-3 my-3 bg-amber-50 border border-amber-300 rounded text-xs text-amber-950 space-y-1">
            <div className="font-bold uppercase tracking-wide text-amber-900">
              Statutory Override Exemption Notice:
            </div>
            <div>
              <strong>Authorized Reason:</strong> {activeData.exceptionReason || 'Physical obstruction / quality clearance'}
            </div>
            <div>
              <strong>Approved By Gazetted Officer:</strong> {activeData.approvedBy || 'Dy. Director, Food & Civil Supplies'}
            </div>
          </div>
        )}

        {/* Bottom Verification Section: QR Code + Digital Signature Stamp */}
        <div className="pt-4 border-t-2 border-slate-900 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          {/* Left: Verification QR Code & Hash */}
          <div className="flex items-center gap-3">
            {/* High fidelity SVG QR Code Representation */}
            <div className="h-20 w-20 bg-white border border-slate-400 p-1 rounded shadow-xs flex-shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="h-full w-full">
                {/* QR Position Squares */}
                <rect x="5" y="5" width="25" height="25" fill="#000" />
                <rect x="10" y="10" width="15" height="15" fill="#fff" />
                <rect x="13" y="13" width="9" height="9" fill="#000" />

                <rect x="70" y="5" width="25" height="25" fill="#000" />
                <rect x="75" y="10" width="15" height="15" fill="#fff" />
                <rect x="78" y="13" width="9" height="9" fill="#000" />

                <rect x="5" y="70" width="25" height="25" fill="#000" />
                <rect x="10" y="75" width="15" height="15" fill="#fff" />
                <rect x="13" y="78" width="9" height="9" fill="#000" />

                {/* QR Pattern dots */}
                <rect x="35" y="10" width="6" height="6" fill="#000" />
                <rect x="45" y="15" width="6" height="6" fill="#000" />
                <rect x="55" y="8" width="6" height="6" fill="#000" />
                <rect x="35" y="35" width="8" height="8" fill="#000" />
                <rect x="50" y="35" width="6" height="6" fill="#000" />
                <rect x="65" y="40" width="6" height="6" fill="#000" />
                <rect x="40" y="55" width="7" height="7" fill="#000" />
                <rect x="55" y="60" width="8" height="8" fill="#000" />
                <rect x="75" y="75" width="15" height="15" fill="#000" />
                <rect x="80" y="80" width="5" height="5" fill="#fff" />
              </svg>
            </div>

            <div className="text-[10px] space-y-0.5 text-slate-600 font-mono">
              <div className="font-bold text-slate-800 uppercase">iPDS e-PRAMAAN QR CODE</div>
              <div>Scan for Live Annavitran Gate Outward verification</div>
              <div className="truncate max-w-[200px] text-slate-400">
                SHA: 0x7e4b9...82f1d
              </div>
              <div className="text-emerald-700 font-semibold">Security Token: NIC-SEC-2026-UP</div>
            </div>
          </div>

          {/* Right: Digital Signature Stamp Box */}
          <div className="border-2 border-dashed border-[#15803d] bg-emerald-50/60 p-3 rounded-lg text-xs space-y-1 relative">
            <div className="flex items-center gap-1.5 text-emerald-800 font-bold uppercase text-[11px] tracking-wide">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              <span>Digitally Signed via e-Pramaan</span>
            </div>
            <div className="text-slate-800 font-semibold">
              Shri S. P. Verma (AGM / Godown In-Charge)
            </div>
            <div className="text-[10px] text-slate-600 font-mono">
              Depot: Surajpur Central Buffer Depot (GBN)
            </div>
            <div className="text-[10px] text-slate-600 font-mono">
              DSC Ref: DSC-NIC-UP-94827 | Authenticated
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Signed: {dispatchDate} {dispatchTime} IST
            </div>
          </div>
        </div>

        {/* Footer Mandatory Text */}
        <div className="mt-5 pt-3 border-t border-slate-300 text-[10px] text-slate-500 text-center font-mono">
          This is an official system-generated ePDS Delivery Challan & Gate Pass valid under Section 3 of Essential Commodities Act. Transporter must carry this copy during transit to Fair Price Shop.
        </div>
      </div>
    </div>
  );
});

