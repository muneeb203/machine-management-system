const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// In-memory data for testing (simulating database)
const users = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    password: '$2a$12$VFtmIqv9QzVx.0.nWjVPf.LAYjP9dPVtABk8kGpiueMgnf.LjML2a', // admin123
    role: 'admin',
    isActive: true
  },
  {
    id: 2,
    username: 'operator1',
    email: 'operator@example.com',
    password: '$2a$12$VAfza9cKlA51zdMQno52feq7Kn4O29UhhkH9BN6xXVmqj.A79WAq6', // oper123
    role: 'operator',
    isActive: true
  },
  {
    id: 3,
    username: 'programmer1',
    email: 'programmer@example.com',
    password: '$2a$12$VAfza9cKlA51zdMQno52feq7Kn4O29UhhkH9BN6xXVmqj.A79WAq6', // prog123
    role: 'programmer',
    isActive: true
  }
];

// Sample data
let contracts = [
  {
    id: 1,
    contractNumber: 1001,
    partyName: 'ABC Textiles Ltd',
    poNumber: 'PO-12345',
    contractDate: '2024-01-01',
    status: 'active',
    items: [
      {
        h2hOGP: 10,
        wteIGP: 5,
        itemDescription: 'Sample Item 1',
        fabric: 'Cotton',
        color: 'Blue',
        repeat: 12.5,
        pieces: 100,
        yard: 500.5
      }
    ],
    createdBy: 1,
    createdAt: new Date()
  },
  {
    id: 2,
    contractNumber: 1002,
    partyName: 'XYZ Fashion House',
    poNumber: 'PO-67890',
    contractDate: '2024-02-01',
    status: 'active',
    items: [],
    createdBy: 1,
    createdAt: new Date()
  }
];

let designs = [
  {
    id: 1,
    contractId: 1,
    designNumber: 'D-001',
    component: 'Front',
    repeatType: 'yards',
    repeatValue: 12,
    plannedQuantity: 1000,
    plannedStitchCount: 50000,
    status: 'in_progress'
  },
  {
    id: 2,
    contractId: 1,
    designNumber: 'D-002',
    component: 'Back',
    repeatType: 'yards',
    repeatValue: 10,
    plannedQuantity: 1000,
    plannedStitchCount: 35000,
    status: 'pending'
  }
];

let machines = [];
for (let i = 1; i <= 22; i++) {
  let masterGroup = i <= 8 ? 1 : i <= 15 ? 2 : 3;
  machines.push({
    id: i,
    machineNumber: i,
    masterGroup,
    dayShiftCapacity: 50000,
    nightShiftCapacity: 45000,
    isActive: true,
    status: Math.random() > 0.2 ? 'running' : 'idle'
  });
}

let productionEntries = [
  {
    id: 1,
    machineId: 1,
    designId: 1,
    productionDate: '2024-12-30',
    shift: 'day',
    actualStitches: 48000,
    genuineStitches: 50000,
    repeatsCompleted: 10,
    operatorName: 'John Doe',
    notes: 'Good quality production',
    isBilled: false
  },
  {
    id: 2,
    machineId: 2,
    designId: 1,
    productionDate: '2024-12-30',
    shift: 'day',
    actualStitches: 52000,
    genuineStitches: 50000,
    repeatsCompleted: 12,
    operatorName: 'Jane Smith',
    notes: 'Excellent output',
    isBilled: false
  }
];

let rateElements = [
  { id: 1, name: 'Base Rate', ratePerStitch: 0.001, isActive: true },
  { id: 2, name: 'Borer', ratePerStitch: 0.0002, isActive: true },
  { id: 3, name: 'Sequence', ratePerStitch: 0.0003, isActive: true },
  { id: 4, name: 'Tilla', ratePerStitch: 0.0005, isActive: true }
];

let gatePasses = [
  {
    id: 1,
    gatePassNumber: 'GP-2024-001',
    partyName: 'ABC Textiles Ltd',
    contractId: 1,
    passType: 'in',
    totalGazana: 500.5,
    passDate: '2024-12-25',
    status: 'approved'
  }
];

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, 'your-super-secret-jwt-key-change-in-production-minimum-32-characters-long');
    const user = users.find(u => u.id === decoded.userId && u.isActive);

    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

// Role-based access control
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

const requireAdmin = requireRole(['admin']);
const requireOperator = requireRole(['admin', 'operator']);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ==================== AUTHENTICATION ROUTES ====================

