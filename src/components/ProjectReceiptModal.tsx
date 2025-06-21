import React, { useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { X, Download, Share2, Zap } from 'lucide-react';
import { Project } from '../types';

interface ProjectType {
  id: string;
  name: string;
}

interface ProjectReceiptModalProps {
  project: Project;
  projectTypes: ProjectType[];
  onClose: () => void;
}

export const ProjectReceiptModal: React.FC<ProjectReceiptModalProps> = ({ project, projectTypes, onClose }) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const getProjectTypeNames = (projectDescription: string) => {
    if (!projectDescription) return 'No types specified';
    const typeIds = projectDescription.split(',').map((id: string) => id.trim());
    const typeNames = typeIds.map((id: string) => {
      const type = projectTypes.find((t: ProjectType) => t.id === id);
      return type ? type.name : `Unknown Type (${id})`;
    });
    return typeNames.join(', ');
  };

  const handleDownload = async () => {
    const element = receiptRef.current;
    if (!element) return;
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [400, 600] });
    pdf.addImage(imgData, 'PNG', 0, 0, 400, 600);
    pdf.save(`project-receipt-${project.id}.pdf`);
  };

  const handleShare = async () => {
    const element = receiptRef.current;
    if (!element) return;
    const canvas = await html2canvas(element, { scale: 2 });
    const blob = await (await fetch(canvas.toDataURL('image/png'))).blob();
    if ((navigator as any).share) {
      const file = new File([blob], `project-receipt-${project.id}.png`, { type: 'image/png' });
      (navigator as any).share({
        title: 'Project Receipt',
        text: 'Here is your project receipt!',
        files: [file],
      });
    } else {
      // fallback: download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-receipt-${project.id}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-transparent rounded-2xl p-0 max-w-sm w-full mx-4 shadow-2xl animate-scaleIn relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-2 rounded-full bg-[#E16428]/10 text-[#E16428] hover:bg-[#E16428]/20 transition"
        >
          <X className="w-5 h-5" />
        </button>
        {/* Receipt content */}
        <div ref={receiptRef} className="bg-white rounded-2xl shadow-lg overflow-hidden font-['Inter']">
          {/* Accent bar */}
          <div className="h-3 w-full bg-gradient-to-r from-[#E16428] to-[#ffb86b]"></div>
          {/* Logo and header */}
          <div className="flex flex-col items-center pt-6 pb-2 px-6">
            <img src="/Logo.jpg" alt="OGO Technology" className="w-20 h-20 rounded-full mb-2 shadow-lg border-4 border-white bg-white" />
            <div className="text-base sm:text-lg font-bold text-[#363333] mb-1 font-['Poppins'] tracking-tight">Project Receipt</div>
            <div className="text-xs text-[#E16428] font-bold tracking-widest uppercase mb-1">ogo technology</div>
            <div className="text-xs text-[#363333]/80 mb-2 font-semibold">Department of OGO Assignment</div>
          </div>
          {/* Details section */}
          <div className="px-6 pb-2">
            <div className="divide-y divide-[#E16428]/10">
              <div className="flex justify-between py-2">
                <span className="text-xs text-[#363333]/80 font-medium">Client</span>
                <span className="text-xs text-[#363333] font-semibold text-right">{project.clientName}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-xs text-[#363333]/80 font-medium">University/Org</span>
                <span className="text-xs text-[#363333] text-right">{project.clientUniOrg}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-xs text-[#363333]/80 font-medium">Project Types</span>
                <span className="text-xs text-[#363333] text-right">{getProjectTypeNames(project.projectDescription)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-xs text-[#363333]/80 font-medium">Deadline</span>
                <span className="text-xs text-[#363333] text-right">{new Date(project.deadlineDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-xs text-[#363333]/80 font-medium">Price</span>
                <span className="text-xs text-black font-bold text-right">LKR {project.price.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-xs text-[#363333]/80 font-medium">Advance</span>
                <span className="text-xs text-green-600 font-bold text-right">LKR {project.advance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-xs text-[#363333]/80 font-medium">Balance</span>
                <span className="text-xs text-red-600 font-bold text-right">LKR {(project.price - project.advance).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 items-center">
                <span className="text-xs text-[#363333]/80 font-medium">Status</span>
                <span className="text-xs text-[#363333] text-right capitalize">{project.status}</span>
              </div>
              {project.fastDeliver && (
                <div className="flex justify-end py-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#E16428]/20 text-[#E16428] border border-[#E16428]/30">
                    <Zap className="w-3 h-3 mr-1" /> fast delivery
                  </span>
                </div>
              )}
            </div>
          </div>
          {/* Footer */}
          <div className="flex justify-between items-center px-6 py-3 border-t border-[#E16428]/10 bg-[#f6e9e9] rounded-b-2xl">
            <span className="text-[10px] text-[#363333]/50">Generated on: {new Date().toLocaleDateString()}</span>
            <span className="text-[10px] text-[#E16428] font-bold">ogo.technology</span>
          </div>
        </div>
        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-3 p-4 bg-transparent mt-2">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#E16428] text-white rounded-lg shadow hover:bg-[#e16428]/90 transition text-xs font-bold"
          >
            <Download className="w-4 h-4" /> Download
          </button>
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#363333] text-white rounded-lg shadow hover:bg-[#272121] transition text-xs font-bold"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
      </div>
    </div>
  );
}; 