# REST API

## Overview
This documentation describes the REST APIs available for integration with the energy co-ownership platform. The APIs provide access to all core platform functionalities.

## Base URL
```
https://api.energyco-ownership.com/v1
```

## Authentication
The API uses JWT (JSON Web Token) authentication. Tokens must be included in the HTTP header:
```
Authorization: Bearer <token>
```

## Endpoints

### Projects

#### List Projects
```http
GET /projects
```
**Query Parameters:**
- `status` (optional): Filter by project status (active, funding, completed)
- `page`: Page number
- `limit`: Items per page

**Response:**
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "location": "string",
      "capacity": "number",
      "totalInvestment": "number",
      "currentInvestment": "number",
      "status": "string",
      "createdAt": "string"
    }
  ],
  "pagination": {
    "total": "number",
    "page": "number",
    "limit": "number"
  }
}
```

#### Project Details
```http
GET /projects/{id}
```

### Investments

#### Make Investment
```http
POST /investments
```
**Body:**
```json
{
  "projectId": "string",
  "amount": "number",
  "currency": "string"
}
```

#### List User Investments
```http
GET /investments
```

### Tokens

#### Token Balance
```http
GET /tokens/balance/{address}
```

#### Transfer Tokens
```http
POST /tokens/transfer
```
**Body:**
```json
{
  "to": "string",
  "amount": "number",
  "projectId": "string"
}
```

### Energy Production

#### Production Data
```http
GET /production/{projectId}
```
**Query Parameters:**
- `from`: Start date (YYYY-MM-DD)
- `to`: End date (YYYY-MM-DD)
- `interval`: Aggregation interval (hour, day, month)

### Revenue

#### Revenue Distribution
```http
GET /revenues/{projectId}
```

#### Claim Revenue
```http
POST /revenues/claim
```
**Body:**
```json
{
  "projectId": "string"
}
```

## Error Handling

### Status Codes
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

### Error Format
```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

## Rate Limiting
- 1000 requests/hour per IP
- 10000 requests/hour per API token

## Versioning
API versions are managed through URL prefix (e.g. /v1, /v2).
Previous versions are maintained for 6 months after a new version release.

## Webhooks
Webhooks can be configured to receive notifications for specific events:
- New investments
- Production updates
- Revenue distributions
- Token transfers

### Webhook Configuration
```http
POST /webhooks
```
**Body:**
```json
{
  "url": "string",
  "events": ["string"],
  "secret": "string"
}
```

## SDK
SDKs are available for integration in the following languages:
- JavaScript/TypeScript
- Python
- Java
- Go

## Best Practices
1. Implement retry with exponential backoff
2. Cache responses when possible
3. Use gzip compression
4. Monitor rate limits
5. Handle errors properly

## Support
For technical support:
- Email: api-support@energyco-ownership.com
- Documentation: docs.energyco-ownership.com
- API Status: status.energyco-ownership.com 