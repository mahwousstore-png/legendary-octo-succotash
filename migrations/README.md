# Database Migrations

This folder contains SQL migration scripts for database schema updates.

## How to Apply Migrations

### Using Supabase SQL Editor

1. Log in to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy the contents of the migration file
4. Paste and execute in the SQL Editor

### Migration Files

- `001_add_custody_fields.sql` - Adds fields for expense-custody integration and custody confirmation workflow

## Migration: 001_add_custody_fields.sql

This migration adds the following features:

### Expenses Table Updates
- `user_id` - Links expense to the employee who made it
- `balance_transaction_id` - Links to the custody transaction when expense is deducted from custody
- `deducted_from_custody` - Flag indicating if expense was deducted from employee custody

### Employee Balance Transactions Table Updates
- `status` - Transaction status (pending, confirmed, rejected)
- `confirmed_at` - Timestamp when employee confirmed the custody receipt
- `confirmed_by` - Reference to who confirmed the transaction

### Indexes
- Added indexes on frequently queried columns for better performance

### Data Migration
- Sets existing transactions to 'confirmed' status to maintain backward compatibility
