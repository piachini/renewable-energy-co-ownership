# System Architecture

## Overview
The system architecture of the Renewable Energy Co-Ownership Platform is designed to be scalable, secure, and easily maintainable. The system uses a microservices architecture that integrates blockchain technologies with traditional web services.

## Main Components

### Frontend
- **Framework**: Next.js 14
- **State Management**: Redux Toolkit
- **UI Components**: Tailwind CSS, Headless UI
- **Web3 Integration**: ethers.js
- **Testing**: Jest, React Testing Library

### Backend
- **Runtime**: Node.js
- **API Framework**: Express.js
- **Authentication**: JWT, OAuth 2.0
- **Validation**: Zod
- **Testing**: Jest, Supertest

### Blockchain
- **Network**: Ethereum (Sepolia Testnet, Mainnet)
- **Smart Contracts**: Solidity
- **Development Framework**: Hardhat
- **Testing**: Waffle, Ethers.js

### Database
- **Primary Database**: PostgreSQL
- **Caching**: Redis
- **ORM**: Prisma
- **Migrations**: Prisma Migrate

### Infrastructure
- **Containerization**: Docker
- **Orchestration**: Kubernetes
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus, Grafana
- **Logging**: ELK Stack

## Diagrams
Detailed architecture diagrams are available in the `/diagrams` directory:
- Component Diagram
- Sequence Diagram
- Database ER Diagram
- Deployment Diagram

## API
Detailed API documentation is available in the `/api` directory:
- REST API
- GraphQL Schema
- WebSocket Endpoints

## Smart Contracts
Smart contract documentation is available in the `/smart-contracts` directory:
- Core Contracts
- Libraries
- Interfaces

## Database Schema
Detailed database schema is available in the `/database` directory:
- Models
- Relationships
- Indexes
- Procedures

## 📂 Directory Structure
```
/docs/architecture/
├── diagrams/       # Architecture diagrams
├── smart-contracts/# Smart contracts documentation
├── database/       # Database schema
└── api/           # API specifications
```

## 🔗 Useful Links
- [Architecture Diagram](./diagrams/high-level-architecture.md)
- [Microservices Structure](./diagrams/microservices.md)
- [Database Schema](./database/schema.md)
- [API Documentation](./api/README.md)
- [Smart Contracts](./smart-contracts/README.md) 