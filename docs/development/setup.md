# Development Environment Setup

## Prerequisites
- Node.js v18+
- Docker and Docker Compose
- Git
- VS Code (recommended)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/renewable-energy-co-ownership.git
cd renewable-energy-co-ownership
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit the .env file with your configurations
```

4. Start Docker services:
```bash
docker-compose up -d
```

## Project Structure
```
.
├── backend/           # Backend application
├── frontend/         # Frontend application
├── blockchain/       # Smart contracts
├── docs/            # Documentation
└── scripts/         # Utility scripts
```

## Useful Commands

### Development
```bash
# Start backend in development mode
cd backend
npm run dev

# Start frontend in development mode
cd frontend
npm run dev

# Run tests
npm run test

# Run linting
npm run lint
```

### Blockchain
```bash
# Compile contracts
cd blockchain
npm run compile

# Run contract tests
npm run test

# Deploy to local network
npm run deploy:local
```

## VS Code Configuration
1. Install recommended extensions:
   - ESLint
   - Prettier
   - Solidity
   - Docker

2. Configure settings:
```json
{
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.codeActionsOnSave": {
        "source.fixAll.eslint": true
    }
}
```

## Troubleshooting

### Common Issues
1. **Docker won't start**
   - Verify Docker is running
   - Check logs with `docker-compose logs`

2. **Compilation errors**
   - Run `npm install` in each directory
   - Verify Node.js versions

3. **Database connection issues**
   - Verify credentials in `.env`
   - Check if PostgreSQL is running

## Support
For technical issues:
- Create a GitHub issue
- Contact the team on Discord
- Consult the documentation 