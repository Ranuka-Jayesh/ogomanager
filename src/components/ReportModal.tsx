import React, { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import jsPDF from 'jspdf';
import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, PieController } from 'chart.js';
import { Project, Employee } from '../types';
import { supabase } from '../supabaseClient';

Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, PieController);

// @ts-ignore
import type {} from 'chart.js';

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  employees: Employee[];
  month: number | 'all';
  year: number | 'all';
}

export const ReportModal: React.FC<ReportModalProps> = ({ open, onClose, projects, employees, month, year }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [projectTypes, setProjectTypes] = React.useState<{ id: string; name: string }[]>([]);
  const now = new Date();
  const monthName = month === 'all' ? 'All Months' : new Date(0, month as number).toLocaleString('default', { month: 'long' });
  const yearName = year === 'all' ? 'All Years' : year;

  // Summaries
  const totalRevenue = projects.reduce((sum, p) => sum + p.price, 0);
  const totalEmployeePayments = projects.reduce((sum, p) => sum + p.paymentOfEmp, 0);
  const profit = totalRevenue - totalEmployeePayments;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  // Best employee (by earnings or revenue)
  const employeeStats = employees.map(emp => {
    const empProjects = projects.filter(p => p.assignedTo === emp.id);
    const totalEarnings = empProjects.reduce((sum, p) => sum + p.paymentOfEmp, 0);
    const revenue = empProjects.reduce((sum, p) => sum + p.price, 0);
    const isRanukaJayesh = `${emp.firstName} ${emp.lastName}`.toLowerCase() === 'ranuka jayesh';
    return {
      ...emp,
      totalEarnings,
      revenue,
      displayValue: isRanukaJayesh ? revenue : totalEarnings,
      projectCount: empProjects.length,
    };
  });
  const bestEmployee = employeeStats.sort((a, b) => b.displayValue - a.displayValue)[0];

  // Best university/org
  const orgStats: Record<string, { count: number; revenue: number }> = {};
  projects.forEach(p => {
    if (!orgStats[p.clientUniOrg]) orgStats[p.clientUniOrg] = { count: 0, revenue: 0 };
    orgStats[p.clientUniOrg].count++;
    orgStats[p.clientUniOrg].revenue += p.price;
  });
  const bestOrg = Object.entries(orgStats).sort((a, b) => b[1].count - a[1].count)[0];

  // Project types performance
  const typeStats: Record<string, { count: number; revenue: number }> = {};
  projects.forEach(p => {
    (p.projectDescription.split(',') || []).forEach(typeId => {
      const id = typeId.trim();
      if (!id) return;
      if (!typeStats[id]) typeStats[id] = { count: 0, revenue: 0 };
      typeStats[id].count++;
      typeStats[id].revenue += p.price;
    });
  });

  const getTypeName = (id: string) => {
    const type = projectTypes.find(t => t.id === id);
    return type ? type.name : `Unknown Type (${id})`;
  };

  // Status distribution
  const statusStats: Record<string, number> = {};
  projects.forEach(p => {
    statusStats[p.status] = (statusStats[p.status] || 0) + 1;
  });

  // Export to PDF
  const handleExport = async () => {
    if (!reportRef.current) return;
    
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let yPosition = margin;
    
    // Add OGO logo (top left)
    const logoImg = new Image();
    logoImg.src = '/Logo.jpg';
    await new Promise(resolve => { logoImg.onload = resolve; });
    pdf.addImage(logoImg, 'JPEG', margin, yPosition, 18, 18);
    
    // Header with company details (aligned left, rest centered)
    const headerLeft = margin + 22;
    let headerY = yPosition + 2;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.setTextColor(225, 100, 40); // #E16428
    pdf.text('ogo assignments', headerLeft, headerY + 6);
    pdf.setFontSize(11);
    pdf.setTextColor(100, 100, 100);
    pdf.text('department of academic', headerLeft, headerY + 14);
    pdf.text('Galle, Sri Lanka.', headerLeft, headerY + 20);
    pdf.text('+94 75 930 7059', headerLeft, headerY + 26);
    
    // Centered report info
    let reportTitle = '';
    if (month !== 'all' && year !== 'all') {
      reportTitle = `Sales Report - ${monthName} ${yearName}`;
    } else if (month === 'all' && year !== 'all') {
      reportTitle = `Annual Sales Report - ${yearName}`;
    } else if (month === 'all' && year === 'all') {
      reportTitle = 'Annual Sales Report - All Years';
    } else {
      reportTitle = 'Sales Report';
    }
    pdf.setFontSize(18);
    pdf.setTextColor(40, 40, 40);
    pdf.setFont('helvetica', 'bold');
    pdf.text(reportTitle, pageWidth / 2 + 10, yPosition + 24, { align: 'center' });
    yPosition += 34;
    
    // Report period
    pdf.setFontSize(14);
    pdf.setTextColor(50, 50, 50);
    pdf.text(`Report Period: ${monthName} ${yearName}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
    
    pdf.setFontSize(10);
    pdf.setTextColor(80, 80, 80);
    pdf.text(`Generated: ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;
    
    // Summary section
    pdf.setFontSize(16);
    pdf.setTextColor(225, 100, 40);
    pdf.text('EXECUTIVE SUMMARY', margin, yPosition);
    yPosition += 8;
    
    // Summary cards (lighter background, dark value text)
    const cardHeight = 25;
    const cardWidth = (contentWidth - 10) / 2;
    
    // Revenue card
    pdf.setFillColor(247, 247, 247);
    pdf.rect(margin, yPosition, cardWidth, cardHeight, 'F');
    pdf.setFontSize(12);
    pdf.setTextColor(225, 100, 40);
    pdf.text('Total Revenue', margin + 5, yPosition + 8);
    pdf.setFontSize(16);
    pdf.setTextColor(34, 34, 34);
    pdf.text(`LKR ${totalRevenue.toLocaleString()}`, margin + 5, yPosition + 18);
    
    // Profit card
    pdf.setFillColor(247, 247, 247);
    pdf.rect(margin + cardWidth + 10, yPosition, cardWidth, cardHeight, 'F');
    pdf.setFontSize(12);
    pdf.setTextColor(34, 197, 94);
    pdf.text('Total Profit', margin + cardWidth + 15, yPosition + 8);
    pdf.setFontSize(16);
    pdf.setTextColor(34, 34, 34);
    pdf.text(`LKR ${profit.toLocaleString()}`, margin + cardWidth + 15, yPosition + 18);
    
    yPosition += cardHeight + 10;
    
    // Profit margin
    pdf.setFillColor(247, 247, 247);
    pdf.rect(margin, yPosition, cardWidth, cardHeight, 'F');
    pdf.setFontSize(12);
    pdf.setTextColor(147, 51, 234);
    pdf.text('Profit Margin', margin + 5, yPosition + 8);
    pdf.setFontSize(16);
    pdf.setTextColor(34, 34, 34);
    pdf.text(`${profitMargin.toFixed(1)}%`, margin + 5, yPosition + 18);
    
    // Employee payments
    pdf.setFillColor(247, 247, 247);
    pdf.rect(margin + cardWidth + 10, yPosition, cardWidth, cardHeight, 'F');
    pdf.setFontSize(12);
    pdf.setTextColor(234, 179, 8);
    pdf.text('Employee Payments', margin + cardWidth + 15, yPosition + 8);
    pdf.setFontSize(16);
    pdf.setTextColor(34, 34, 34);
    pdf.text(`LKR ${totalEmployeePayments.toLocaleString()}`, margin + cardWidth + 15, yPosition + 18);
    
    yPosition += cardHeight + 20;
    
    // Best Performance section
    pdf.setFontSize(16);
    pdf.setTextColor(225, 100, 40);
    pdf.text('BEST PERFORMANCE', margin, yPosition);
    yPosition += 8;
    
    // Best employee and org
    const perfCardHeight = 20;
    const perfCardWidth = (contentWidth - 10) / 2;
    
    // Best Employee
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPosition, perfCardWidth, perfCardHeight, 'F');
    pdf.setFontSize(11);
    pdf.setTextColor(225, 100, 40);
    pdf.text('Best Employee', margin + 5, yPosition + 7);
    pdf.setFontSize(12);
    pdf.setTextColor(50, 50, 50);
    pdf.text(bestEmployee ? `${bestEmployee.firstName} ${bestEmployee.lastName}` : '-', margin + 5, yPosition + 15);
    
    // Best University/Org
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin + perfCardWidth + 10, yPosition, perfCardWidth, perfCardHeight, 'F');
    pdf.setFontSize(11);
    pdf.setTextColor(225, 100, 40);
    pdf.text('Best University/Org', margin + perfCardWidth + 15, yPosition + 7);
    pdf.setFontSize(12);
    pdf.setTextColor(50, 50, 50);
    pdf.text(bestOrg ? bestOrg[0] : '-', margin + perfCardWidth + 15, yPosition + 15);
    
    yPosition += perfCardHeight + 20;
    
    // Employee Performance Table
    if (employeeStats.length > 0) {
      pdf.setFontSize(16);
      pdf.setTextColor(225, 100, 40);
      pdf.text('EMPLOYEE PERFORMANCE', margin, yPosition);
      yPosition += 8;
      
      // Check if we need a new page
      if (yPosition > pageHeight - 80) {
        pdf.addPage();
        yPosition = margin;
      }
      
      // Table headers
      const tableY = yPosition;
      
      pdf.setFillColor(225, 100, 40);
      pdf.rect(margin, tableY, contentWidth, 8, 'F');
      pdf.setFontSize(10);
      pdf.setTextColor(255, 255, 255);
      pdf.text('Employee', margin + 2, tableY + 6);
      pdf.text('Projects', margin + 62, tableY + 6);
      pdf.text('Earnings/Revenue', margin + 87, tableY + 6);
      pdf.text('Completion %', margin + 127, tableY + 6);
      
      yPosition += 8;
      
      // Table rows
      employeeStats.forEach((emp, index) => {
        if (yPosition > pageHeight - 40) {
          pdf.addPage();
          yPosition = margin;
        }
        
        const rowY = yPosition;
        pdf.setFillColor(index % 2 === 0 ? 248 : 255);
        pdf.rect(margin, rowY, contentWidth, 8, 'F');
        
        pdf.setFontSize(9);
        pdf.setTextColor(50, 50, 50);
        pdf.text(`${emp.firstName} ${emp.lastName}`, margin + 2, rowY + 6);
        pdf.text(String(emp.projectCount), margin + 62, rowY + 6);
        pdf.setTextColor(225, 100, 40);
        pdf.text('LKR ' + String(emp.displayValue.toLocaleString()), margin + 87, rowY + 6);
        pdf.setTextColor(50, 50, 50);
        const completionRate = emp.projectCount > 0 ? ((emp.projectCount && emp.projectCount > 0) ? ((projects.filter(p => p.assignedTo === emp.id && p.status === 'Delivered').length / emp.projectCount) * 100) : 0) : 0;
        pdf.text(completionRate.toFixed(1) + '%', margin + 127, rowY + 6);
        
        yPosition += 8;
      });
      
      yPosition += 15;
    }
    
    // Project Types Performance Table
    if (Object.keys(typeStats).length > 0) {
      // Check if we need a new page
      if (yPosition > pageHeight - 60) {
        pdf.addPage();
        yPosition = margin;
      }
      
      pdf.setFontSize(16);
      pdf.setTextColor(225, 100, 40);
      pdf.text('PROJECT TYPES PERFORMANCE', margin, yPosition);
      yPosition += 8;
      
      // Table headers
      const typeTableY = yPosition;
      
      pdf.setFillColor(225, 100, 40);
      pdf.rect(margin, typeTableY, contentWidth, 8, 'F');
      pdf.setFontSize(10);
      pdf.setTextColor(255, 255, 255);
      pdf.text('Project Type', margin + 2, typeTableY + 6);
      pdf.text('Projects', margin + 82, typeTableY + 6);
      pdf.text('Revenue', margin + 112, typeTableY + 6);
      
      yPosition += 8;
      
      // Table rows
      Object.entries(typeStats).forEach(([typeId, stat], index) => {
        if (yPosition > pageHeight - 40) {
          pdf.addPage();
          yPosition = margin;
        }
        
        const rowY = yPosition;
        pdf.setFillColor(index % 2 === 0 ? 248 : 255);
        pdf.rect(margin, rowY, contentWidth, 8, 'F');
        
        pdf.setFontSize(9);
        pdf.setTextColor(50, 50, 50);
        pdf.text(getTypeName(typeId), margin + 2, rowY + 6);
        pdf.text(String(stat.count), margin + 82, rowY + 6);
        pdf.setTextColor(225, 100, 40);
        pdf.text('LKR ' + String(stat.revenue.toLocaleString()), margin + 112, rowY + 6);
        
        yPosition += 8;
      });
    }
    
    // Add page numbers
    const pageCount = (typeof pdf.getNumberOfPages === 'function') ? pdf.getNumberOfPages() : (pdf.internal.pages ? pdf.internal.pages.length : 1);
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(Number(i));
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }
    
    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text('OGO Technology - Professional Project Management System', pageWidth / 2, pageHeight - 5, { align: 'center' });
    
    pdf.save(`OGO-Report-${monthName}-${yearName}.pdf`);
  };

  useEffect(() => {
    async function fetchProjectTypes() {
      const { data, error } = await supabase.from('project_types').select('*');
      if (!error && data) setProjectTypes(data);
    }
    fetchProjectTypes();
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#1a1818] rounded-2xl shadow-2xl max-w-4xl w-full mx-4 p-8 overflow-y-auto max-h-[90vh] relative" ref={reportRef}>
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-[#272121]/60 text-[#F6E9E9] rounded-lg hover:bg-[#E16428]/20 transition-all duration-300">
          <X className="w-5 h-5" />
        </button>
        {/* Company Details */}
        <div className="flex items-center gap-4 mb-8">
          <img src="/Logo.jpg" alt="OGO Logo" className="w-14 h-14 rounded-xl object-cover border-2 border-[#E16428]/40 shadow" />
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#F6E9E9] font-['Playfair_Display'] tracking-tight lowercase">ogo technology</h2>
            <p className="text-[#F6E9E9]/70 text-xs sm:text-sm lowercase">professional project management report</p>
            <p className="text-[#F6E9E9]/50 text-xs mt-1">generated: {now.toLocaleDateString()} {now.toLocaleTimeString()}</p>
            <p className="text-[#F6E9E9]/50 text-xs">period: {monthName} {yearName}</p>
          </div>
        </div>
        {/* Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-r from-[#E16428]/80 to-[#E16428]/40 rounded-xl p-6 flex flex-col gap-2 shadow">
            <span className="text-[#fff]/80 text-sm font-['Inter']">Total Revenue</span>
            <span className="text-2xl font-bold text-white font-['Poppins']">LKR {totalRevenue.toLocaleString()}</span>
          </div>
          <div className="bg-gradient-to-r from-green-500/80 to-green-500/40 rounded-xl p-6 flex flex-col gap-2 shadow">
            <span className="text-[#fff]/80 text-sm font-['Inter']">Total Profit</span>
            <span className="text-2xl font-bold text-white font-['Poppins']">LKR {profit.toLocaleString()}</span>
          </div>
          <div className="bg-gradient-to-r from-purple-500/80 to-purple-500/40 rounded-xl p-6 flex flex-col gap-2 shadow">
            <span className="text-[#fff]/80 text-sm font-['Inter']">Profit Margin</span>
            <span className="text-2xl font-bold text-white font-['Poppins']">{profitMargin.toFixed(1)}%</span>
          </div>
          <div className="bg-gradient-to-r from-yellow-500/80 to-yellow-500/40 rounded-xl p-6 flex flex-col gap-2 shadow">
            <span className="text-[#fff]/80 text-sm font-['Inter']">Total Employee Payments</span>
            <span className="text-2xl font-bold text-white font-['Poppins']">LKR {totalEmployeePayments.toLocaleString()}</span>
          </div>
        </div>
        {/* Best Performance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#272121]/80 rounded-xl p-6 flex flex-col gap-2 shadow">
            <span className="text-[#E16428] text-sm font-['Inter']">Best Employee</span>
            <span className="text-lg font-bold text-[#F6E9E9] font-['Poppins']">{bestEmployee ? `${bestEmployee.firstName} ${bestEmployee.lastName}` : '-'}</span>
            <span className="text-[#F6E9E9]/70 text-xs">Earnings/Revenue: LKR {bestEmployee ? bestEmployee.displayValue.toLocaleString() : '0'}</span>
            <span className="text-[#F6E9E9]/50 text-xs">Projects: {bestEmployee ? bestEmployee.projectCount : 0}</span>
          </div>
          <div className="bg-[#272121]/80 rounded-xl p-6 flex flex-col gap-2 shadow">
            <span className="text-[#E16428] text-sm font-['Inter']">Best University/Org</span>
            <span className="text-lg font-bold text-[#F6E9E9] font-['Poppins']">{bestOrg ? bestOrg[0] : '-'}</span>
            <span className="text-[#F6E9E9]/70 text-xs">Revenue: LKR {bestOrg ? bestOrg[1].revenue.toLocaleString() : '0'}</span>
            <span className="text-[#F6E9E9]/50 text-xs">Projects: {bestOrg ? bestOrg[1].count : 0}</span>
          </div>
        </div>
        {/* Employee Performance Table */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-[#E16428] mb-2 font-['Poppins']">Employee Performance</h3>
          <table className="w-full text-sm bg-[#1a1818] rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-[#272121] text-[#F6E9E9]/80">
                <th className="p-2">Employee</th>
                <th className="p-2">Projects</th>
                <th className="p-2">Earnings/Revenue</th>
                <th className="p-2">Completion Rate</th>
              </tr>
            </thead>
            <tbody>
              {employeeStats.map(emp => (
                <tr key={emp.id} className="border-b border-[#E16428]/10">
                  <td className="p-2 text-[#F6E9E9]">{emp.firstName} {emp.lastName}</td>
                  <td className="p-2 text-[#F6E9E9]/80">{emp.projectCount}</td>
                  <td className="p-2 text-[#E16428] font-bold">LKR {emp.displayValue.toLocaleString()}</td>
                  <td className="p-2 text-[#F6E9E9]/70">{emp.projectCount > 0 ? ((emp.projectCount && emp.projectCount > 0) ? ((projects.filter(p => p.assignedTo === emp.id && p.status === 'Delivered').length / emp.projectCount) * 100).toFixed(1) : '0.0') : '0.0'}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Project Types Performance Table */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-[#E16428] mb-2 font-['Poppins']">Project Types Performance</h3>
          <table className="w-full text-sm bg-[#1a1818] rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-[#272121] text-[#F6E9E9]/80">
                <th className="p-2">Type</th>
                <th className="p-2">Projects</th>
                <th className="p-2">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(typeStats).map(([typeId, stat]) => (
                <tr key={typeId} className="border-b border-[#E16428]/10">
                  <td className="p-2 text-[#F6E9E9]">{getTypeName(typeId)}</td>
                  <td className="p-2 text-[#F6E9E9]/80">{stat.count}</td>
                  <td className="p-2 text-[#E16428] font-bold">LKR {stat.revenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Export Button */}
        <div className="flex justify-end mt-6">
          <button
            onClick={handleExport}
            className="px-6 py-3 bg-gradient-to-r from-[#E16428] to-[#E16428]/80 text-white rounded-lg hover:scale-105 transition-all duration-300 shadow-lg font-['Poppins'] font-bold flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Export as PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportModal; 