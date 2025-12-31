# Embroidery Factory ERP System

A production-grade ERP system designed to completely replace Excel workflows in an embroidery factory with 22 machines. This system digitizes contracts, programming, daily production, billing, inventory (gazana), gate passes, and reconciliation with strict data integrity and automated billing.

## 🎯 Business Problem Solved

**Before:** Manual Excel tracking across multiple files, daily copy-paste operations, manual billing calculations, inventory tracking in separate sheets, no audit trail, prone to human error.

**After:** Unified digital system with automated billing, real-time inventory tracking, complete audit trail, role-based access control, and elimination of all Excel dependencies.

## 🏭 Core Business Workflow (Enforced)

```
Contract → Programmer → Production → Gate Pass → Billing → Reconciliation
```

**No shortcuts allowed. Each step must be completed before proceeding to the next.**

## 🚀 Key Features

### 1. Contract Management
- Digital contract creation with party details
- Design management with component tracking
- Rate element selection with snapshot preservation
- Contract status tracking and lifecycle management

### 2. Rate Engine (Critical)
- Stitch-based billing calculation
- Base rate + additional elements (Borer, Sequence, Tilla)
- Admin-only rate configuration
- Automatic billing generation: `Actual Stitches × Effective Rate`

### 3. Daily Production Module
- Fast bulk entry for all 22 machines
- Day/night shift tracking
- Multiple designs per machine per day
- Automatic billing record creation
- Real-time production monitoring

### 4. Manual Stitch Override (Audited)
- Override actual stitch counts with mandatory reason
- Full audit trail with user and timestamp
- Automatic billing recalculation
- Cannot override approved billing records

### 5. Automated Billing Engine
- 100% automated - no manual billing entry
- Daily billing per machine and shift
- Immutable records after approval
- Monthly totals and summaries

### 6. Gate Pass & Inventory (Gazana)
- Material tracking in yards (gazana)
- IN/OUT movement tracking
- Gate pass finalization triggers billing completion
- Real-time inventory balance calculation

### 7. Reconciliation & Audit
- Production vs shipment comparison
- Discrepancy flagging and resolution
- Complete audit trail for all changes
- Override tracking and reporting

## 🛠 Tech Stack

### Backend
- **Node.js 18+** with Express and TypeScript
- **PostgreSQL 14+** with ACID compliance
- **JWT Authentication** with role-based access
- **Knex.js** for database operations and migrations
- **Winston** for structured logging

### Frontend
- **React 18** with TypeScript
- **Material-UI (MUI)** for professional UI components
- **React Query** for server state management
- **React Router** for navigation
- **Axios** for API communication

### Security & Compliance
- **bcrypt** password hashing
- **Helmet.js** security headers
- **CORS** configuration
- **Input validation** with Joi
- **SQL injection** prevention
- **Audit logging** for all changes

## 📊 System Architecture

### Database Design
- **Normalized relational schema** with proper foreign keys
- **Audit triggers** for automatic change logging
- **Soft delete** policy (no hard deletion)
- **Immutable billing** records after approval
- **Indexed columns** for performance

### API Design
- **RESTful endpoints** with consistent responses
- **Role-based authorization** middleware
- **Input validation** on all endpoints
- **Error handling** with proper HTTP status codes
- **Pagination** for large datasets

### Business Logic
- **Service layer** for complex operations
- **Transaction management** for data integrity
- **Rate calculation engine** with snapshot preservation
- **Automatic billing** generation and recalculation

## 🔐 User Roles & Permissions

| Role | Permissions |
|------|-------------|
| **Admin** | Full system access, rate management, user management, billing approval |
| **Programmer** | Contract/design management, programming assignments, production planning |
| **Operator** | Daily production entry, stitch overrides, production data access |
| **Inventory Clerk** | Gate pass management, inventory tracking, finalization |
| **Auditor** | Read-only access to all data, audit trails, reports |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Git

### Installation
```bash
# Clone repository
git clone <repository-url>
cd embroidery-erp

# Run setup script
node setup.js

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Create database
createdb embroidery_erp

# Run migrations and seed data
npm run migrate
npm run seed

# Start development servers
npm run dev
```

### Access the System
- **Backend API:** http://localhost:3000
- **Frontend App:** http://localhost:3001
- **Health Check:** http://localhost:3000/health

### Default Login Credentials
- **Admin:** admin / admin123
- **Programmer:** programmer1 / prog123
- **Operator:** operator1 / oper123

**⚠️ CHANGE DEFAULT PASSWORDS IN PRODUCTION!**

## 📚 Documentation

- **[API Documentation](API_DOCUMENTATION.md)** - Complete API reference
- **[Business Rules](BUSINESS_RULES.md)** - Detailed business logic and validation
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment instructions

## 🧪 Testing & Validation

### Acceptance Criteria ✅
- [x] Billing auto-calculates correctly from stitches + rate elements
- [x] Manual stitch override recalculates billing and logs audit
- [x] Gate Pass finalization triggers billing
- [x] System flags production vs shipment mismatches
- [x] Multiple designs per machine per day supported
- [x] No Excel dependency remains

### Data Integrity ✅
- [x] All changes logged in audit trail
- [x] Soft delete only (no hard deletion)
- [x] Immutable billing records after approval
- [x] Foreign key constraints enforced
- [x] Input validation on all endpoints

## 📈 Production Readiness

### Performance
- Connection pooling for database
- Indexed queries for fast searches
- Bulk operations for daily entry
- Optimized React components

### Security
- JWT token authentication
- Password hashing with bcrypt
- Input sanitization and validation
- SQL injection prevention
- HTTPS enforcement in production

### Monitoring
- Structured logging with Winston
- Health check endpoints
- Error tracking and reporting
- Performance metrics

### Backup & Recovery
- Automated daily backups
- Point-in-time recovery
- Data export capabilities
- Audit trail preservation

## 🔄 Migration from Excel

The system includes tools to import existing Excel data:

1. **Contract Import** - Map Excel columns to contract fields
2. **Production History** - Import historical production data
3. **Rate Configuration** - Set up existing rate structures
4. **Validation** - Verify data integrity before import

## 🎯 Business Impact

### Efficiency Gains
- **Eliminate daily copy-paste** operations
- **Reduce billing errors** through automation
- **Real-time inventory** tracking
- **Instant reporting** and analytics

### Compliance & Audit
- **Complete audit trail** for all operations
- **Immutable billing** records
- **User access tracking**
- **Data integrity** enforcement

### Scalability
- **Handle increased production** volume
- **Support additional machines**
- **Multi-shift operations**
- **Historical data retention**

## 🛡 Absolute Constraints

- ❌ **No manual billing entry** - All billing is automated
- ❌ **No data deletion** - Soft delete only with audit trail
- ❌ **No silent overrides** - All changes logged and audited
- ❌ **No Excel dependency** - Complete digital transformation
- ❌ **No shortcuts** - Mandatory workflow enforcement

## 📞 Support

For technical support, deployment assistance, or customization requests:

- **Documentation:** Check the docs folder for detailed guides
- **Issues:** Use GitHub issues for bug reports
- **Features:** Submit feature requests with business justification

---

**Built for production use in real embroidery factories. Handles real money, real production data, and real business operations.**