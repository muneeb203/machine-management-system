-- ================================
-- MACHINE MANAGEMENT
-- ================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Machine' and xtype='U')
BEGIN
    CREATE TABLE Machine (
        MachineID INT IDENTITY(1,1) PRIMARY KEY,
        MachineNumber INT NOT NULL UNIQUE,
        MasterName VARCHAR(100) NOT NULL, -- Changed from MasterGroup INT
        Status VARCHAR(20) NOT NULL DEFAULT 'idle', -- 'running', 'idle', 'maintenance', 'stopped'
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE()
    );
END
ELSE
BEGIN
    -- Migration check: if MasterGroup exists, rename/change it.
    -- Ideally, we'd use a separate migration file, but for this dev environment we can just alter if needed
    -- or assume this script is for initialization. 
    -- Adding a simple check to Add MasterName if missing (for dev safety)
    IF NOT EXISTS (SELECT * FROM syscolumns WHERE id=object_id('Machine') AND name='MasterName')
    BEGIN
        ALTER TABLE Machine ADD MasterName VARCHAR(100) NULL;
        -- We might need to drop MasterGroup column if this was a production migration, 
        -- but avoiding destructive actions in this simple script unless necessary for new deployment.
    END
END
GO
