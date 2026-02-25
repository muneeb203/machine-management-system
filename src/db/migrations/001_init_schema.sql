-- ================================
-- CONTRACT (ORDER HEADER)
-- ================================
CREATE TABLE Contract (
    ContractID INT AUTO_INCREMENT PRIMARY KEY,
    -- MySQL cannot use AUTO_INCREMENT in Generated Columns. 
    -- Application must calculate this (e.g. Max(ID)+1000) or update after insert.
    -- For now, defined as standard unique int.
    ContractNo INT NOT NULL UNIQUE, 
    ContractDate DATE NOT NULL,
    PONumber VARCHAR(50) NOT NULL
);

-- ================================
-- CONTRACT ITEMS (ORDER LINES)
-- ================================
CREATE TABLE ContractItem (
    ContractItemID INT AUTO_INCREMENT PRIMARY KEY,
    ContractID INT NOT NULL,

    H2H_OGP INT NULL,
    WTE_IGP INT NULL,

    ItemDescription VARCHAR(255) NOT NULL,
    Fabric VARCHAR(100) NOT NULL,
    Color VARCHAR(50) NOT NULL,

    `Repeat` DECIMAL(10,2) NOT NULL, -- "Repeat" is a reserved keyword in MySQL
    Pieces INT NOT NULL,
    Yard DECIMAL(10,2) NOT NULL,

    CONSTRAINT FK_ContractItem_Contract
        FOREIGN KEY (ContractID)
        REFERENCES Contract(ContractID)
        ON DELETE CASCADE
);
