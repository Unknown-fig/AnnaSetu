import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { BAYS, calculateAgeDays } from '../../types/models';
import { generateQrDataUrl, computeChallanHash } from '../../services/challanService';
import {
  Printer,
  ArrowLeft,
  Landmark,
  Building2,
  Warehouse,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Languages,
  CheckSquare,
  Copy,
  Check
} from 'lucide-react';

export const PrintableChallan = React.memo(function PrintableChallan({
  challan,
  onBack,
  prevHash = '0000000000000000000000000000000000000000000000000000000000000000',
}) {
  const { isHindi, tCommodity } = useI18n();
  const [printBilingual, setPrintBilingual] = useState(false);
  const [mainQrUrl, setMainQrUrl] = useState('');
  const [lineQrUrls, setLineQrUrls] = useState({});
  const [challanHash, setChallanHash] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);

  // Compute canonical hash and QR codes
  useEffect(() => {
    if (!challan) return;

    async function generateQrs() {
      // 1. Compute canonical hash
      const hash = await computeChallanHash(challan, prevHash);
      setChallanHash(hash);

      // 2. Main Challan QR payload
      const mainPayload = {
        challanNo: challan.challanNo,
        fps: challan.fps?.id || 'FPS-GN-101',
        commodity: challan.commodity,
        qty: challan.requestedQty,
        lines: (challan.allocations || []).map(a => ({
          batchId: a.batchId,
          bay: a.bay,
          qty: a.take,
        })),
        issuedAt: challan.stagedAt || challan.issuedAt,
        hash,
      };

      const mainUrl = await generateQrDataUrl(mainPayload);
      setMainQrUrl(mainUrl);

      // 3. Per-line QRs
      const lineMap = {};
      for (let i = 0; i < (challan.allocations || []).length; i++) {
        const a = challan.allocations[i];
        const linePayload = {
          challanNo: challan.challanNo,
          lineNo: i + 1,
          batchId: a.batchId,
          bay: a.bay,
          qty: a.take,
        };
        lineMap[a.batchId] = await generateQrDataUrl(linePayload);
      }
      setLineQrUrls(lineMap);
    }

    generateQrs();
  }, [challan, prevHash]);

  const handlePrint = () => {
    window.print();
  };

  if (!challan) {
    return (
      <div className="p-8 text-center text-slate-500 font-mono">
        No active challan found. Please stage a challan first.
      </div>
    );
  }

  const isBilingual = printBilingual;
  const isHi = isHindi || isBilingual;
  const isEn = !isHindi || isBilingual;

  const allocations = challan.allocations || [];
  const pickBaysSet = new Set(allocations.map(a => a.bay));

  return (
    <div className="space-y-4">
      {/* Print Control Toolbar (Hidden in print) */}
      <div className="p-4 bg-white border border-slate-300 rounded-lg flex flex-wrap items-center justify-between gap-3 shadow-xs no-print">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Challan Engine</span>
          </button>
          <span className="text-xs font-mono font-bold text-slate-700">
            Preview: {challan.challanNo}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={printBilingual}
              onChange={(e) => setPrintBilingual(e.target.checked)}
              className="rounded text-[#0B2A5B] focus:ring-[#0B2A5B]"
            />
            <Languages className="h-3.5 w-3.5 text-blue-700" />
            <span>Print Bilingual (English + हिन्दी)</span>
          </label>

          <button
            id="btn-trigger-print"
            type="button"
            onClick={handlePrint}
            className="px-5 py-2 rounded-lg bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
          >
            <Printer className="h-4 w-4" />
            <span>Print Document (A4)</span>
          </button>
        </div>
      </div>

      {/* PRINT CONTAINER (A4 Styled) */}
      <div className="bg-white border border-slate-300 rounded-lg p-6 sm:p-10 shadow-md text-slate-900 font-sans max-w-[850px] mx-auto print:border-none print:shadow-none print:p-0 print:max-w-full">
        {/* ================= PAGE 1: DELIVERY CHALLAN ================= */}
        <div className="space-y-6 page-break-after">
          {/* Government Header */}
          <div className="border-b-2 border-slate-800 pb-4 text-center relative">
            <div className="absolute top-0 right-0 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300">
              PROTOTYPE - DEMO DATA
            </div>

            <div className="flex justify-center mb-1.5">
              <div className="h-10 w-10 rounded-full border border-slate-400 flex items-center justify-center text-[#0B2A5B]">
                <Landmark className="h-6 w-6" />
              </div>
            </div>

            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Department of Food & Civil Supplies, Government of Uttar Pradesh
            </h2>
            {isHi && (
              <h3 className="text-xs font-semibold text-slate-600">
                खाद्य एवं रसद विभाग, उत्तर प्रदेश सरकार
              </h3>
            )}

            <div className="text-lg font-black tracking-tight text-[#0B2A5B] mt-1 uppercase">
              Official PDS Delivery Challan & Gate Pass (प्रपत्र-जी)
            </div>
            <div className="text-[11px] font-mono text-slate-600">
              Surajpur Central iPDS Godown, Gautam Buddha Nagar • Depot Code: DEP-UP-GBN-04
            </div>
          </div>

          {/* Challan Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs font-mono border border-slate-300 p-3 rounded-md bg-slate-50/50">
            <div className="space-y-1">
              <div>
                <span className="text-slate-500">Challan Number: </span>
                <strong className="text-slate-900 text-sm">{challan.challanNo}</strong>
              </div>
              <div>
                <span className="text-slate-500">Issue Date/Time: </span>
                <span>{new Date(challan.stagedAt || Date.now()).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500">Dispatching Godown: </span>
                <span>Surajpur Central Depot (Gautam Buddha Nagar)</span>
              </div>
              <div>
                <span className="text-slate-500">FIFO Status: </span>
                <strong className={`px-1.5 py-0.2 rounded text-[11px] ${challan.isManualOverride
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}>
                  {challan.isManualOverride ? 'EXCEPTION APPROVED' : 'FIFO COMPLIANT'}
                </strong>
              </div>
            </div>

            <div className="space-y-1 text-right sm:text-left">
              <div>
                <span className="text-slate-500">Fair Price Shop (FPS): </span>
                <strong className="text-slate-900">{challan.fps?.name}</strong>
              </div>
              <div>
                <span className="text-slate-500">FPS Dealer ID: </span>
                <span>{challan.fps?.id} ({challan.fps?.licenseNo})</span>
              </div>
              <div>
                <span className="text-slate-500">Commodity: </span>
                <strong>{challan.commodity} {isHi ? `(${tCommodity(challan.commodity)})` : ''}</strong>
              </div>
              <div>
                <span className="text-slate-500">Total Quantity: </span>
                <strong className="text-sm text-[#0B2A5B]">{challan.requestedQty} Quintals (Qtl)</strong>
              </div>
            </div>
          </div>

          {/* Exception Details if approved */}
          {challan.isManualOverride && (
            <div className="p-2.5 bg-amber-50 border border-amber-300 rounded text-xs space-y-0.5">
              <div className="font-bold text-amber-950 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                <span>Statutory Exception Authorization (वैधानिक अपवाद अनुमोदन)</span>
              </div>
              <div className="text-[11px] text-slate-700">
                Reason: <strong>{challan.exceptionReason || 'Moisture/Quality Spoilage Risk (Early Clearance)'}</strong>
                {' • '}Authorized by: <strong>Godown Supervisor & DSO</strong>
              </div>
            </div>
          )}

          {/* Allocation Table */}
          <div className="border border-slate-300 rounded-md overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 text-[11px] font-bold border-b border-slate-300 uppercase">
                  <th className="py-2 px-3 border-r border-slate-200">#</th>
                  <th className="py-2 px-3 border-r border-slate-200">Batch ID</th>
                  <th className="py-2 px-3 border-r border-slate-200">Supplier / Agency</th>
                  <th className="py-2 px-3 border-r border-slate-200 text-center">Receipt Date</th>
                  <th className="py-2 px-3 border-r border-slate-200 text-center">Age (Days)</th>
                  <th className="py-2 px-3 border-r border-slate-200 text-center">Bay</th>
                  <th className="py-2 px-3 text-right">Dispatched Qtl</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                {allocations.map((a, idx) => (
                  <tr key={a.batchId}>
                    <td className="py-2 px-3 border-r border-slate-200 font-bold">{idx + 1}</td>
                    <td className="py-2 px-3 border-r border-slate-200 font-bold text-slate-900">#{a.batchId}</td>
                    <td className="py-2 px-3 border-r border-slate-200 font-sans">{a.supplier}</td>
                    <td className="py-2 px-3 border-r border-slate-200 text-center">{a.receiptDate}</td>
                    <td className="py-2 px-3 border-r border-slate-200 text-center font-bold text-amber-900">{a.ageDays}d</td>
                    <td className="py-2 px-3 border-r border-slate-200 text-center font-bold text-[#0B2A5B]">Bay {a.bay}</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">{a.take} Qtl</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold text-slate-900 border-t-2 border-slate-400">
                  <td colSpan={6} className="py-2 px-3 text-right font-sans uppercase">Total Dispatched:</td>
                  <td className="py-2 px-3 text-right text-sm text-[#0B2A5B]">{challan.requestedQty} Qtl</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* QR Code & Hash Signature Section */}
          <div className="flex items-center justify-between border border-slate-300 p-3 rounded-md bg-white">
            <div className="flex items-center gap-3">
              {mainQrUrl ? (
                <img src={mainQrUrl} alt="Challan QR" className="h-24 w-24 border border-slate-200 rounded" />
              ) : (
                <div className="h-24 w-24 bg-slate-100 flex items-center justify-center text-slate-400 text-[10px]">
                  Loading QR...
                </div>
              )}
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-[#0B2A5B]">
                  Official ePDS Cryptographic QR Pass
                </div>
                <div className="text-[10px] font-mono text-slate-600">
                  Challan Hash: <strong>{challanHash.slice(0, 12)}...</strong>
                </div>
                <div className="text-[10px] font-mono text-[#0B2A5B] flex items-center gap-1.5">
                  <span>Offline Token:</span>
                  <strong>{challan.offlineToken ? challan.offlineToken.substring(0, 16).toUpperCase() : (challan.hash || '').substring(0, 16).toUpperCase()}</strong>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(challan.offlineToken || challan.hash || '');
                      setCopiedToken(true);
                      setTimeout(() => setCopiedToken(false), 2000);
                    }}
                    className="no-print text-slate-500 hover:text-slate-800 ml-1 inline-flex items-center gap-0.5"
                    title="Copy full token"
                  >
                    {copiedToken ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    <span className="text-[9px] underline">Copy full token</span>
                  </button>
                </div>
                <div className="text-[9px] text-slate-500 font-sans max-w-[340px]">
                  Scannable by UP FCS inspector handsets and FPS verification terminals. Cryptographically chained to previous godown ledger entry.
                </div>
              </div>
            </div>

            <div className="text-[10px] font-mono text-slate-400 text-right">
              Page 1 of 2 (Challan)
            </div>
          </div>

          {/* Signature Blocks */}
          <div className="grid grid-cols-3 gap-6 pt-10 text-center text-xs">
            <div className="border-t border-slate-400 pt-2">
              <div className="font-bold text-slate-800">Storekeeper / Dispatch In-Charge</div>
              <div className="text-[10px] text-slate-500 font-hindi">गोदाम प्रभारी हस्ताक्षर</div>
            </div>
            <div className="border-t border-slate-400 pt-2">
              <div className="font-bold text-slate-800">Authorized Driver / Transporter</div>
              <div className="text-[10px] text-slate-500 font-hindi">वाहन चालक हस्ताक्षर</div>
            </div>
            <div className="border-t border-slate-400 pt-2">
              <div className="font-bold text-slate-800">FPS Dealer / Receiver</div>
              <div className="text-[10px] text-slate-500 font-hindi">कोटेदार / प्राप्तकर्ता हस्ताक्षर</div>
            </div>
          </div>
        </div>

        {/* Page Break for Print */}
        <div className="my-8 border-b-4 border-dashed border-slate-300 no-print" />

        {/* ================= PAGE 2: GUIDED BAY PICKING SLIP ================= */}
        <div className="space-y-6 pt-4">
          <div className="border-b-2 border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold uppercase tracking-tight text-[#0B2A5B]">
                Guided Bay Picking Slip & Loading Directive
              </h3>
              <div className="text-xs font-semibold text-slate-600">
                निर्देशित बे पिकिंग पर्ची • Surajpur Central Godown (Surajpur-GBN)
              </div>
            </div>
            <div className="text-right font-mono text-xs">
              <div>Challan: <strong>{challan.challanNo}</strong></div>
              <div className="text-slate-500 text-[10px]">Page 2 of 2</div>
            </div>
          </div>

          {/* Ordered Pick List with Tick-Boxes */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Warehouse className="h-4 w-4 text-amber-600" />
              <span>Ordered Picking Sequence (FIFO Priority)</span>
            </h4>

            <div className="space-y-2">
              {allocations.map((a, idx) => {
                const isBackLayer = a.bay === 'B2' && a.batchId === 'RC-102'; // seeded stacked older batch
                return (
                  <div
                    key={a.batchId}
                    className="p-3 rounded-lg border border-slate-300 bg-slate-50 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-6 w-6 border-2 border-slate-400 rounded flex items-center justify-center font-bold text-slate-400">
                        {/* Empty box for manual worker pen tick */}
                        <div className="h-3 w-3 border border-slate-300" />
                      </div>

                      <div className="space-y-0.5">
                        <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-950 font-mono text-xs">
                            Step #{idx + 1}
                          </span>
                          <span>Go to <strong>Bay {a.bay}</strong> ➜ Pick <strong>{a.take} Qtl</strong> from Batch <strong>#{a.batchId}</strong></span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-600">
                          Stock Age: {a.ageDays} days old • Remaining after pick: {a.remainingAfter} Qtl
                        </div>
                        {isBackLayer && (
                          <div className="text-[10px] font-bold text-red-700 flex items-center gap-1 bg-amber-100 p-1 rounded border border-amber-300">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Stack Warning: Older stock at back — clear front bags first (पुराना स्टॉक पीछे है)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Small Line QR Code */}
                    {lineQrUrls[a.batchId] && (
                      <div className="flex-shrink-0 text-center">
                        <img src={lineQrUrls[a.batchId]} alt="Line QR" className="h-14 w-14 border border-slate-300 rounded" />
                        <span className="text-[9px] font-mono text-slate-500 block">#{a.batchId}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mini Bay Map Highlighting Pick Bays */}
          <div className="p-4 bg-slate-100 border border-slate-300 rounded-lg space-y-2">
            <div className="text-xs font-bold text-[#0B2A5B] uppercase tracking-wider flex items-center justify-between">
              <span>Godown Floorplan — Pick Bay Allocation Map</span>
              <span className="font-normal text-[10px] text-slate-500 font-mono">
                Highlighted bays indicate target pick sequence
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-1">
              {BAYS.map((bayId) => {
                const isPick = pickBaysSet.has(bayId);
                const pickIndex = allocations.findIndex(a => a.bay === bayId);

                return (
                  <div
                    key={bayId}
                    className={`py-2 px-1 text-center font-mono rounded border text-xs font-bold transition-all ${isPick
                        ? 'bg-amber-400 text-slate-950 border-amber-600 ring-2 ring-amber-500 font-black shadow-xs'
                        : 'bg-white text-slate-400 border-slate-200'
                      }`}
                  >
                    <div>{bayId}</div>
                    {isPick && (
                      <div className="text-[9px] bg-slate-950 text-white rounded px-1 mt-0.5">
                        PICK #{pickIndex + 1}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Worker Verification Sign-Off */}
          <div className="grid grid-cols-2 gap-6 pt-6 text-center text-xs">
            <div className="border-t border-slate-400 pt-2">
              <div className="font-bold text-slate-800">Forklift / Handset Loader Operator</div>
              <div className="text-[10px] text-slate-500">I certify stock was picked in strict numbered FIFO order.</div>
            </div>
            <div className="border-t border-slate-400 pt-2">
              <div className="font-bold text-slate-800">Security Gate Outward Sentry</div>
              <div className="text-[10px] text-slate-500">I verify truck loading matches Challan quantities.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
