# Vercel Deployment Guide

## Important Notes

⚠️ **Database Limitation**: Vercel doesn't support persistent databases. Your PostgreSQL database needs to be hosted elsewhere (like Supabase, Railway, or AWS RDS).

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI**: Install globally with `npm i -g vercel`
3. **External Database**: Set up PostgreSQL on a cloud provider

## Database Setup Options

### Option 1: Supabase (Recommended)
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Get your connection string from Settings > Database
4. Run your schema.sql in the Supabase SQL editor

### Option 2: Railway
1. Go to [railway.app](https://railway.app)
2. Create a PostgreSQL database
3. Get connection details from the dashboard

### Option 3: AWS RDS or other cloud providers

## Deployment Steps

### 1. Prepare Environment Variables

Create a `.env.production` file or set these in Vercel dashboard:

```env
# Database (use your external database)
DB_HOST=your-db-host
DB_PORT=5432
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=your-db-name
DB_SSL=true

# Security
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters
BCRYPT_SALT_ROUNDS=12

# Server
NODE_ENV=production
```

### 2. Deploy to Vercel

#### Option A: Using Vercel CLI
```bash
# Login to Vercel
vercel login

# Deploy from project root
vercel

# Follow the prompts:
# - Link to existing project? No
# - Project name: embroidery-erp
# - Directory: ./
```

#### Option B: Using Git Integration
1. Push your code to GitHub/GitLab/Bitbucket
2. Go to Vercel dashboard
3. Click "New Project"
4. Import your repository
5. Configure build settings:
   - Framework Preset: Other
   - Root Directory: ./
   - Build Command: `cd client && npm run build`
   - Output Directory: `client/build`

### 3. Configure Environment Variables in Vercel

1. Go to your project dashboard on Vercel
2. Navigate to Settings > Environment Variables
3. Add all the environment variables from step 1

### 4. Set up Database

Run your migrations on the external database:
```bash
# Update your knexfile.js to use production database
# Then run migrations
npm run migrate
npm run seed
```

## Limitations & Considerations

### Serverless Limitations
- **Stateless**: No persistent file storage
- **Cold starts**: First request may be slower
- **Execution time**: 30-second limit per request
- **Memory**: Limited memory per function

### Recommended Architecture Changes

1. **File Uploads**: Use cloud storage (AWS S3, Cloudinary)
2. **Background Jobs**: Use external queue service (Vercel doesn't support long-running processes)
3. **Logging**: Use external logging service (Vercel logs are limited)
4. **Sessions**: Use JWT tokens instead of server sessions

## Alternative Deployment Options

If Vercel limitations are too restrictive, consider:

1. **Railway**: Full-stack deployment with database
2. **Render**: Similar to Railway, supports databases
3. **DigitalOcean App Platform**: Full-stack with managed databases
4. **AWS Elastic Beanstalk**: More complex but full-featured
5. **Heroku**: Traditional PaaS (has free tier limitations)

## Testing Your Deployment

1. Check the frontend loads: `https://your-app.vercel.app`
2. Test API endpoints: `https://your-app.vercel.app/api/health`
3. Verify database connectivity
4. Test user authentication
5. Check production data flow

## Troubleshooting

### Common Issues

**Build Failures**
- Check build logs in Vercel dashboard
- Ensure all dependencies are in package.json
- Verify build commands are correct

**API Errors**
- Check function logs in Vercel dashboard
- Verify environment variables are set
- Test database connectivity

**Database Connection Issues**
- Ensure SSL is enabled for external databases
- Check connection string format
- Verify firewall/security group settings

## Monitoring

- Use Vercel Analytics for frontend performance
- Set up external monitoring for API endpoints
- Monitor database performance on your database provider
- Consider adding error tracking (Sentry, Bugsnag)