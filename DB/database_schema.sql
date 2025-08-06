    -- OGO Manager Database Schema
    -- This file contains all the table schemas for the OGO Technology project management system

    -- Enable UUID extension for PostgreSQL
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- =====================================================
    -- EMPLOYEES TABLE
    -- =====================================================
    CREATE TABLE employees (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        employee_id VARCHAR(50) NOT NULL UNIQUE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        birthday DATE,
        position VARCHAR(100),
        address TEXT,
        whatsapp VARCHAR(20),
        email VARCHAR(255),
        qualifications TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- =====================================================
    -- PROJECTS TABLE
    -- =====================================================
    CREATE TABLE projects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id VARCHAR(50) NOT NULL UNIQUE,
        client_name VARCHAR(255) NOT NULL,
        client_uni_org VARCHAR(255),
        project_description TEXT,
        deadline_date DATE,
        price DECIMAL(10,2) DEFAULT 0,
        advance DECIMAL(10,2) DEFAULT 0,
        assigned_to UUID REFERENCES employees(id),
        payment_of_emp DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Running', 'Pending', 'Delivered', 'Correction', 'Rejected')),
        fast_deliver BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- =====================================================
    -- PROJECT_TYPES TABLE
    -- =====================================================
    CREATE TABLE project_types (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- =====================================================
    -- ADMIN TABLE
    -- =====================================================
    CREATE TABLE admin (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- =====================================================
    -- LOG TABLE
    -- =====================================================
    CREATE TABLE log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        admin_id UUID REFERENCES admin(id),
        admin_email VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- =====================================================
    -- INDEXES FOR BETTER PERFORMANCE
    -- =====================================================

    -- Employees indexes
    CREATE INDEX idx_employees_employee_id ON employees(employee_id);
    CREATE INDEX idx_employees_email ON employees(email);
    CREATE INDEX idx_employees_created_at ON employees(created_at);

    -- Projects indexes
    CREATE INDEX idx_projects_project_id ON projects(project_id);
    CREATE INDEX idx_projects_status ON projects(status);
    CREATE INDEX idx_projects_assigned_to ON projects(assigned_to);
    CREATE INDEX idx_projects_deadline_date ON projects(deadline_date);
    CREATE INDEX idx_projects_created_at ON projects(created_at);

    -- Project types indexes
    CREATE INDEX idx_project_types_name ON project_types(name);

    -- Admin indexes
    CREATE INDEX idx_admin_email ON admin(email);

    -- Log indexes
    CREATE INDEX idx_log_admin_id ON log(admin_id);
    CREATE INDEX idx_log_action ON log(action);
    CREATE INDEX idx_log_created_at ON log(created_at);

    -- =====================================================
    -- TRIGGERS FOR UPDATED_AT TIMESTAMPS
    -- =====================================================

    -- Function to update updated_at timestamp
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- Triggers for updated_at
    CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_project_types_updated_at BEFORE UPDATE ON project_types
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_admin_updated_at BEFORE UPDATE ON admin
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    -- =====================================================
    -- SAMPLE DATA INSERTION (OPTIONAL)
    -- =====================================================

    -- Insert sample admin user
    INSERT INTO admin (email, password) VALUES 
    ('admin@ogotechnology.com', 'admin123');

    -- Insert sample project types
    INSERT INTO project_types (name) VALUES 
    ('Web Development'),
    ('Mobile App Development'),
    ('UI/UX Design'),
    ('Digital Marketing'),
    ('SEO Optimization'),
    ('Content Creation'),
    ('Graphic Design'),
    ('Video Production');

    -- Insert sample employees
    INSERT INTO employees (employee_id, first_name, last_name, birthday, position, address, whatsapp, email, qualifications) VALUES 
    ('EMP001', 'John', 'Doe', '1990-05-15', 'Senior Developer', '123 Main St, Colombo', '+94751234567', 'john.doe@ogo.com', 'BSc Computer Science, 5 years experience'),
    ('EMP002', 'Jane', 'Smith', '1988-08-22', 'UI/UX Designer', '456 Oak Ave, Kandy', '+94759876543', 'jane.smith@ogo.com', 'BDes Graphic Design, 3 years experience'),
    ('EMP003', 'Mike', 'Johnson', '1992-03-10', 'Project Manager', '789 Pine Rd, Galle', '+94751122334', 'mike.johnson@ogo.com', 'MBA, PMP Certified, 4 years experience');

    -- Insert sample projects
    INSERT INTO projects (project_id, client_name, client_uni_org, project_description, deadline_date, price, advance, assigned_to, payment_of_emp, status) VALUES 
    ('PRJ001', 'TechCorp Solutions', 'TechCorp Ltd', 'E-commerce website development with payment integration', '2024-02-15', 50000.00, 15000.00, (SELECT id FROM employees WHERE employee_id = 'EMP001'), 8000.00, 'Running'),
    ('PRJ002', 'Green Energy Co', 'Green Energy Ltd', 'Mobile app for energy monitoring and management', '2024-03-20', 75000.00, 25000.00, (SELECT id FROM employees WHERE employee_id = 'EMP002'), 12000.00, 'Pending'),
    ('PRJ003', 'EduTech Institute', 'EduTech Foundation', 'Learning management system with video streaming', '2024-01-30', 100000.00, 30000.00, (SELECT id FROM employees WHERE employee_id = 'EMP003'), 15000.00, 'Delivered');

    -- =====================================================
    -- COMMENTS
    -- =====================================================

    COMMENT ON TABLE employees IS 'Stores employee information for the OGO Technology team';
    COMMENT ON TABLE projects IS 'Stores project information and assignments';
    COMMENT ON TABLE project_types IS 'Stores different types of projects that can be created';
    COMMENT ON TABLE admin IS 'Stores admin user credentials for system access';
    COMMENT ON TABLE log IS 'Stores system activity logs for audit purposes';

    COMMENT ON COLUMN employees.employee_id IS 'Unique employee identifier';
    COMMENT ON COLUMN employees.whatsapp IS 'WhatsApp contact number';
    COMMENT ON COLUMN projects.project_id IS 'Unique project identifier';
    COMMENT ON COLUMN projects.assigned_to IS 'Reference to employee assigned to this project';
    COMMENT ON COLUMN projects.status IS 'Current status of the project';
    COMMENT ON COLUMN projects.fast_deliver IS 'Flag for expedited delivery';
    COMMENT ON COLUMN log.action IS 'Type of action performed (login_success, login_fail, export_success, etc.)'; 