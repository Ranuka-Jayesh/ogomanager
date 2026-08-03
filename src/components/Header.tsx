import React, { useState, useRef } from 'react';
import { Bell, Search } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Project, Employee } from '../types';
import { useSupabaseConnection } from '../hooks/useSupabaseConnection';
import { ConnectionStatus } from './ConnectionStatus';

interface SyncProps {
  isOnline: boolean;
  pendingChanges: number;
  isSyncing: boolean;
  onSync: () => Promise<boolean>;
  lastSyncTime?: number | null;
}

interface HeaderProps {
  onMenuToggle: () => void;
  onSidebarToggle: () => void;
  syncProps?: SyncProps;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle, syncProps }) => {
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
    }
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl + R: Refresh (only when not in input fields)
      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) {
          return;
        }
        event.preventDefault();
        refreshData();
      }

      // Ctrl + K: Open search modal (only when not in input fields)
      if (event.ctrlKey && event.key === 'k') {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) {
          return;
        }
        event.preventDefault();
        setSearchOpen(true);
      }
      
      // ESC: Close search modal (works even when typing in search input)
      if (event.key === 'Escape' && searchOpen) {
        event.preventDefault();
        setSearchOpen(false);
        setSearchValue(''); // Clear search value when closing
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

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
        const searchLower = searchValue.toLowerCase().trim();
        const searchUpper = searchValue.toUpperCase().trim();
        
        // Search by client name (flexible partial matching)
        const { data: projectsByName, error: nameError } = await supabase
          .from('projects')
          .select('*')
          .ilike('client_name', `%${searchValue}%`);
        
        if (nameError) {
          console.error('Error searching by client name:', nameError);
        }

        // Search by organization (flexible partial matching)
        const { data: projectsByOrg, error: orgError } = await supabase
          .from('projects')
          .select('*')
          .ilike('client_uni_org', `%${searchValue}%`);
        
        if (orgError) {
          console.error('Error searching by organization:', orgError);
        }

        // Search by project ID - handle both full ID (PJ1234) and numeric-only (1234, 123, 12)
        let projectsById: any[] = [];
        
        // Check if search is purely numeric (e.g., "1234", "123", "12")
        const isNumericOnly = /^\d+$/.test(searchValue.trim());
        
        if (isNumericOnly) {
          // For numeric-only searches, search with "PJ" prefix
          const { data: projectsByFullId, error: fullIdError } = await supabase
            .from('projects')
            .select('*')
            .ilike('project_id', `%PJ${searchValue}%`);
          
          if (fullIdError) {
            console.error('Error searching by project ID:', fullIdError);
          } else if (projectsByFullId) {
            projectsById = projectsByFullId;
          }
          
          // Also search for projects where the numeric part matches (e.g., searching "123" finds "PJ1234", "PJ1235", etc.)
          // Fetch projects and filter client-side for numeric matching
          const { data: allProjects, error: allProjectsError } = await supabase
            .from('projects')
            .select('*')
            .ilike('project_id', 'PJ%'); // Only fetch PJ-prefixed projects for efficiency
          
          if (!allProjectsError && allProjects) {
            const numericFiltered = allProjects.filter((project: any) => {
              const projectId = project.project_id || '';
              // Extract numeric part from project ID (e.g., "PJ1234" -> "1234")
              const projectNumeric = projectId.replace(/[^0-9]/g, '');
              // Check if the numeric part contains the search numeric value
              return projectNumeric.includes(searchValue.trim());
            });
            // Merge with existing results
            projectsById = [...projectsById, ...numericFiltered];
          }
        } else {
          // For non-numeric searches, try full project ID match (e.g., "PJ1234", "pj1234")
          const { data: projectsByFullId, error: fullIdError } = await supabase
            .from('projects')
            .select('*')
            .ilike('project_id', `%${searchUpper}%`);
          
          if (fullIdError) {
            console.error('Error searching by project ID:', fullIdError);
          } else if (projectsByFullId) {
            projectsById = projectsByFullId;
          }
          
          // Also check if search contains numbers and try numeric matching
          const numericMatch = searchValue.match(/\d+/);
          if (numericMatch && numericMatch[0].length >= 2) {
            const numericPart = numericMatch[0];
            const { data: numericProjects, error: numericError } = await supabase
              .from('projects')
              .select('*')
              .ilike('project_id', 'PJ%');
            
            if (!numericError && numericProjects) {
              const numericFiltered = numericProjects.filter((project: any) => {
                const projectId = project.project_id || '';
                const projectNumeric = projectId.replace(/[^0-9]/g, '');
                return projectNumeric.includes(numericPart);
              });
              projectsById = [...projectsById, ...numericFiltered];
            }
          }
        }

        // Employee name search (flexible partial matching - handles "na", "me", "Name", "name", etc.)
        const matchedEmps = employees.filter(emp => {
          const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
          const firstName = (emp.firstName || '').toLowerCase();
          const lastName = (emp.lastName || '').toLowerCase();
          
          // Check if search matches full name, first name, last name, or any substring
          // This handles cases like "na" matching "Name", "me" matching "Name", etc.
          return (
            fullName.includes(searchLower) ||
            firstName.includes(searchLower) ||
            lastName.includes(searchLower)
          );
        });
        
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
          ...projectsById, 
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
      <div className="flex items-center justify-between px-4 sm:px-6 py-1 sm:py-1.5">
        <div className="flex items-center space-x-2 sm:space-x-3 lg:-ml-4 xl:-ml-6">
          {/* Mobile Menu Button */}
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-1.5 text-[#F6E9E9] hover:text-[#E16428] transition-colors duration-300"
            aria-label="Open menu"
          >
            <span className="flex flex-col items-start justify-center gap-[5px] w-5">
              <span className="block h-[2.5px] w-full rounded-full bg-current" />
              <span className="block h-[2.5px] w-[75%] rounded-full bg-current" />
              <span className="block h-[2.5px] w-[50%] rounded-full bg-current" />
            </span>
          </button>

          {/* Desktop Sidebar Toggle */}
            {/* Removed sidebar toggle button */}

          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <img
              src="/logo_ogo.png"
              alt="OGO Logo"
              className="w-14 h-14 sm:w-16 sm:h-16 object-contain"
            />
            <div className="hidden sm:block leading-tight">
              <h1 className="text-base sm:text-lg font-bold text-[#F6E9E9] font-['Playfair_Display'] leading-tight">
                  Manager Pro
              </h1>
              <p className="text-[11px] text-[#F6E9E9]/70 font-['Inter'] leading-tight">
                  online sales management
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="relative hidden sm:block">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F6E9E9]/50 pointer-events-none" />
            <input
              type="text"
              placeholder="Looking for something?"
              className="underline-field pl-7 pr-0 py-2 w-48 lg:w-64 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] placeholder-[#F6E9E9]/50 font-['Inter'] cursor-pointer"
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

            <ConnectionStatus
              dbStatus={status}
              isDbConnected={isConnected}
              lastPing={lastPing}
              isOnline={syncProps?.isOnline ?? true}
              pendingChanges={syncProps?.pendingChanges ?? 0}
              isSyncing={syncProps?.isSyncing ?? false}
              lastSyncTime={syncProps?.lastSyncTime ?? null}
              onSync={syncProps?.onSync}
            />

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
      {/* Fullscreen Search Modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-xl animate-fadeIn"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl mx-4 flex flex-col relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              className="absolute -top-10 right-0 p-1.5 text-[#F6E9E9]/60 hover:text-[#E16428] transition-colors duration-200"
              onClick={() => setSearchOpen(false)}
              aria-label="Close search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex flex-col w-full">
              <div className="relative w-full">
                <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-[#E16428] pointer-events-none" />
                <input
                  ref={inputRef}
                  autoFocus
                  type="text"
                  value={searchValue}
                  onChange={e => setSearchValue(e.target.value)}
                  placeholder="Looking for something?"
                  className="underline-field w-full pl-8 pr-0 py-3 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:border-[#E16428] text-lg font-['Inter'] transition-[border-color]"
                />
              </div>
              {/* Results */}
              {(loading || noResults || searchResults.length > 0) && (
                <div className="w-full max-h-72 overflow-y-auto mt-1">
                  {loading ? (
                    <div className="py-5 text-center text-[#E16428]/80 font-['Inter'] text-sm animate-pulse">
                      Searching...
                    </div>
                  ) : noResults ? (
                    <div className="py-5 text-center text-[#F6E9E9]/50 font-['Inter'] text-sm">
                      No results found
                    </div>
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
                        giveDiscount: project.give_discount || false,
                        discountAmount: project.discount_amount || 0,
                        createdAt: project.created_at,
                        updatedAt: project.updated_at,
                      };
                      
                      const emp = employees.find(e => e.id === mappedProject.assignedTo);
                      return (
                        <div
                          key={mappedProject.id}
                          className="flex flex-col gap-1 px-0 py-3 border-b border-[#E16428]/15 hover:border-[#E16428]/40 cursor-pointer transition-colors duration-200 group"
                          onClick={() => {
                            setSearchOpen(false);
                            setSearchValue('');
                            // Extract month and year from project creation date
                            const projectDate = mappedProject.createdAt ? new Date(mappedProject.createdAt) : new Date();
                            const projectMonth = projectDate.getMonth(); // 0-11
                            const projectYear = projectDate.getFullYear();
                            
                            // Store project ID, month, and year in sessionStorage for persistence across page switches
                            sessionStorage.setItem('pendingProjectSearch', mappedProject.projectId);
                            sessionStorage.setItem('pendingProjectMonth', projectMonth.toString());
                            sessionStorage.setItem('pendingProjectYear', projectYear.toString());
                            
                            // Dispatch event to switch to projects tab
                            window.dispatchEvent(new CustomEvent('switchToProjectsTab'));
                            // Dispatch event with project ID, month, and year to filter in ProjectManagement (if already mounted)
                            window.dispatchEvent(new CustomEvent('searchProjectById', { 
                              detail: { 
                                projectId: mappedProject.projectId,
                                month: projectMonth,
                                year: projectYear
                              } 
                            }));
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#F6E9E9] text-sm truncate max-w-[120px] group-hover:text-[#E16428] transition-colors">
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
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};