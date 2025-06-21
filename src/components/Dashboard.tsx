import React, { useEffect } from 'react';
import { DollarSign, Clock, CheckCircle, Users } from 'lucide-react';
import { Project, Employee } from '../types';
import { GlassCard } from './GlassCard';
import { useSupabaseConnection } from '../hooks/useSupabaseConnection';
import { supabase } from '../supabaseClient';

interface DashboardProps {
  projects: Project[];
  employees: Employee[];
}

export const Dashboard: React.FC<DashboardProps> = ({ projects, employees }) => {
  const { status } = useSupabaseConnection();
  const totalRevenue = projects.reduce((sum, project) => sum + project.price, 0);
  const completedProjects = projects.filter(p => p.status === 'Delivered').length;
  const runningProjects = projects.filter(p => p.status === 'Running').length;
  const now = new Date();
  const [projectTypes, setProjectTypes] = React.useState<{ id: string; name: string }[]>([]);

  React.useEffect(() => {
    async function fetchTypes() {
      const { data } = await supabase.from('project_types').select('*');
      if (data) setProjectTypes(data);
    }
    fetchTypes();
  }, []);

  const getProjectTypeNames = (projectDescription: string) => {
    if (!projectDescription) return 'No types specified';
    const typeIds = projectDescription.split(',').map(id => id.trim());
    const typeNames = typeIds.map(id => {
      const type = projectTypes.find(t => t.id === id);
      return type ? type.name : `Unknown Type (${id})`;
    });
    return typeNames.join(', ');
  };

  const stats = [
    {
      title: 'Total Revenue',
      value: `LKR ${totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: 'from-emerald-400 to-emerald-600',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'Running Projects',
      value: runningProjects,
      icon: Clock,
      color: 'from-blue-400 to-blue-600',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Completed Projects',
      value: completedProjects,
      icon: CheckCircle,
      color: 'from-green-400 to-green-600',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Total Employees',
      value: employees.length,
      icon: Users,
      color: 'from-purple-400 to-purple-600',
      bgColor: 'bg-purple-500/10',
    },
  ];

  const recentProjects = projects.slice(0, 3);

  // Upcoming deliverables: 3 nearest running projects by deadline (ascending)
  const upcomingProjects = projects
    .filter(p => p.status === 'Running')
    .sort((a, b) => new Date(a.deadlineDate).getTime() - new Date(b.deadlineDate).getTime())
    .slice(0, 3);

  useEffect(() => {
    // Remove overflow:hidden to allow scrolling
    document.body.style.overflow = '';
    return () => {};
  }, []);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#F6E9E9] font-['Playfair_Display']">
          Dashboard Overview
        </h1>
        <div className="text-sm text-[#F6E9E9]/60 font-['Inter']">
          Last update: {now.toLocaleDateString()} {now.toLocaleTimeString()}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <GlassCard key={index} className="p-4 sm:p-6 hover:scale-105 transition-transform duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#F6E9E9]/70 text-sm font-['Inter']">{stat.title}</p>
                  <p className="text-xl sm:text-2xl font-bold text-[#F6E9E9] mt-1 font-['Poppins']">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        <GlassCard className="p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-[#F6E9E9] mb-4 font-['Poppins']">
            Recent Projects
          </h2>
          <div className="space-y-3">
            {recentProjects.map((project) => (
              <div
                key={project.id}
                className="flex flex-col gap-1 p-3 bg-[#232021]/80 rounded-xl border border-[#E16428]/10 hover:border-[#E16428]/30 transition-all duration-300 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#F6E9E9] text-sm truncate max-w-[120px]">{project.clientName}</span>
                  <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    project.status === 'Running'
                      ? 'bg-blue-500/20 text-blue-300'
                      : project.status === 'Delivered'
                      ? 'bg-green-500/20 text-green-300'
                      : project.status === 'Pending'
                      ? 'bg-yellow-500/20 text-yellow-300'
                      : 'bg-red-500/20 text-red-300'
                  }`}>{project.status}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {getProjectTypeNames(project.projectDescription).split(', ').map((type, idx) => (
                    <span key={idx} className="bg-[#E16428]/20 text-[#E16428] rounded-full px-2 py-0.5 text-[10px] font-medium lowercase max-w-[80px] truncate">{type}</span>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[#F6E9E9]/60 text-xs truncate max-w-[100px]">{project.clientUniOrg}</span>
                  <span className="flex items-center gap-1 text-[#F6E9E9]/40 text-[11px] ml-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {new Date(project.deadlineDate).toLocaleDateString()}
                </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Upcoming Project Deliverables */}
        <GlassCard className="p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-[#F6E9E9] mb-4 font-['Poppins']">
            Upcoming Project Deliverables
          </h2>
          <div className="space-y-3">
            {upcomingProjects.length === 0 ? (
              <div className="text-[#F6E9E9]/60 text-sm">No upcoming running projects</div>
            ) : (
              upcomingProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex flex-col gap-1 p-3 bg-[#232021]/80 rounded-xl border border-[#E16428]/10 hover:border-[#E16428]/30 transition-all duration-300 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#F6E9E9] text-sm truncate max-w-[120px]">{project.clientName}</span>
                    <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300`}>Running</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {getProjectTypeNames(project.projectDescription).split(', ').map((type, idx) => (
                      <span key={idx} className="bg-[#E16428]/20 text-[#E16428] rounded-full px-2 py-0.5 text-[10px] font-medium lowercase max-w-[80px] truncate">{type}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[#F6E9E9]/60 text-xs truncate max-w-[100px]">{project.clientUniOrg}</span>
                    <span className="flex items-center gap-1 text-[#F6E9E9]/40 text-[11px] ml-auto">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      {new Date(project.deadlineDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-[#F6E9E9] mb-4 font-['Poppins']">
            Employee Performance
          </h2>
          <div className="space-y-3">
            {employees.slice(0, 5).map((employee) => {
              const employeeProjects = projects.filter(p => p.assignedTo === employee.id);
              const completedCount = employeeProjects.filter(p => p.status === 'Delivered').length;
              
              return (
                <div
                  key={employee.id}
                  className="flex items-center justify-between p-3 bg-[#272121]/30 rounded-lg border border-[#E16428]/10"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[#F6E9E9] font-medium font-['Inter'] truncate">
                      {employee.firstName} {employee.lastName}
                    </p>
                    <p className="text-[#F6E9E9]/70 text-sm truncate">
                      {employee.position}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-[#E16428] font-bold text-sm">
                      {completedCount} completed
                    </p>
                    <p className="text-[#F6E9E9]/70 text-xs">
                      {employeeProjects.length} total
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};