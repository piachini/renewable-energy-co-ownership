# Database Schema

## Overview
The system uses a multi-database approach to optimally manage different types of data:
- PostgreSQL for relational data
- TimescaleDB for time series data
- Redis for caching
- IPFS for decentralized storage

## Relational Schema (PostgreSQL)

### Users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    wallet_address VARCHAR(42) UNIQUE,
    kyc_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    full_name VARCHAR(255),
    country_code CHAR(2),
    phone VARCHAR(20),
    document_type VARCHAR(20),
    document_number VARCHAR(50),
    verification_date TIMESTAMP WITH TIME ZONE
);
```

### Assets
```sql
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id BIGINT UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    location_lat DECIMAL(10,8),
    location_lon DECIMAL(11,8),
    capacity_kw DECIMAL(10,2),
    asset_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE asset_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id),
    document_type VARCHAR(50),
    ipfs_hash VARCHAR(64),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Investments
```sql
CREATE TABLE investments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    asset_id UUID REFERENCES assets(id),
    amount_tokens DECIMAL(20,8),
    purchase_price DECIMAL(20,8),
    transaction_hash VARCHAR(66),
    invested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE revenue_distributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id),
    period_start DATE,
    period_end DATE,
    total_amount DECIMAL(20,8),
    distribution_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending'
);
```

## Time Series (TimescaleDB)

### Production Data
```sql
CREATE TABLE energy_production (
    time TIMESTAMPTZ NOT NULL,
    asset_id UUID,
    power_kw DECIMAL(10,2),
    voltage DECIMAL(6,2),
    temperature DECIMAL(5,2)
);

SELECT create_hypertable('energy_production', 'time');

CREATE TABLE weather_data (
    time TIMESTAMPTZ NOT NULL,
    asset_id UUID,
    temperature DECIMAL(5,2),
    irradiance DECIMAL(7,2),
    wind_speed DECIMAL(5,2)
);

SELECT create_hypertable('weather_data', 'time');
```

## Cache (Redis)

### Key-Value Structures
```
user:{id}:profile -> JSON user profile data
asset:{id}:details -> JSON asset details
asset:{id}:production:latest -> Latest production data
```

### Lists
```
user:{id}:notifications -> Recent notifications
asset:{id}:events -> Recent asset events
```

### Sorted Sets
```
assets:by-yield -> Sorted set of assets by yield
users:by-investment -> Sorted set of users by investment
```

## Decentralized Storage (IPFS)

### Structure
```
/assets/{asset_id}/
  ├── technical/
  │   ├── specifications.pdf
  │   ├── certificates.pdf
  │   └── permits.pdf
  ├── legal/
  │   ├── contracts.pdf
  │   └── agreements.pdf
  └── media/
      ├── photos/
      └── videos/
```

## Indexes and Constraints

### PostgreSQL
```sql
-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_wallet ON users(wallet_address);

-- Assets
CREATE INDEX idx_assets_location ON assets USING gist (
    ll_to_earth(location_lat, location_lon)
);
CREATE INDEX idx_assets_status ON assets(status);

-- Investments
CREATE INDEX idx_investments_user ON investments(user_id);
CREATE INDEX idx_investments_asset ON investments(asset_id);
```

### TimescaleDB
```sql
-- Automatic partitioning by time is handled by TimescaleDB
CREATE INDEX idx_production_asset_time ON energy_production(asset_id, time DESC);
CREATE INDEX idx_weather_asset_time ON weather_data(asset_id, time DESC);
``` 