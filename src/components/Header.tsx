import React, { useState, useRef } from 'react';
import { FileText, Bell, Search, Menu, ChevronLeft, ChevronRight, Database } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Project, Employee } from '../types';

interface HeaderProps {
  onMenuToggle: () => void;
  onSidebarToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle, onSidebarToggle }) => {
  // Placeholder for connectivity status
  const isConnected = true; // Set to false to show red dot
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch employees on mount (for name lookup)
  React.useEffect(() => {
    if (!searchOpen) return;
    async function fetchEmployees() {
      const { data } = await supabase.from('employees').select('*');
      if (data) setEmployees(data);
    }
    fetchEmployees();
  }, [searchOpen]);

  // Search projects as user types
  React.useEffect(() => {
    if (!searchOpen || !searchValue.trim()) {
      setSearchResults([]);
      setNoResults(false);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(async () => {
      const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .ilike('clientName', `%${searchValue}%`);
      const { data: projectsByOrg } = await supabase
        .from('projects')
        .select('*')
        .ilike('clientUniOrg', `%${searchValue}%`);
      // Employee name search
      const matchedEmps = employees.filter(emp =>
        `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchValue.toLowerCase())
      );
      let projectsByEmp: Project[] = [];
      if (matchedEmps.length > 0) {
        const empIds = matchedEmps.map(e => e.id);
        const { data: empProjects } = await supabase
          .from('projects')
          .select('*')
          .in('assignedTo', empIds);
        if (empProjects) projectsByEmp = empProjects;
      }
      // Merge and deduplicate
      const all = [...(projects || []), ...(projectsByOrg || []), ...projectsByEmp];
      const unique = all.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
      setSearchResults(unique);
      setNoResults(unique.length === 0);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchValue, searchOpen, employees]);

  return (
    <>
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-[#363333]/20 border-b border-[#E16428]/20">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Mobile Menu Button */}
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg hover:bg-[#E16428]/10 transition-all duration-300"
          >
            <Menu className="w-5 h-5 text-[#F6E9E9]" />
          </button>

          {/* Desktop Sidebar Toggle */}
            {/* Removed sidebar toggle button */}

          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-[#E16428] to-[#F6E9E9] rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg sm:text-xl font-bold text-[#F6E9E9] font-['Playfair_Display']">
                  ogo Manager Pro
              </h1>
              <p className="text-xs text-[#F6E9E9]/70 font-['Inter']">
                  online sales management
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#F6E9E9]/50" />
            <input
              type="text"
              placeholder="Search projects..."
                className="pl-10 pr-4 py-2 w-48 lg:w-64 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter'] cursor-pointer"
                onFocus={() => setSearchOpen(true)}
                readOnly
            />
          </div>
          
          {/* Mobile Search Button */}
            <button
              className="sm:hidden p-2 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg hover:bg-[#E16428]/10 transition-all duration-300"
              onClick={() => setSearchOpen(true)}
            >
            <Search className="w-5 h-5 text-[#F6E9E9]" />
          </button>

            {/* Database Connectivity Icon */}
            <div className="relative p-2 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg hover:bg-[#E16428]/10 transition-all duration-300 flex items-center justify-center">
              <Database className="w-5 h-5 text-[#F6E9E9]" />
              <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-[#272121] ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            </div>

          <button className="relative p-2 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg hover:bg-[#E16428]/10 transition-all duration-300">
            <Bell className="w-5 h-5 text-[#F6E9E9]" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#E16428] rounded-full"></span>
          </button>
        </div>
      </div>
    </header>
      {/* Fullscreen Glassy Search Modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-xl animate-fadeIn"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="bg-[#232021]/80 rounded-2xl shadow-2xl p-8 w-full max-w-xl mx-4 flex flex-col items-center relative border border-[#E16428]/20"
            onClick={e => e.stopPropagation()}
          >
            <button
              className="absolute top-4 right-4 p-2 bg-[#272121]/60 text-[#F6E9E9] rounded-lg hover:bg-[#E16428]/20 transition-all duration-300"
              onClick={() => setSearchOpen(false)}
              aria-label="Close search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex flex-col items-center w-full">
              <Search className="w-6 h-6 text-[#E16428] mb-4" />
              <input
                ref={inputRef}
                autoFocus
                type="text"
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                placeholder="Type to search projects, employees, or organizations..."
                className="w-full px-6 py-4 rounded-xl bg-[#272121]/80 border border-[#E16428]/30 text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] text-lg font-['Inter'] shadow-lg mb-2"
              />
              {/* Results Dropdown */}
              <div className="w-full max-h-72 overflow-y-auto mt-2 rounded-xl bg-[#1a1818]/90 border border-[#E16428]/10 shadow-xl">
                {loading ? (
                  <div className="p-6 text-center text-[#E16428] font-bold animate-pulse">Searching...</div>
                ) : noResults ? (
                  <div className="p-6 text-center text-[#F6E9E9]/60 font-['Inter']">No results found</div>
                ) : (
                  searchResults.map(project => {
                    const emp = employees.find(e => e.id === project.assignedTo);
                    return (
                      <div
                        key={project.id}
                        className="flex flex-col gap-1 px-6 py-3 border-b border-[#E16428]/10 hover:bg-[#E16428]/10 cursor-pointer transition-all duration-200 group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#F6E9E9] text-sm truncate max-w-[120px]">{project.clientName}</span>
                          <span className="ml-auto text-xs text-[#E16428] font-semibold">{project.clientUniOrg}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#F6E9E9]/70">{emp ? `${emp.firstName} ${emp.lastName}` : 'Unassigned'}</span>
                          <span className="ml-auto text-xs text-[#F6E9E9]/40">{new Date(project.deadlineDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};