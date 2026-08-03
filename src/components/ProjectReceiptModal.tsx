import React, { useEffect, useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import { X, Download, Share2, Crown, BadgePercent, Loader2 } from 'lucide-react';
import { Project } from '../types';
import { drawProjectReceiptCanvas } from '../utils/drawProjectReceipt';
import { fillReceiptCaption, getReceiptCaptionForStatus } from '../utils/receiptCaption';
import { whatsappMarkupToShareText } from '../utils/whatsappShareText';

interface ProjectType {
  id: string;
  name: string;
}

interface ProjectReceiptModalProps {
  project: Project;
  projectTypes: ProjectType[];
  onClose: () => void;
}

const statusValueColors: Record<string, string> = {
  Running: 'text-blue-300',
  Delivered: 'text-green-300',
  Pending: 'text-yellow-300',
  'Pending Payment': 'text-purple-300',
  Correction: 'text-orange-300',
  Rejected: 'text-red-300',
};

export const ProjectReceiptModal: React.FC<ProjectReceiptModalProps> = ({
  project,
  projectTypes,
  onClose,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingLabel, setGeneratingLabel] = useState('Preparing…');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isGenerating) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isGenerating]);

  const typeNames = useMemo(() => {
    if (!project.projectDescription) return [] as string[];
    return project.projectDescription
      .split(',')
      .map(id => id.trim())
      .filter(Boolean)
      .map(id => projectTypes.find(t => t.id === id)?.name || id);
  }, [project.projectDescription, projectTypes]);

  const hasDiscount = Boolean(project.giveDiscount && (project.discountAmount || 0) > 0);
  const discountAmount = hasDiscount ? project.discountAmount || 0 : 0;
  const netPrice = Math.max(0, project.price - discountAmount);
  const balance =
    project.balance !== undefined && project.balance !== null
      ? project.balance
      : Math.max(0, project.price - project.advance - discountAmount);
  const discountPercent =
    hasDiscount && project.price > 0
      ? Math.round((discountAmount / project.price) * 1000) / 10
      : 0;

  const buildReceiptCanvas = () =>
    drawProjectReceiptCanvas({
      projectId: project.projectId,
      clientName: project.clientName,
      clientUniOrg: project.clientUniOrg || '',
      typeNames,
      deadlineDate: project.deadlineDate,
      price: project.price,
      advance: project.advance,
      balance,
      status: project.status,
      hasDiscount,
      discountAmount,
      discountPercent,
      netPrice,
      fastDeliver: Boolean(project.fastDeliver),
    });

  const handleDownload = async () => {
    setGeneratingLabel('Preparing PDF…');
    setIsGenerating(true);
    try {
      await new Promise(r => setTimeout(r, 40));
      const canvas = await buildReceiptCanvas();
      const imgData = canvas.toDataURL('image/png');
      const aspectRatio = canvas.height / canvas.width;
      const pdfWidth = 420;
      const pdfHeight = pdfWidth * aspectRatio;
      const pdf = new jsPDF({
        orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
        unit: 'pt',
        format: [pdfWidth, pdfHeight],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(`project-receipt-${project.projectId}.pdf`);
    } catch (error) {
      console.error('Error downloading receipt:', error);
      alert('Failed to download receipt. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async () => {
    setGeneratingLabel('Preparing receipt…');
    setIsGenerating(true);
    try {
      await new Promise(r => setTimeout(r, 40));
      const canvas = await buildReceiptCanvas();

      setGeneratingLabel('Opening share…');
      // PNG keeps badge colors sharp (JPEG washed out yellow "Fast" text)
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          b => (b ? resolve(b) : reject(new Error('Failed to create image'))),
          'image/png'
        );
      });

      const formattedStatus = project.status.charAt(0).toUpperCase() + project.status.slice(1);
      const money = (n: number) => `LKR ${n.toLocaleString()}`;
      // Image captions ignore WhatsApp *bold* markers — convert to Unicode styles
      const captionText = whatsappMarkupToShareText(
        fillReceiptCaption(getReceiptCaptionForStatus(project.status), {
          projectId: project.projectId,
          status: formattedStatus,
          clientName: project.clientName || '—',
          clientUniOrg: project.clientUniOrg || '—',
          types: typeNames.length ? typeNames.join(', ') : '—',
          deadline: project.deadlineDate
            ? new Date(project.deadlineDate).toLocaleDateString()
            : '—',
          price: money(project.price),
          advance: money(project.advance),
          balance: money(balance),
          website: 'www.ogotechnology.net',
        })
      );
      const shareData: ShareData = {
        title: 'Project Receipt',
        text: captionText,
      };

      if (navigator.share) {
        try {
          const file = new File([blob], `project-receipt-${project.projectId}.png`, {
            type: 'image/png',
          });
          const fileShareData = { ...shareData, files: [file] };
          if (!navigator.canShare || navigator.canShare(fileShareData)) {
            await navigator.share(fileShareData);
            return;
          }
        } catch (shareError: any) {
          if (shareError?.name === 'AbortError') return;
        }

        try {
          await navigator.share(shareData);
          return;
        } catch (shareError: any) {
          if (shareError?.name === 'AbortError') return;
        }
      }

      // Desktop fallback: download image
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-receipt-${project.projectId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error('Error sharing receipt:', error);
      alert('Failed to share receipt. Please try downloading instead.');
    } finally {
      setIsGenerating(false);
    }
  };

  const Row = ({
    label,
    value,
    valueClass = 'text-[#F6E9E9]',
  }: {
    label: string;
    value: React.ReactNode;
    valueClass?: string;
  }) => (
    <div className="flex items-center justify-between gap-2 py-1 leading-normal">
      <span className="text-[12px] leading-normal text-[#F6E9E9]/50 shrink-0">{label}</span>
      <span className={`text-[12px] leading-normal font-semibold text-right min-w-0 ${valueClass}`}>
        {value}
      </span>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn p-3 sm:p-4"
      onClick={() => {
        if (!isGenerating) onClose();
      }}
    >
      <div
        className="w-full max-w-[320px] sm:max-w-[340px] mx-auto animate-scaleIn relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-semibold text-[#F6E9E9] font-['Poppins'] truncate">
            Receipt · {project.projectId}
          </p>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="w-8 h-8 shrink-0 rounded-full bg-[#272121] border border-[#E16428]/25 text-[#F6E9E9]/70 hover:text-[#E16428] transition-colors flex items-center justify-center disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="relative bg-[#161313] overflow-hidden font-['Inter'] shadow-xl rounded-xl ring-1 ring-[#E16428]/20">
          <div className="h-1 w-full bg-gradient-to-r from-[#E16428] via-[#f08a4b] to-[#E16428]" />

          <img
            src="/logo_ogo.png"
            alt="OGO"
            className="absolute top-3 right-3 w-14 h-14 object-contain z-10"
          />

          <div className="px-4 pt-4 pb-3.5 pr-[4.5rem]">
            <p className="text-[13px] leading-normal font-bold text-[#F6E9E9] font-['Poppins']">
              ogo Assignment
            </p>
            <p className="text-[9px] leading-normal text-[#E16428] font-bold uppercase tracking-wider mt-1">
              Department of Academic
            </p>
            <p className="text-[10px] leading-normal text-[#F6E9E9]/40 mt-1">+94 75 930 7059</p>
          </div>

          <div className="mx-4 border-t border-[#E16428]/15" />

          <div className="px-4 py-2">
            <Row label="Project ID" value={project.projectId} valueClass="text-[#E16428]" />
            <Row label="Client Name" value={project.clientName} />
            <Row label="University / ORG" value={project.clientUniOrg || '—'} />
            <Row
              label="Types"
              value={typeNames.length ? typeNames.join(', ') : '—'}
              valueClass="text-[#E16428]"
            />
            <Row label="Deadline" value={new Date(project.deadlineDate).toLocaleDateString()} />
          </div>

          <div className="mx-4 border-t border-[#E16428]/15" />

          <div className="px-4 py-2">
            <Row label="Price" value={`LKR ${project.price.toLocaleString()}`} />
            {hasDiscount && (
              <>
                <Row
                  label={`Discount${discountPercent ? ` ${discountPercent}%` : ''}`}
                  value={`− LKR ${discountAmount.toLocaleString()}`}
                  valueClass="text-emerald-300"
                />
                <Row label="Net" value={`LKR ${netPrice.toLocaleString()}`} />
              </>
            )}
            <Row
              label="Advance"
              value={`LKR ${project.advance.toLocaleString()}`}
              valueClass="text-green-400"
            />
            <Row
              label="Balance"
              value={`LKR ${balance.toLocaleString()}`}
              valueClass={balance > 0 ? 'text-red-400' : 'text-green-400'}
            />
            <Row
              label="Status"
              value={project.status}
              valueClass={statusValueColors[project.status] || 'text-[#F6E9E9]'}
            />
            {(project.fastDeliver || hasDiscount) && (
              <div className="flex flex-wrap gap-1.5 pt-1.5">
                {project.fastDeliver && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-300 text-[9px] leading-none font-medium border border-yellow-500/25">
                    <Crown className="w-2.5 h-2.5" /> Fast
                  </span>
                )}
                {hasDiscount && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[9px] leading-none font-medium border border-emerald-500/25">
                    <BadgePercent className="w-2.5 h-2.5" /> −{discountPercent}%
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-[#E16428]/12 bg-[#1c1818] rounded-b-xl">
            <span className="text-[9px] leading-normal text-[#F6E9E9]/40">
              {new Date().toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <span className="text-[9px] leading-normal font-bold text-[#E16428]">ogo technology</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2.5">
          <button
            type="button"
            onClick={handleDownload}
            disabled={isGenerating}
            className="flex items-center justify-center gap-1.5 h-10 px-2 bg-[#E16428] text-white rounded-lg hover:bg-[#e16428]/90 active:scale-[0.98] transition text-[11px] font-bold disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Download
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={isGenerating}
            className="flex items-center justify-center gap-1.5 h-10 px-2 bg-[#272121] text-[#F6E9E9] rounded-lg border border-[#E16428]/25 hover:border-[#E16428]/50 active:scale-[0.98] transition text-[11px] font-bold disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Share2 className="w-3.5 h-3.5" />
            )}
            Share
          </button>
        </div>

        {isGenerating && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-[#161313]/85 backdrop-blur-[2px]">
            <Loader2 className="w-8 h-8 text-[#E16428] animate-spin" />
            <p className="mt-3 text-xs font-semibold text-[#F6E9E9] font-['Poppins']">
              {generatingLabel}
            </p>
            <p className="mt-1 text-[10px] text-[#F6E9E9]/45 font-['Inter']">Please wait…</p>
          </div>
        )}
      </div>
    </div>
  );
};
