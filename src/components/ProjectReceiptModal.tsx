import React, { useRef, useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { X, Download, Share2, Zap, Crown } from 'lucide-react';
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
  const [isGenerating, setIsGenerating] = useState(false);

  // ESC key handler to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(element, { 
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#1a1818',
        width: element.offsetWidth,
        height: element.offsetHeight
      });
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [400, 600] });
      pdf.addImage(imgData, 'PNG', 0, 0, 400, 600);
      pdf.save(`project-receipt-${project.id}.pdf`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async () => {
    const element = receiptRef.current;
    if (!element) return;
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(element, { 
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#1a1818',
        width: element.offsetWidth,
        height: element.offsetHeight
      });
      const imgData = canvas.toDataURL('image/png', 1.0);
      const blob = await (await fetch(imgData)).blob();
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
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div className="bg-transparent rounded-2xl p-0 max-w-xs w-full mx-4 shadow-2xl animate-scaleIn relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-2 rounded-full bg-[#E16428]/10 text-[#E16428] hover:bg-[#E16428]/20 transition"
        >
          <X className="w-5 h-5" />
        </button>
        {/* Receipt content */}
        <div ref={receiptRef} className={`bg-[#1a1818] shadow-lg overflow-hidden font-['Inter'] min-h-[400px] ${isGenerating ? '' : 'rounded-2xl'}`}>
          {/* Logo and header */}
          <div className="flex items-center justify-between pt-6 pb-2 px-6">
            <img src="/2OGOlogo.png" alt="OGO Technology" className="w-16 h-16 flex-shrink-0" />
            <div className="flex flex-col items-end text-right">
              <div className="text-xs font-bold text-[#F6E9E9] mb-1 font-['Poppins'] tracking-tight">ogo Assignment</div>
              <div className="text-[9px] text-[#E16428] font-bold tracking-widest uppercase mb-1">Department of Academic</div>
              <div className="text-[9px] text-[#F6E9E9]/80 mb-1 font-semibold">in ogo technology</div>
              <div className="text-[9px] text-[#F6E9E9]/70">+94 75 930 7059</div>
            </div>
          </div>
          {/* Horizontal divider */}
          <div className="border-t border-[#E16428]/20 mx-6"></div>
          {/* Details section */}
          <div className="px-6 pb-2">
            <div>
              <div className="flex justify-between py-1.5">
                <span className="text-[10px] text-[#F6E9E9]/80 font-medium">Project ID</span>
                <span className="text-[10px] text-[#F6E9E9] font-semibold text-right">{project.projectId}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[10px] text-[#F6E9E9]/80 font-medium">Client</span>
                <span className="text-[10px] text-[#F6E9E9] font-semibold text-right">{project.clientName}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[10px] text-[#F6E9E9]/80 font-medium">University/Org</span>
                <span className="text-[10px] text-[#F6E9E9] text-right">{project.clientUniOrg}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[10px] text-[#F6E9E9]/80 font-medium">Project Types</span>
                <span className="text-[10px] text-[#F6E9E9] text-right">{getProjectTypeNames(project.projectDescription)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[10px] text-[#F6E9E9]/80 font-medium">Deadline</span>
                <span className="text-[10px] text-[#F6E9E9] text-right">{new Date(project.deadlineDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[10px] text-[#F6E9E9]/80 font-medium">Price</span>
                <span className="text-[10px] text-[#F6E9E9] font-bold text-right">LKR {project.price.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[10px] text-[#F6E9E9]/80 font-medium">Advance</span>
                <span className="text-[10px] text-green-400 font-bold text-right">LKR {project.advance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[10px] text-[#F6E9E9]/80 font-medium">Balance</span>
                <span className="text-[10px] text-red-400 font-bold text-right">LKR {(project.price - project.advance).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[10px] text-[#F6E9E9]/80 font-medium">Status</span>
                <span className="text-[10px] text-[#F6E9E9] text-right capitalize">{project.status}</span>
              </div>
              {project.fastDeliver && (
                <div className="flex justify-between py-1.5">
                  <span className="text-[10px] text-[#F6E9E9]/80 font-medium">Fast Deliver</span>
                  <span className="text-[10px] text-[#F6E9E9] text-right">
                    <span className="flex items-center justify-end">
                      <Crown className="w-4 h-4 text-yellow-500 font-bold" strokeWidth={2.5} />
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>
          {/* Footer */}
          <div className={`flex justify-between items-center px-6 py-3 border-t border-[#E16428]/10 bg-[#272121] ${isGenerating ? '' : 'rounded-b-2xl'}`}>
            <span className="text-[10px] text-[#F6E9E9]/50">Generated on: {new Date().toLocaleDateString()}</span>
            <span className="text-[10px] text-[#E16428] font-bold">ogo technology</span>
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