# API Overview

## Introduction
The Renewable Energy Asset Co-Ownership Platform APIs provide programmatic access to all core platform functionalities.

## Authentication
All APIs require JWT (JSON Web Token) authentication. The token must be included in the `Authorization` header:
```
Authorization: Bearer <token>
```

## Versioning
APIs follow semantic versioning. The current version is v1, accessible via the `/v1` prefix in the URL.

## Rate Limiting
- 1000 requests/hour per IP
- 10000 requests/hour per API token

## Response Format
All responses are in JSON format with the following structure:
```json
{
    "data": {},
    "meta": {
        "timestamp": "2024-04-16T12:00:00Z",
        "version": "v1"
    }
}
```

## Error Handling
Errors follow the format:
```json
{
    "error": {
        "code": "ERROR_CODE",
        "message": "Descriptive error message",
        "details": {}
    }
}
```

## Main Endpoints
- `/projects`: Energy project management
- `/investments`: Investment management
- `/tokens`: Token management
- `/production`: Production monitoring
- `/revenue`: Revenue distribution

## Webhooks
Webhooks available for:
- New investments
- Production updates
- Revenue distributions
- Token transfers

## SDK
SDKs available for:
- JavaScript/TypeScript
- Python
- Java
- Go 