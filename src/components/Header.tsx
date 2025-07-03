import React, { useState, useRef } from 'react';
import { Bell, Search, Menu, Wifi, WifiOff, Loader } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Project, Employee } from '../types';
import { useSupabaseConnection } from '../hooks/useSupabaseConnection';

interface HeaderProps {
  onMenuToggle: () => void;
  onSidebarToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const { status, isConnected, lastPing } = useSupabaseConnection();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
    timestamp: Date;
  }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Add notification function
  const addNotification = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    const id = Math.random().toString(36).substring(2, 15);
    const notification = { id, message, type, timestamp: new Date() };
    setNotifications(prev => [notification, ...prev.slice(0, 4)]); // Keep only last 5 notifications
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // Refresh function
  const refreshData = () => {
    // Trigger a page refresh to get latest data
    window.location.reload();
  };

  // Handle search completion
  const handleSearchComplete = () => {
    if (searchResults.length > 0) {
      addNotification(`Found ${searchResults.length} project(s)`, 'success');
      // Auto-refresh after successful search
      setTimeout(() => {
        refreshData();
      }, 2000); // Refresh after 2 seconds
    }
  };

  // Keyboard shortcut for refresh
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        refreshData();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for real-time changes and show notifications
  React.useEffect(() => {
    const projectsSubscription = supabase
      .channel('header_notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            addNotification(`New project added: ${payload.new.client_name}`, 'success');
          } else if (payload.eventType === 'UPDATE') {
            addNotification(`Project updated: ${payload.new.client_name}`, 'info');
          } else if (payload.eventType === 'DELETE') {
            addNotification('Project deleted', 'warning');
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employees'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            addNotification(`New employee added: ${payload.new.first_name} ${payload.new.last_name}`, 'success');
          } else if (payload.eventType === 'UPDATE') {
            addNotification(`Employee updated: ${payload.new.first_name} ${payload.new.last_name}`, 'info');
          } else if (payload.eventType === 'DELETE') {
            addNotification('Employee deleted', 'warning');
          }
        }
      )
      .subscribe();

    return () => {
      projectsSubscription.unsubscribe();
    };
  }, []);

  // Fetch employees on mount (for name lookup)
  React.useEffect(() => {
    if (!searchOpen) return;
    async function fetchEmployees() {
      try {
        const { data, error } = await supabase.from('employees').select('*');
        if (error) {
          console.error('Error fetching employees for search:', error);
          return;
        }
        // Map database fields to camelCase for consistency
        const mappedEmployees = (data || []).map(emp => ({
          id: emp.id,
          firstName: emp.first_name,
          lastName: emp.last_name,
          employeeId: emp.employee_id,
          position: emp.position,
          address: emp.address,
          whatsappNumber: emp.whatsapp,
          emailAddress: emp.email,
          qualifications: emp.qualifications,
          birthday: emp.birthday,
          createdAt: emp.created_at,
        }));
        setEmployees(mappedEmployees);
      } catch (error) {
        console.error('Error in fetchEmployees:', error);
      }
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
      try {
        // Search by client name
        const { data: projectsByName, error: nameError } = await supabase
          .from('projects')
          .select('*')
          .ilike('client_name', `%${searchValue}%`);
        
        if (nameError) {
          console.error('Error searching by client name:', nameError);
        }

        // Search by organization
        const { data: projectsByOrg, error: orgError } = await supabase
        .from('projects')
        .select('*')
          .ilike('client_uni_org', `%${searchValue}%`);
        
        if (orgError) {
          console.error('Error searching by organization:', orgError);
        }

        // Search by project ID
        const { data: projectsById, error: idError } = await supabase
        .from('projects')
        .select('*')
          .ilike('project_id', `%${searchValue.toUpperCase()}%`);
        
        if (idError) {
          console.error('Error searching by project ID:', idError);
        }

      // Employee name search
      const matchedEmps = employees.filter(emp =>
        `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchValue.toLowerCase())
      );
        
        let projectsByEmp: any[] = [];
      if (matchedEmps.length > 0) {
        const empIds = matchedEmps.map(e => e.id);
          const { data: empProjects, error: empError } = await supabase
          .from('projects')
          .select('*')
            .in('assigned_to', empIds);
          
          if (empError) {
            console.error('Error searching by employee:', empError);
          } else if (empProjects) {
            projectsByEmp = empProjects;
      }
        }

        // Merge and deduplicate all results
        const all = [
          ...(projectsByName || []), 
          ...(projectsByOrg || []), 
          ...(projectsById || []), 
          ...projectsByEmp
        ];
      const unique = all.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
        
      setSearchResults(unique);
      setNoResults(unique.length === 0);
        
        // Trigger refresh if results found
        if (unique.length > 0) {
          handleSearchComplete();
        }
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
        setNoResults(true);
      } finally {
      setLoading(false);
      }
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
            <img
              src="/2OGOlogo.png"
              alt="OGO Logo"
              className="w-10 h-10 sm:w-12 sm:h-12 object-contain rounded-xl shadow-lg p-1 border-0 sm:border-2 sm:border-white"
            />
            <div className="hidden sm:block">
              <h1 className="text-lg sm:text-xl font-bold text-[#F6E9E9] font-['Playfair_Display']">
                  Manager Pro
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
            <div className="relative p-2 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg hover:bg-[#E16428]/10 transition-all duration-300 flex items-center justify-center group">
              {status === 'connecting' ? (
                <Loader className="w-5 h-5 text-[#F6E9E9] animate-spin" />
              ) : isConnected ? (
                <Wifi className="w-5 h-5 text-green-400" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-400" />
              )}
              <span 
                className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-[#272121] ${
                  status === 'connecting' 
                    ? 'bg-yellow-500 animate-pulse' 
                    : isConnected 
                    ? 'bg-green-500' 
                    : 'bg-red-500'
                }`}
              ></span>
              {/* Tooltip */}
              <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-[#272121] text-[#F6E9E9] text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                {status === 'connecting' 
                  ? 'Connecting...' 
                  : isConnected 
                  ? `Connected${lastPing ? ` (${lastPing.toLocaleTimeString()})` : ''}` 
                  : 'Disconnected'
                }
              </div>
            </div>

          <button 
            className="relative p-2 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg hover:bg-[#E16428]/10 transition-all duration-300 group"
            onClick={() => setNotifications([])} // Clear notifications when clicked
          >
            <Bell className="w-5 h-5 text-[#F6E9E9]" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#E16428] rounded-full text-xs text-white flex items-center justify-center font-bold">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
            {/* Notification Tooltip */}
            {notifications.length > 0 && (
              <div className="absolute bottom-full right-0 mb-2 w-80 bg-[#272121] border border-[#E16428]/20 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
                <div className="p-3 border-b border-[#E16428]/10">
                  <h3 className="text-[#F6E9E9] font-semibold text-sm">Recent Updates</h3>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {notifications.map(notification => (
                    <div key={notification.id} className="p-3 border-b border-[#E16428]/10 last:border-b-0">
                      <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          notification.type === 'success' ? 'bg-green-500' :
                          notification.type === 'info' ? 'bg-blue-500' :
                          notification.type === 'warning' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[#F6E9E9] text-sm">{notification.message}</p>
                          <p className="text-[#F6E9E9]/50 text-xs mt-1">
                            {notification.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                placeholder="Search by client name, project ID, organization, or employee..."
                className="w-full px-6 py-4 rounded-xl bg-[#272121]/80 border border-[#E16428]/30 text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] text-lg font-['Inter'] shadow-lg mb-2"
              />
              {/* Results Dropdown */}
              <div className="w-full max-h-72 overflow-y-auto mt-2 rounded-xl bg-[#1a1818]/90 border border-[#E16428]/10 shadow-xl">
                {loading ? (
                  <div className="p-6 text-center text-[#E16428] font-bold animate-pulse">Searching...</div>
                ) : noResults ? (
                  <div className="p-6 text-center text-[#F6E9E9]/60 font-['Inter']">No results found</div>
                ) : (
                  searchResults.map((project: any) => {
                    // Map database fields to display format
                    const mappedProject = {
                      id: project.id,
                      projectId: project.project_id,
                      clientName: project.client_name,
                      clientUniOrg: project.client_uni_org,
                      projectDescription: project.project_description,
                      deadlineDate: project.deadline_date,
                      price: project.price,
                      advance: project.advance,
                      assignedTo: project.assigned_to,
                      paymentOfEmp: project.payment_of_emp,
                      status: project.status,
                      fastDeliver: project.fast_deliver || false,
                      createdAt: project.created_at,
                      updatedAt: project.updated_at,
                    };
                    
                    const emp = employees.find(e => e.id === mappedProject.assignedTo);
                    return (
                      <div
                        key={mappedProject.id}
                        className="flex flex-col gap-1 px-6 py-3 border-b border-[#E16428]/10 hover:bg-[#E16428]/10 cursor-pointer transition-all duration-200 group"
                        onClick={() => {
                          setSearchOpen(false);
                          setSearchValue('');
                          // You can add navigation logic here if needed
                          console.log('Selected project:', mappedProject);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#F6E9E9] text-sm truncate max-w-[120px]">
                            {mappedProject.clientName}
                          </span>
                          <span className="ml-auto text-xs text-[#E16428] font-semibold">
                            {mappedProject.projectId}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#F6E9E9]/70">
                            {emp ? `${emp.firstName} ${emp.lastName}` : 'Unassigned'}
                          </span>
                          <span className="ml-auto text-xs text-[#F6E9E9]/40">
                            {new Date(mappedProject.deadlineDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#F6E9E9]/60">
                            {mappedProject.clientUniOrg}
                          </span>
                          <span className="ml-auto text-xs text-[#F6E9E9]/50">
                            {mappedProject.status}
                          </span>
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