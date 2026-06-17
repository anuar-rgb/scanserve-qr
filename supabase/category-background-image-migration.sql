-- Migration: add background_image_url to categories
-- Run this in Supabase SQL Editor

ALTER TABLE categories ADD COLUMN IF NOT EXISTS background_image_url TEXT;