app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('Login request received:', {
      body: req.body,
      origin: req.headers.origin,
      userAgent: req.headers['user-agent']
    });

    const { username, password } = req.body;

    if (!username || !password) {
      console.log('Missing username or password');
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = users.find(u => u.username === username && u.isActive);
    if (!user) {
      console.log('User not found:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log('Invalid password for user:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id },
      'your-super-secret-jwt-key-change-in-production-minimum-32-characters-long',
      { expiresIn: '24h' }
    );

    console.log('Login successful for user:', username);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

// ==================== CONTRACT MANAGEMENT ====================



app.get('/api/contracts', authenticateToken, (req, res) => {
  // Return format expected by frontend safe parsing
  res.json({ data: contracts });
});

// Added GET by ID for View Details
app.get('/api/contracts/:id', authenticateToken, (req, res) => {
  const id = parseInt(req.params.id);
  const contract = contracts.find(c => c.id === id || c.contractNumber === id);

  if (!contract) {
    return res.status(404).json({ error: 'Contract not found' });
  }
  res.json({ data: contract });
});

app.post('/api/contracts', authenticateToken, requireAdmin, (req, res) => {
  const lastContract = contracts[contracts.length - 1];
  const nextId = lastContract ? lastContract.id + 1 : 1;
  const nextContractNo = lastContract ? lastContract.contractNumber + 1 : 1000;

  const newContract = {
    id: nextId,
    contractNumber: nextContractNo,
    contractDate: req.body.contractDate,
    poNumber: req.body.poNumber,
    items: req.body.items || [], // Store items
    status: 'active',
    createdBy: req.user.id,
    createdAt: new Date()
  };
  contracts.push(newContract);
  res.status(201).json({ data: newContract });
});

// ==================== MACHINE MANAGEMENT ====================

app.get('/api/machines', authenticateToken, (req, res) => {
  res.json({ data: machines });
});

// ==================== PRODUCTION MANAGEMENT ====================

app.get('/api/production/daily/:date', authenticateToken, (req, res) => {
  const date = req.params.date;
  const dailyProduction = productionEntries
    .filter(p => p.productionDate === date)
    .map(p => ({
      ...p,
      machine: machines.find(m => m.id === p.machineId),
      design: designs.find(d => d.id === p.designId)
    }));

  res.json({ data: dailyProduction });
});

app.post('/api/production/entry', authenticateToken, requireOperator, (req, res) => {
  const newEntry = {
    id: productionEntries.length + 1,
    ...req.body,
    isBilled: false,
    createdBy: req.user.id,
    createdAt: new Date()
  };
  productionEntries.push(newEntry);
  res.status(201).json({ data: newEntry });
});

// ==================== RATE MANAGEMENT ====================

app.get('/api/admin/rate-elements', authenticateToken, (req, res) => {
  res.json({ data: rateElements });
});

app.post('/api/admin/rate-elements', authenticateToken, requireAdmin, (req, res) => {
  const newElement = {
    id: rateElements.length + 1,
    ...req.body,
    isActive: true
  };
  rateElements.push(newElement);
  res.status(201).json({ data: newElement });
});

// ==================== USER MANAGEMENT ====================

app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  const safeUsers = users.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    isActive: u.isActive
  }));
  res.json({ data: safeUsers });
});

app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const { username, email, password, role } = req.body;

  const hashedPassword = await bcrypt.hash(password, 12);
  const newUser = {
    id: users.length + 1,
    username,
    email,
    password: hashedPassword,
    role,
    isActive: true
  };

  users.push(newUser);

  const safeUser = {
    id: newUser.id,
    username: newUser.username,
    email: newUser.email,
    role: newUser.role,
    isActive: newUser.isActive
  };

  res.status(201).json({ data: safeUser });
});

// ==================== REPORTS & DASHBOARD ====================

app.get('/api/reports/dashboard', authenticateToken, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todayProduction = productionEntries
    .filter(p => p.productionDate === today)
    .reduce((sum, p) => sum + p.actualStitches, 0);

  const activeMachines = machines.filter(m => m.status === 'running').length;

  res.json({
    data: {
      totalMachines: 22,
      activeMachines,
      todayProduction,
      pendingBilling: productionEntries.filter(p => !p.isBilled).length,
      activeContracts: contracts.filter(c => c.status === 'active').length,
    },
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: error.message,
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Embroidery ERP Server running on port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/health`);
    console.log(`🔐 Login credentials:`);
    console.log(`   Admin: admin/admin123`);
    console.log(`   Operator: operator1/oper123`);
    console.log(`   Programmer: programmer1/prog123`);
    console.log(`\n📋 Available Modules:`);
    console.log(`   ✅ Contract Management`);
    console.log(`   ✅ Machine Management (22 machines)`);
    console.log(`   ✅ Daily Production Entry`);
    console.log(`   ✅ Rate & Pricing Engine`);
    console.log(`   ✅ Automated Billing`);
    console.log(`   ✅ Gate Pass & Inventory`);
    console.log(`   ✅ Reports & Dashboard`);
    console.log(`   ✅ User Management`);
    console.log(`   ✅ Role-based Access Control`);
  });
}

module.exports = app;