# SpinePay Pro Desktop — Project Context

## What this is
Electron desktop app for Walden Bailey Chiropractic, Buffalo NY.
Single-user practice management with voice dictation and HCFA forms.

## Tech Stack
- Electron + Node.js
- SQLite (better-sqlite3)
- Whisper (nodejs-whisper) for offline voice dictation
- electron-builder for Windows .exe installer
- bcrypt for passwords
- node-cron for nightly backups
- archiver for ZIP backups

## Key Paths
- main.js — Electron main process
- src/ — renderer pages
- db-migrations.js — all SQLite table creation
- speech-server.ps1 — Windows SAPI speech (backup approach)
- models/ — Whisper voice model
- assets/ — icons and images
- dist/ — built .exe installer

## Completed Features
- All 12 modules: SOAP Notes, Intake Forms, PI Cases, EOB,
  Waitlist, Time Clock, Billing, Reminders, Referrals,
  Transportation, Scheduling, Patients
- Voice dictation via Whisper (offline, no API needed)
- HCFA/CMS-1500 form generation + print/PDF/fax
- Windows .exe installer with NSIS
- First-run setup wizard (5 steps)
- Auto-updater via electron-updater
- Nightly SQLite backup to ZIP (7 years retention)
- Staff onboarding with HIPAA acknowledgment
- Role-based access (Admin vs Staff)
- bcrypt password hashing

## GitHub
- Repo: blk-gif/spinepay-pro
- Always push to GitHub when done

## Pending
- Prompt 13: Local network multi-user mode

## Node.js Conventions
- Use `const` for all requires and variables that are never reassigned; `let` only when reassignment is needed
- Use `async/await` over raw Promise chains or callbacks
- Handle errors with try/catch in async functions — never swallow errors silently
- Use `'use strict'` at the top of every CommonJS file
- Prefer named functions over anonymous arrow functions for IPC handlers and top-level functions
- Keep IPC handler names namespaced: `resource:action` (e.g. `staff:get-all`, `auth:login`)
- Never put business logic directly in IPC handlers — delegate to helper functions
- Use parameterised queries for all SQLite operations — never string-interpolate user input into SQL
- All passwords hashed with bcryptjs — never SHA256 or plain text
- Environment-specific paths via `app.getPath('userData')` — never hardcode absolute paths
- Log errors with `console.error` including context; use `console.log` with a `[Module]` prefix for info logs

## Design
- Background: #1a1a1a
- Gold: #FFD700
- Electron BrowserWindow with nodeIntegration: true

## Practice Info
- Name: Walden Bailey Chiropractic
- Address: 1086 Walden Ave Suite 1, Buffalo NY 14211
- Phone: (716) 893-9200
- Email: drward@waldenbaileychiropratic.com

## Default Login
- Username: admin
- Password: Admin1234!
