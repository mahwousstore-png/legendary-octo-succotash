# Copilot Instructions for Mahwous Store Management System

## Project Overview

This is a React + TypeScript + Vite application for managing a retail business. The system handles orders, inventory, expenses, employee balances, suppliers, and various business reports. The application uses Supabase as the backend and supports Arabic language with RTL (right-to-left) layout.

## Technology Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Backend**: Supabase (PostgreSQL database with real-time features)
- **Styling**: Tailwind CSS
- **UI Components**: Lucide React for icons
- **State Management**: React hooks (useState, useEffect, custom hooks)
- **Data Fetching**: @tanstack/react-query for async state management
- **Charting**: ECharts for data visualization
- **Export Features**: ExcelJS, jsPDF, html2canvas for reports
- **Authentication**: Custom auth service with Supabase

## Code Style and Conventions

### General Guidelines

- Use TypeScript for all new files with strict type checking enabled
- Use functional components with React hooks exclusively - avoid class components
- Explicitly type component props using interfaces; avoid `React.FC` as it adds unnecessary complexity
- For components without props, no type annotation is needed on the component itself
- Prefer arrow functions for component definitions
- Use named exports for components and utilities
- Keep components focused and single-responsibility

### File Organization

- **Components**: Place in `/components` directory (`.tsx` files)
- **Hooks**: Place in `/hooks` directory (`.ts` files)
- **Utilities**: Place in `/lib` directory (`.ts` files)
- **Types**: Place in `/types` directory (`.ts` files)
- **Naming**: Use PascalCase for components, camelCase for functions/variables

### TypeScript Guidelines

- Always define interfaces for complex data structures
- Use explicit return types for functions
- Avoid using `any` - use proper types or `unknown` if type is truly unknown
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer code
- Define interfaces at the top of component files before the component

### React Patterns

- Use custom hooks for data fetching (e.g., `useExpenses`, `useOrders`)
- Follow the pattern: `const [state, setState] = useState<Type>(initialValue)`
- Use `useEffect` for side effects and always specify dependencies
- Handle loading and error states in data fetching operations
- Use `useMemo` for expensive computations
- Use `useCallback` for callback functions passed to child components
- Component typing pattern:
  ```typescript
  interface MyComponentProps {
    title: string;
    onSave: (data: FormData) => void;
  }
  
  const MyComponent = ({ title, onSave }: MyComponentProps) => {
    // component implementation
  };
  ```

### Supabase Integration

- Import supabase client from `'../lib/supabase'`
- Always handle errors from Supabase queries
- Use `.select('*')` for fetching all columns or specify columns explicitly
- Use `.order()` for sorting results
- Use `.eq()`, `.gte()`, `.lte()` for filtering
- Example pattern:
  ```typescript
  const { data, error } = await supabase
    .from('table_name')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  ```

### Arabic Language and RTL Support

- Use Arabic text for user-facing strings (labels, messages, errors)
- Error messages should be in Arabic: `'حدث خطأ في جلب البيانات'`
- Use `dir="rtl"` for RTL layout where needed
- Date formatting should use Arabic locale: `'ar-SA'` with Gregorian calendar
- Example:
  ```typescript
  const formatter = new Intl.DateTimeFormat('ar-SA', {
    calendar: 'gregory',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  ```

## Business Logic Rules

### Critical: Employee Balances and Expenses

**IMPORTANT**: When working with expenses and employee balances, ensure that:

1. **Expense Deduction from Employee Custody**: When an expense is recorded that should be deducted from an employee's advance/custody balance, the system must:
   - Create a debit transaction in the `employee_balance_transactions` table
   - Link the transaction to the correct employee (`user_id`)
   - Update the employee's current balance accordingly
   - Include proper reference to the expense in the transaction reason

2. **Transaction Types**:
   - `credit`: Adds to employee balance (advances given to employee)
   - `debit`: Deducts from employee balance (expenses paid by employee)

