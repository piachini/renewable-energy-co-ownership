# Contributing to Renewable Energy Co-Ownership Platform

Thank you for your interest in contributing to our project! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Development Process

### Branch Strategy
- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: New features
- `bugfix/*`: Bug fixes
- `hotfix/*`: Urgent production fixes
- `release/*`: Release preparation

### Pull Request Process
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Message Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation changes
- style: Code style changes
- refactor: Code refactoring
- test: Adding or modifying tests
- chore: Maintenance tasks

## Development Setup

### Prerequisites
- Node.js v18+
- npm 8+ or yarn 1.22+
- Docker & Docker Compose
- Git

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   # Backend
   cd backend
   npm install

   # Frontend
   cd ../frontend
   npm install

   # Blockchain
   cd ../blockchain
   npm install
   ```

## Testing

### Running Tests
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# Smart contract tests
cd blockchain
npm test
```

### Test Coverage
- Maintain minimum 80% test coverage
- Write tests for new features
- Update tests for bug fixes

## Code Style

### JavaScript/TypeScript
- Follow ESLint configuration
- Use Prettier for formatting
- Maximum line length: 100 characters
- Use meaningful variable names

### Solidity
- Follow Solidity Style Guide
- Maximum line length: 120 characters
- Use NatSpec comments
- Follow security best practices

## Documentation

### Code Documentation
- Use JSDoc for JavaScript/TypeScript
- Use NatSpec for Solidity
- Keep documentation up to date

### API Documentation
- Document all API endpoints
- Include request/response examples
- Document error codes

## Security

### Reporting Security Issues
Please report security issues to security@renewable-energy-platform.com

### Security Guidelines
- Follow security best practices
- Regular security audits
- Dependency updates
- Input validation

## Questions?

Feel free to open an issue or contact the maintainers.
