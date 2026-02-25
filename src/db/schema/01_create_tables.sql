DROP TABLE IF EXISTS ContractItem;
DROP TABLE IF EXISTS Contract;
GO

-- ================================
-- CONTRACT (ORDER HEADER)
-- ================================
CREATE TABLE Contract (
    ContractID INT IDENTITY(1,1) PRIMARY KEY,
    ContractNo AS (ContractID + 999) PERSISTED UNIQUE,
    ContractDate DATE NOT NULL,
    PONumber VARCHAR(50) NOT NULL
);
GO


-- ================================
-- CONTRACT ITEMS (ORDER LINES)
-- ================================
CREATE TABLE ContractItem (
    ContractItemID INT IDENTITY(1,1) PRIMARY KEY,
    ContractID INT NOT NULL,

    H2H_OGP INT NULL,
    WTE_IGP INT NULL,

    ItemDescription VARCHAR(255) NOT NULL,
    Fabric VARCHAR(100) NOT NULL,
    Color VARCHAR(50) NOT NULL,

    Repeat DECIMAL(10,2) NOT NULL,
    Pieces INT NOT NULL,
    Yard DECIMAL(10,2) NOT NULL,

    CONSTRAINT FK_ContractItem_Contract
        FOREIGN KEY (ContractID)
        REFERENCES Contract(ContractID)
        ON DELETE CASCADE
);
GO