3. **Data Integrity**:
   - Always validate that employee balances don't go negative unexpectedly
   - Maintain audit trail with `created_by` and `transaction_date`
   - Include descriptive `reason` for each transaction

### Authentication

- Use `authService.getCurrentUser()` to get current user
- Check user role for permission-based features
- Roles: `admin`, `user` (regular employee)
- Always verify authentication state before accessing protected features

### Data Validation

- Validate all numeric inputs (amounts, quantities)
- Validate dates before submission
- Validate required fields before form submission
- Show user-friendly error messages in Arabic

## Components Guidelines

### Common Component Patterns

1. **Data Table Components**:
   - Include search, filter, and pagination
   - Support export to Excel and PDF
   - Use consistent styling with Tailwind classes

2. **Modal/Dialog Components**:
   - Use controlled state (`showModal` boolean)
   - Include close button and backdrop
   - Handle Escape key for closing

3. **Form Components**:
   - Use controlled inputs with state
   - Clear form after successful submission
   - Show loading state during submission
   - Display error/success messages using toast notifications

### Styling

- Use Tailwind CSS utility classes
- Follow existing color scheme:
  - Primary: blue shades
  - Success: green shades
  - Danger: red shades
  - Warning: yellow shades
- Maintain consistent spacing and padding
- Use responsive design patterns (`md:`, `lg:` breakpoints)

## State Management

- Use local state (`useState`) for component-specific data
- Use custom hooks for shared data fetching logic
- Use React Query (`@tanstack/react-query`) for server state when available
- Pass data down via props, not global state (except auth state)

## Error Handling

- Always wrap async operations in try-catch blocks
- Set error state and display to user
- Use toast notifications for feedback: `toast.error()`, `toast.success()`
- Log errors to console for debugging in development
- Provide Arabic error messages to users

## Testing

- Write unit tests for utility functions
- Test data transformation logic
- Test form validation logic
- Ensure business logic correctness (especially employee balance calculations)

## Build and Development

- **Dev**: `npm run dev` - Starts Vite dev server
- **Build**: `npm run build` - Type-checks and builds for production
- **Lint**: `npm run lint` - Runs ESLint
- **Type Check**: `npm run typecheck` - Runs TypeScript compiler without emit

## Security Considerations

- Never expose Supabase credentials in client code (use environment variables)
- Validate user permissions on both client and server
- Sanitize user inputs before database operations
- Use Row Level Security (RLS) in Supabase for data protection
- Never store sensitive data in local state or localStorage without encryption

## Export Features

- Use ExcelJS for Excel exports with proper Arabic text support
- Use jsPDF with html2canvas for PDF generation
- Include proper headers and formatting in exports
- Handle RTL text correctly in exports

## Performance

- Use lazy loading for heavy components when appropriate
- Memoize expensive calculations with `useMemo`
- Avoid unnecessary re-renders with `React.memo` and `useCallback`
- Optimize Supabase queries (select only needed columns, use indexes)

## Accessibility

- Use semantic HTML elements
- Include proper ARIA labels for Arabic content
- Ensure keyboard navigation works
- Maintain good color contrast

## Common Pitfalls to Avoid

- Don't mutate state directly - always use setter functions
- Don't forget dependency arrays in `useEffect`
- Don't use indexes as keys in lists - use unique IDs
- Don't forget to handle loading and error states
- Don't bypass TypeScript with `any` type
- Don't forget to update employee balances when recording expenses
- Don't perform client-side operations without proper error handling

## Key Database Tables

- `expenses`: Financial expenses records
- `employee_balance_transactions`: Employee advance/custody transactions
- `user_profiles`: User accounts and roles
- `locked_orders`, `unlocked_orders`, `cancelled_orders`: Order management
- `inventory`: Product inventory
- `suppliers`: Supplier information
- `payment_methods`: Payment method tracking

---

When making changes, always consider:
1. Type safety and TypeScript compliance
2. Arabic language support and RTL layout
3. Business logic correctness (especially financial calculations)
4. User experience and error handling
5. Data integrity and validation
