import React from 'react';
import { ShieldCheck, ExternalLink, Building2 } from 'lucide-react';

export const Footer = React.memo(function Footer() {
  return (
    <footer id="nic-footer" className="bg-[#0f172a] text-slate-300 text-xs border-t border-slate-800 select-none no-print">
      {/* Tricolor Accent Line */}
      <div className="h-1 w-full grid grid-cols-3">
        <div className="bg-[#ff9933]"></div>
        <div className="bg-[#ffffff]"></div>
        <div className="bg-[#138808]"></div>
      </div>

      <div className="max-w-[1920px] mx-auto px-4 py-6 space-y-5">
        {/* Top Link Grid */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="font-bold text-white text-sm tracking-wide">
                ANNA-SETU | e-PDS Smart Godown Portal
              </span>
              <span className="text-[11px] text-slate-400">
                Department of Food & Public Distribution, Government of India
              </span>
            </div>
          </div>

          {/* Quick Gov Portals Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-mono">
              UX4G MeitY Compliant
            </span>
            <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-mono">
              NFSA Integrated (nfsa.gov.in)
            </span>
            <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-mono">
              Annavitran v4.2 (annavitran.nic.in)
            </span>
          </div>
        </div>

        {/* Official Statutory Footer Mandate */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left text-slate-400 text-[11px] leading-relaxed">
          <div>
            <p className="font-medium text-slate-300">
              Content Owned by Department of Food & Public Distribution | Integrated with NIC e-PDS & Annavitran Workflow | Last Updated: Oct 2026
            </p>
            <p className="text-slate-400 mt-0.5">
              Designed, Developed and Hosted by <strong>National Informatics Centre (NIC)</strong>, Ministry of Electronics & IT (MeitY), Government of India.
            </p>
          </div>

          <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
            <span>Depot Node: <strong>DEP-UP-GBN-04</strong></span>
            <span>•</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              Secured TLS 1.3 / SHA-256
            </span>
          </div>
        </div>

        {/* Standard NIC Legal Policy Links */}
        <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
          <a href="#policies" className="hover:text-amber-400 transition-colors">Website Policies</a>
          <span>|</span>
          <a href="#terms" className="hover:text-amber-400 transition-colors">Terms & Conditions</a>
          <span>|</span>
          <a href="#privacy" className="hover:text-amber-400 transition-colors">Privacy Policy</a>
          <span>|</span>
          <a href="#hyperlink" className="hover:text-amber-400 transition-colors">Hyperlinking Policy</a>
          <span>|</span>
          <a href="#help" className="hover:text-amber-400 transition-colors">Help & Accessibility</a>
          <span>|</span>
          <a href="#grievance" className="hover:text-amber-400 transition-colors">PDS Grievance Portal (1967)</a>
        </div>
      </div>
    </footer>
  );
});

