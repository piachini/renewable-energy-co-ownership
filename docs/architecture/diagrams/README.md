# Architecture Diagrams

## Overview
This directory contains the architectural diagrams that illustrate various aspects of the system. The diagrams are created using PlantUML and C4 Model to ensure clarity and maintainability.

## Directory Structure

```
diagrams/
├── system/              # High-level system diagrams
├── components/          # Component diagrams
├── sequences/           # Sequence diagrams
├── deployment/          # Deployment diagrams
└── database/           # Database diagrams
```

## System Diagram
![System Diagram](./system/system-overview.png)

The system diagram shows the interaction between main components:
- Next.js Frontend
- Node.js Backend
- Ethereum Smart Contracts
- PostgreSQL Database
- Storage System
- External Services

## Component Diagrams
Component diagrams show:
- Frontend Architecture
- Backend Architecture
- Smart Contracts Structure
- Authentication System
- Token Management System
- Energy Monitoring System

## Sequence Diagrams
Illustrate main flows:
- Investment Process
- Token Distribution
- Production Monitoring
- Revenue Distribution
- KYC Management

## Deployment Diagrams
Show:
- Cloud Infrastructure
- Kubernetes Configuration
- CI/CD Setup
- Monitoring Systems
- Backup and Disaster Recovery

## Database Diagrams
Include:
- ER Schema
- Table Relationships
- Indexes and Optimizations
- Partitions and Sharding

## Conventions
- Use PlantUML for all diagrams
- Follow C4 Model for documentation
- Keep diagrams updated with code
- Include detailed descriptions
- Version diagrams with Git 