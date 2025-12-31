# Embroidery Factory ERP - Deployment Guide

## System Requirements

### Database
- PostgreSQL 12+ (recommended: PostgreSQL 14+)
- Minimum 4GB RAM for database server
- SSD storage recommended for performance

### Backend Server
- Node.js 18+ 
- Minimum 2GB RAM
- Linux/Windows Server

### Frontend
- Modern web browser (Chrome, Firefox, Safari, Edge)
- No additional client-side requirements

## Installation Steps

### 1. Database Setup

```sql
-- Create database and user
CREATE DATABASE embroidery_erp;
CREATE USER erp_user WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE embroidery_erp TO erp_user;
```

### 2. Backend Setup

```bash
# Clone and install dependencies
git clone <repository-url>
cd embroidery-erp
npm install

# Environment configuration
cp .env.example .env
# Edit .env with your database credentials and settings

# Run database migrations and seeds
npm run migrate
npm run seed

# Build and start production server
npm run build
npm start
```

### 3. Frontend Setup

```bash
# Install and build frontend
cd client
npm install
npm run build

# Serve static files (configure your web server)
# Files will be in client/build/
```

## Environment Variables

### Required Variables
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=erp_user
DB_PASSWORD=secure_password_here
DB_NAME=embroidery_erp

# Security
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters
BCRYPT_SALT_ROUNDS=12

# Server
PORT=3000
NODE_ENV=production
```

## Security Considerations

### Database Security
- Use strong passwords for database users
- Enable SSL connections in production
- Regular database backups
- Restrict database access to application servers only

### Application Security
- Change default JWT secret
- Use HTTPS in production
- Configure proper CORS origins
- Regular security updates

### User Management
- Default admin credentials: admin/admin123
- **CHANGE DEFAULT PASSWORDS IMMEDIATELY**
- Implement strong password policies
- Regular user access reviews

## Backup Strategy

### Database Backups
```bash
# Daily automated backup
pg_dump -h localhost -U erp_user embroidery_erp > backup_$(date +%Y%m%d).sql

# Restore from backup
psql -h localhost -U erp_user embroidery_erp < backup_20241230.sql
```

### Application Backups
- Source code in version control
- Environment configuration files
- Log files for audit purposes

## Monitoring

### Application Logs
- Location: `logs/app.log` and `logs/error.log`
- Rotation: 5MB files, keep 5 versions
- Monitor for errors and performance issues

### Database Monitoring
- Connection pool usage
- Query performance
- Storage usage
- Backup completion

### Key Metrics to Monitor
- Daily production entries
- Billing record generation
- User login patterns
- System response times

## Maintenance

### Regular Tasks
- Database maintenance (VACUUM, ANALYZE)
- Log file cleanup
- Security updates
- User access reviews

### Monthly Tasks
- Full database backup verification
- Performance review
- Audit log analysis
- System capacity planning

## Troubleshooting

### Common Issues

**Database Connection Errors**
- Check database server status
- Verify connection credentials
- Check network connectivity

**Authentication Issues**
- Verify JWT secret configuration
- Check user account status
- Review password requirements

**Performance Issues**
- Monitor database query performance
- Check server resource usage
- Review application logs

### Support Contacts
- System Administrator: [admin-email]
- Database Administrator: [dba-email]
- Application Support: [support-email]

## Scaling Considerations

### Horizontal Scaling
- Load balancer for multiple app servers
- Database read replicas for reporting
- CDN for static assets

### Vertical Scaling
- Increase server RAM for better performance
- SSD storage for database
- CPU scaling for concurrent users

## Compliance & Audit

### Data Retention
- Production data: 7 years minimum
- Audit logs: 3 years minimum
- Backup retention: 1 year minimum

### Audit Requirements
- All data changes logged
- User access tracking
- Billing record immutability
- Regular compliance reviews