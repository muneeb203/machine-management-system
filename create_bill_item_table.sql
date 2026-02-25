-- Create bill_item table manually
-- Run this in your MySQL database

CREATE TABLE IF NOT EXISTS `bill_item` (
  `bill_item_id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `bill_id` INT UNSIGNED NOT NULL,
  `design_no` VARCHAR(100) NULL,
  `item_description` VARCHAR(255) NULL,
  `qty` DECIMAL(14,2) DEFAULT 0,
  `stitches` DECIMAL(18,2) DEFAULT 0,
  `rate_per_unit` DECIMAL(18,6) DEFAULT 0,
  `rate_type` ENUM('HDS','SHEET','FUSING') NOT NULL,
  `amount` DECIMAL(18,2) NOT NULL,
  `formula_details` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_bill_item_bill` FOREIGN KEY (`bill_id`) REFERENCES `bill`(`bill_id`) ON DELETE CASCADE,
  INDEX `idx_bill_id` (`bill_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
