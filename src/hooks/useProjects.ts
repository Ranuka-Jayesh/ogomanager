import { useState, useEffect } from 'react';
import { Project } from '../types';
import { supabase } from '../supabaseClient';
import {
  parseEmployeePayments,
  toEmployeePaymentsJson,
  totalEmployeePaymentAmount,
  syncProjectEmployeePayments,
  fetchEmployeePaymentsByProject,
  attachEmployeePaymentsToProjectRows,
} from '../utils/employeePayments';

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const toNumber = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const p = parseFloat(value);
      return isNaN(p) ? 0 : p;
    }
    return 0;
  };

  const mapProjectFromDB = (project: any): Project => {
    const employeePayments = parseEmployeePayments(project.employee_payments);
    return {
      id: String(project.id),
      projectId: project.project_id,
      clientName: project.client_name,
      clientUniOrg: project.client_uni_org,
      projectDescription: project.project_description,
      deadlineDate: project.deadline_date,
      price: toNumber(project.price),
      advance: toNumber(project.advance),
      balance: toNumber(project.balance),
      assignedTo: project.assigned_to || '',
      paymentOfEmp:
        employeePayments.length > 0
          ? totalEmployeePaymentAmount(employeePayments)
          : Math.abs(toNumber(project.payment_of_emp)),
      employeePayments,
      status: project.status,
      fastDeliver: project.fast_deliver || false,
      giveDiscount: project.give_discount || false,
      discountAmount: toNumber(project.discount_amount),
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    };
  };

  const mapProjectToDB = (project: Omit<Project, 'id'>) => {
    const employeePayments = parseEmployeePayments(project.employeePayments);
    const paymentOfEmp =
      employeePayments.length > 0
        ? totalEmployeePaymentAmount(employeePayments)
        : Math.abs(project.paymentOfEmp || 0);
    return {
      project_id: project.projectId,
      client_name: project.clientName,
      client_uni_org: project.clientUniOrg,
      project_description: project.projectDescription,
      deadline_date: project.deadlineDate,
      price: project.price,
      advance: project.advance,
      balance: project.balance,
      assigned_to: project.assignedTo || null,
      payment_of_emp: paymentOfEmp,
      employee_payments: toEmployeePaymentsJson(employeePayments),
      status: project.status,
      fast_deliver: project.fastDeliver || false,
      give_discount: project.giveDiscount || false,
      discount_amount: project.giveDiscount ? (project.discountAmount || 0) : 0,
    };
  };

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

      const paymentsByProject = await fetchEmployeePaymentsByProject();
      const enriched = attachEmployeePaymentsToProjectRows(data || [], paymentsByProject);
      setProjects(enriched.map(mapProjectFromDB));
    } catch (err) {
      console.error('Error in fetchProjects:', err);
      setError('Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const addProject = async (project: Omit<Project, 'id'>) => {
    try {
      setError(null);
      const projectData = mapProjectToDB(project);

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

      await syncProjectEmployeePayments(data.id, parseEmployeePayments(project.employeePayments));
      const paymentsByProject = await fetchEmployeePaymentsByProject();
      const [enriched] = attachEmployeePaymentsToProjectRows([data], paymentsByProject);
      setProjects(prev => [mapProjectFromDB(enriched), ...prev]);
    } catch (err) {
      console.error('Error in addProject:', err);
      setError('Failed to add project');
    }
  };

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
      if (updates.balance !== undefined && updates.balance !== null) {
        updateData.balance = updates.balance;
      }
      if (updates.assignedTo !== undefined) updateData.assigned_to = updates.assignedTo || null;
      if (updates.paymentOfEmp !== undefined || updates.employeePayments !== undefined) {
        const payments = parseEmployeePayments(updates.employeePayments);
        updateData.payment_of_emp =
          payments.length > 0
            ? totalEmployeePaymentAmount(payments)
            : Math.abs(updates.paymentOfEmp ?? 0);
        updateData.employee_payments = toEmployeePaymentsJson(payments);
      }
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.fastDeliver !== undefined) updateData.fast_deliver = updates.fastDeliver;
      if (updates.giveDiscount !== undefined) updateData.give_discount = updates.giveDiscount;
      if (updates.discountAmount !== undefined) {
        updateData.discount_amount = updates.giveDiscount === false ? 0 : updates.discountAmount;
      }

      const { data, error: updateError } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating project:', updateError);
        setError(`Failed to update project: ${updateError.message || 'Unknown error'}`);
        return;
      }

      if (updates.employeePayments !== undefined) {
        await syncProjectEmployeePayments(id, parseEmployeePayments(updates.employeePayments));
      }
      const paymentsByProject = await fetchEmployeePaymentsByProject();
      const [enriched] = attachEmployeePaymentsToProjectRows([data], paymentsByProject);
      const updatedProject = mapProjectFromDB(enriched);
      setProjects(prev => prev.map(project => (project.id === id ? updatedProject : project)));
    } catch (err) {
      console.error('Error in updateProject:', err);
      setError('Failed to update project');
    }
  };

  const deleteProject = async (id: string) => {
    try {
      setError(null);

      const { error: deleteError } = await supabase.from('projects').delete().eq('id', id);

      if (deleteError) {
        console.error('Error deleting project:', deleteError);
        setError('Failed to delete project');
        return;
      }

      setProjects(prev => prev.filter(project => project.id !== id));
    } catch (err) {
      console.error('Error in deleteProject:', err);
      setError('Failed to delete project');
    }
  };

  useEffect(() => {
    fetchProjects();

    const channel = supabase.channel('projects_changes');

    return () => {
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
