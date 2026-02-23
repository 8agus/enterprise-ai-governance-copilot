# Prisma Migration Setup - Complete Summary

## Initial Problem
Running `npx prisma migrate dev --name init` failed with error: "The datasource.url property is required in your Prisma config file"

## Actions Taken & Reasons

### 1. Added datasource block to schema.prisma
- **Reason:** Schema was missing the datasource configuration entirely
- **Action:** Added datasource block with `url = env("DATABASE_URL")`

### 2. Encountered Prisma 7 breaking change (P1012 error)
- **Reason:** Prisma 7.4.1 doesn't support `url` in schema files - requires `prisma.config.ts`
- **Action:** Removed `url` from schema

### 3. Created prisma.config.ts in prisma/ folder
- **Reason:** Attempted to configure database URL via new Prisma 7 config file
- **Action:** Created config with datasources.db.url

### 4. Installed dotenv package
- **Reason:** Config file needed to load .env variables
- **Action:** `npm install dotenv`

### 5. Updated config to use defineConfig
- **Reason:** Tried using Prisma 7's defineConfig helper function
- **Action:** Modified config to import and use defineConfig

### 6. Moved config file to api root directory
- **Reason:** Config file location was incorrect (needed to be at project root, not in prisma/)
- **Action:** `mv prisma/prisma.config.ts .`

### 7. Encountered circular dependency
- **Reason:** defineConfig import failed because Prisma client wasn't generated yet, but client can't generate without config
- **Action:** Removed defineConfig import, simplified to plain object export

### 8. Converted TypeScript to JavaScript
- **Reason:** Config file parsing failed with TypeScript
- **Action:** Renamed to .js and converted to CommonJS syntax

### 9. Config file repeatedly failed to parse
- **Reason:** Prisma 7's config file implementation was problematic

### 10. FINAL SOLUTION: Downgraded to Prisma 6
- **Reason:** Prisma 7 config requirements created insurmountable circular dependencies
- **Action:** `npm install prisma@6 @prisma/client@6`
- **Result:** Reverted to traditional schema-only configuration

### 11. Restored url in schema.prisma
- **Reason:** Prisma 6 requires and supports `url = env("DATABASE_URL")` in schema
- **Action:** Added back datasource url property

### 12. Created PostgreSQL database
- **Reason:** Database didn't exist yet
- **Action:** `psql postgres -c "CREATE DATABASE governance_db;"`

### 13. Fixed DATABASE_URL connection string
- **Reason:** Access denied error - missing username in connection string
- **Action:** Updated from `postgresql://localhost:5432/` to `postgresql://Christiaan@localhost:5432/`

## Current State
✅ **Prisma 6.19.2** installed (downgraded from 7.4.1)  
✅ **schema.prisma** configured with datasource url pointing to env("DATABASE_URL")  
✅ **.env** contains `DATABASE_URL="postgresql://Christiaan@localhost:5432/governance_db?schema=public"`  
✅ **Migration applied** successfully - `20260223073232_init` created  
✅ **Prisma Client generated** and ready to use  
✅ **Database** `governance_db` exists with `AuditRun` table  

## Files Modified
- `/apps/api/prisma/schema.prisma` - Added datasource block with url
- `/apps/api/.env` - Updated DATABASE_URL with username
- `/apps/api/package.json` - Downgraded Prisma packages to v6
- Deleted: `prisma.config.js` (no longer needed with Prisma 6)

## Lessons Learned
- Prisma 7 introduces breaking changes requiring `prisma.config.ts` instead of schema-based URLs
- The Prisma 7 config approach has circular dependency issues during initial setup
- For projects starting fresh, Prisma 6 provides a more stable, straightforward configuration
- PostgreSQL connection strings on macOS require explicit username specification
