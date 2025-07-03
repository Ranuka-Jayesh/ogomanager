import { useState, useEffect } from 'react';
import { Project } from '../types';
import { supabase } from '../supabaseClient';

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Map database row to Project object
  const mapProjectFromDB = (project: any): Project => ({
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
  });

  // Map Project object to database row
  const mapProjectToDB = (project: Omit<Project, 'id'>) => ({
    project_id: project.projectId,
    client_name: project.clientName,
    client_uni_org: project.clientUniOrg,
    project_description: project.projectDescription,
    deadline_date: project.deadlineDate,
    price: project.price,
    advance: project.advance,
    assigned_to: project.assignedTo || null,
    payment_of_emp: project.paymentOfEmp,
    status: project.status,
    fast_deliver: (project as any).fastDeliver || false,
  });

  // Fetch all projects from database
  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching projects:', fetchError);
        setError('Failed to fetch projects');
        return;
      }

      const mappedProjects = (data || []).map(mapProjectFromDB);
      setProjects(mappedProjects);
      console.log('Fetched projects:', mappedProjects);
    } catch (err) {
      console.error('Error in fetchProjects:', err);
      setError('Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  // Add new project to database
  const addProject = async (project: Omit<Project, 'id'>) => {
    try {
      setError(null);
      
      const projectData = mapProjectToDB(project);
      
      // Debug: Log the assignedTo field being saved
      console.log('Saving project to database with assigned_to:', projectData.assigned_to);
      console.log('Original project assignedTo:', project.assignedTo);

      const { data, error: insertError } = await supabase
        .from('projects')
        .insert([projectData])
        .select()
        .single();

      if (insertError) {
        console.error('Error adding project:', insertError);
        setError('Failed to add project');
        return;
      }

      const newProject = mapProjectFromDB(data);
      setProjects(prev => [newProject, ...prev]);
      console.log('Added new project:', newProject);
    } catch (err) {
      console.error('Error in addProject:', err);
      setError('Failed to add project');
    }
  };

  // Update project in database
  const updateProject = async (id: string, updates: Partial<Project>) => {
    try {
      setError(null);
      
      const updateData: any = {};
      if (updates.projectId !== undefined) updateData.project_id = updates.projectId;
      if (updates.clientName !== undefined) updateData.client_name = updates.clientName;
      if (updates.clientUniOrg !== undefined) updateData.client_uni_org = updates.clientUniOrg;
      if (updates.projectDescription !== undefined) updateData.project_description = updates.projectDescription;
      if (updates.deadlineDate !== undefined) updateData.deadline_date = updates.deadlineDate;
      if (updates.price !== undefined) updateData.price = updates.price;
      if (updates.advance !== undefined) updateData.advance = updates.advance;
      if (updates.assignedTo !== undefined) updateData.assigned_to = updates.assignedTo || null;
      if (updates.paymentOfEmp !== undefined) updateData.payment_of_emp = updates.paymentOfEmp;
      if (updates.status !== undefined) updateData.status = updates.status;
      if ((updates as any).fastDeliver !== undefined) updateData.fast_deliver = (updates as any).fastDeliver;

      const { data, error: updateError } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating project:', updateError);
        setError('Failed to update project');
        return;
      }

      const updatedProject = mapProjectFromDB(data);
      setProjects(prev => 
        prev.map(project => 
          project.id === id ? updatedProject : project
        )
      );
      console.log('Updated project:', updatedProject);
    } catch (err) {
      console.error('Error in updateProject:', err);
      setError('Failed to update project');
    }
  };

  // Delete project from database
  const deleteProject = async (id: string) => {
    try {
      setError(null);
      
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error deleting project:', deleteError);
        setError('Failed to delete project');
        return;
      }

      setProjects(prev => prev.filter(project => project.id !== id));
      console.log('Deleted project with ID:', id);
    } catch (err) {
      console.error('Error in deleteProject:', err);
      setError('Failed to delete project');
    }
  };

  // Set up real-time subscriptions
  useEffect(() => {
    fetchProjects();

    // Create a single channel instance
    const channel = supabase.channel('projects_changes');
    
    // Subscribe to real-time changes

    // Cleanup subscription on unmount
    return () => {
      console.log('Cleaning up projects subscription');
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    projects,
    loading,
    error,
    addProject,
    updateProject,
    deleteProject,
    refetch: fetchProjects,
  };
};