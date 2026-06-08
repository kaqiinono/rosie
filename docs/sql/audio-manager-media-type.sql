-- Migration: add media_type column to audio_assets and audio_playlist_items
-- Run this after audio-manager-tables.sql

alter table audio_assets
  add column if not exists media_type text not null default 'audio'
  check (media_type in ('audio', 'video'));

alter table audio_playlist_items
  add column if not exists media_type text not null default 'audio'
  check (media_type in ('audio', 'video'));
