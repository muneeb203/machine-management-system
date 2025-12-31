#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🏭 Embroidery Factory ERP Setup Script');
console.log('=====================================\n');

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 18) {
  console.error('❌ Node.js 18 or higher is required. Current version:', nodeVersion);
  process.exit(1);
}

console.log('✅ Node.js version check passed:', nodeVersion);

// Create necessary directories
const directories = [
  'logs',
  'uploads',
  'backups',
  'src/database/migrations',
];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('📁 Created directory:', dir);
  }
});

// Create .env file if it doesn't exist
if (!fs.existsSync('.env')) {
  fs.copyFileSync('.env.example', '.env');
  console.log('📄 Created .env file from .env.example');
  console.log('⚠️  Please update .env with your database credentials');
}

// Install backend dependencies
console.log('\n📦 Installing backend dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Backend dependencies installed');
} catch (error) {
  console.error('❌ Failed to install backend dependencies');
  process.exit(1);
}

// Install frontend dependencies
console.log('\n📦 Installing frontend dependencies...');
try {
  execSync('cd client && npm install', { stdio: 'inherit' });
  console.log('✅ Frontend dependencies installed');
} catch (error) {
  console.error('❌ Failed to install frontend dependencies');
  process.exit(1);
}

// Create TypeScript configuration for server
const tsConfigServer = {
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "client"]
};

fs.writeFileSync('tsconfig.server.json', JSON.stringify(tsConfigServer, null, 2));
console.log('📄 Created tsconfig.server.json');

// Create client TypeScript configuration
const clientTsConfig = {
  "compilerOptions": {
    "target": "es5",
    "lib": [
      "dom",
      "dom.iterable",
      "es6"
    ],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": [
    "src"
  ]
};

if (!fs.existsSync('client/tsconfig.json')) {
  fs.writeFileSync('client/tsconfig.json', JSON.stringify(clientTsConfig, null, 2));
  console.log('📄 Created client/tsconfig.json');
}

console.log('\n🎉 Setup completed successfully!');
console.log('\n📋 Next Steps:');
console.log('1. Update .env file with your database credentials');
console.log('2. Create PostgreSQL database: embroidery_erp');
console.log('3. Run database migrations: npm run migrate');
console.log('4. Seed initial data: npm run seed');
console.log('5. Start development server: npm run dev');
console.log('\n📚 Documentation:');
console.log('- API Documentation: API_DOCUMENTATION.md');
console.log('- Deployment Guide: DEPLOYMENT.md');
console.log('- Main README: README.md');

console.log('\n🔐 Default Login Credentials:');
console.log('- Admin: admin / admin123');
console.log('- Programmer: programmer1 / prog123');
console.log('- Operator: operator1 / oper123');
console.log('\n⚠️  CHANGE DEFAULT PASSWORDS IN PRODUCTION!');

console.log('\n🌐 Access URLs (after starting):');
console.log('- Backend API: http://localhost:3000');
console.log('- Frontend App: http://localhost:3001');
console.log('- Health Check: http://localhost:3000/health');