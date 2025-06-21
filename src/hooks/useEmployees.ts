import { useState, useEffect } from 'react';
import { Employee } from '../types';
import { supabase } from '../supabaseClient';

export const useEmployees = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all employees from database
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching employees:', fetchError);
        setError('Failed to fetch employees');
        return;
      }

      // Map snake_case to camelCase
      const mappedEmployees = (data || []).map(employee => ({
        id: employee.id,
        employeeId: employee.employee_id,
        birthday: employee.birthday,
        firstName: employee.first_name,
        lastName: employee.last_name,
        position: employee.position,
        address: employee.address,
        whatsappNumber: employee.whatsapp,
        emailAddress: employee.email,
        qualifications: employee.qualifications,
        createdAt: employee.created_at,
      }));

      setEmployees(mappedEmployees);
      console.log('Fetched employees:', mappedEmployees);
    } catch (err) {
      console.error('Error in fetchEmployees:', err);
      setError('Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  // Add new employee to database
  const addEmployee = async (employee: Omit<Employee, 'id'>) => {
    try {
      setError(null);
      
      // Map camelCase to snake_case for database
      const employeeData = {
        employee_id: employee.employeeId,
        birthday: employee.birthday,
        first_name: employee.firstName,
        last_name: employee.lastName,
        position: employee.position,
        address: employee.address,
        whatsapp: employee.whatsappNumber,
        email: employee.emailAddress,
        qualifications: employee.qualifications,
      };

      const { data, error: insertError } = await supabase
        .from('employees')
        .insert([employeeData])
        .select()
        .single();

      if (insertError) {
        console.error('Error adding employee:', insertError);
        setError('Failed to add employee');
        return;
      }

      // Map the returned data to camelCase
      const newEmployee: Employee = {
        id: data.id,
        employeeId: data.employee_id,
        birthday: data.birthday,
        firstName: data.first_name,
        lastName: data.last_name,
        position: data.position,
        address: data.address,
        whatsappNumber: data.whatsapp,
        emailAddress: data.email,
        qualifications: data.qualifications,
        createdAt: data.created_at,
      };

      setEmployees(prev => [newEmployee, ...prev]);
      console.log('Added new employee:', newEmployee);
    } catch (err) {
      console.error('Error in addEmployee:', err);
      setError('Failed to add employee');
    }
  };

  // Update employee in database
  const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    try {
      setError(null);
      
      // Map camelCase to snake_case for database
      const updateData: any = {};
      if (updates.employeeId !== undefined) updateData.employee_id = updates.employeeId;
      if (updates.birthday !== undefined) updateData.birthday = updates.birthday;
      if (updates.firstName !== undefined) updateData.first_name = updates.firstName;
      if (updates.lastName !== undefined) updateData.last_name = updates.lastName;
      if (updates.position !== undefined) updateData.position = updates.position;
      if (updates.address !== undefined) updateData.address = updates.address;
      if (updates.whatsappNumber !== undefined) updateData.whatsapp = updates.whatsappNumber;
      if (updates.emailAddress !== undefined) updateData.email = updates.emailAddress;
      if (updates.qualifications !== undefined) updateData.qualifications = updates.qualifications;

      const { data, error: updateError } = await supabase
        .from('employees')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating employee:', updateError);
        setError('Failed to update employee');
        return;
      }

      // Map the returned data to camelCase
      const updatedEmployee: Employee = {
        id: data.id,
        employeeId: data.employee_id,
        birthday: data.birthday,
        firstName: data.first_name,
        lastName: data.last_name,
        position: data.position,
        address: data.address,
        whatsappNumber: data.whatsapp,
        emailAddress: data.email,
        qualifications: data.qualifications,
        createdAt: data.created_at,
      };

    setEmployees(prev => 
      prev.map(employee => 
          employee.id === id ? updatedEmployee : employee
        )
      );
      console.log('Updated employee:', updatedEmployee);
    } catch (err) {
      console.error('Error in updateEmployee:', err);
      setError('Failed to update employee');
    }
  };

  // Delete employee from database
  const deleteEmployee = async (id: string) => {
    try {
      setError(null);
      
      const { error: deleteError } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error deleting employee:', deleteError);
        setError('Failed to delete employee');
        return;
      }

    setEmployees(prev => prev.filter(employee => employee.id !== id));
      console.log('Deleted employee with ID:', id);
    } catch (err) {
      console.error('Error in deleteEmployee:', err);
      setError('Failed to delete employee');
    }
  };

  // Fetch employees on component mount
  useEffect(() => {
    fetchEmployees();
  }, []);

  return {
    employees,
    loading,
    error,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    refetch: fetchEmployees,
  };
};