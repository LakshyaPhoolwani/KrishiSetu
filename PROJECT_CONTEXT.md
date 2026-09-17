# Project Context

Project: KrishiSetu

Repository: https://github.com/LakshyaPhoolwani/KrishiSetu

Purpose: AI-powered agricultural market-linkage and price-discovery platform.

Main decision: Optimize for expected net realisation rather than the highest listed price.

Future roles:
- Farmer
- FPO / Cooperative
- Buyer
- Admin
- Quality Assessor
- Logistics Provider
- Payment Provider

Current technology:
- React web
- React Native / Expo mobile
- Node.js + Express backend
- Supabase PostgreSQL
- Prisma
- Clerk authentication and identity mapping
- Farmer, farm, crop, and lot management foundation
- Market and market-price data foundation with deterministic provider normalization
- Buyer and private buyer-demand management foundation
- Deterministic, persisted Net Realisation calculations for farmer-owned lots
- Stateless deterministic Buyer Matching compatibility evaluation
- Backend-only Gemini tool-calling agent over deterministic Phase 1-7 services

Phase 4 architecture:
- Authenticated market and historical market-price read APIs
- Admin-only demo ingestion
- Provider abstraction with explicit LIVE/DEMO source metadata
- INR-per-quintal normalization and source-record idempotency
- Reusable Haversine distance and deterministic price-statistics utilities

Future technology:
- Gemini
- Maps
- Weather
- Payments
- Blockchain audit layer

Important: Phase 0 is foundation only.
