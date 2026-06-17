-- Migration: add bonus_percent to products
-- Run this in Supabase SQL Editor

ALTER TABLE products ADD COLUMN IF NOT EXISTS bonus_percent INTEGER DEFAULT NULL;
