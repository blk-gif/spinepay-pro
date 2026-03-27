# SpinePay Pro — Project Context

## What this is
Electron desktop app for Walden Bailey Chiropractic, Buffalo NY.
Practice management system with HIPAA compliance requirements.

## Tech Stack
- Electron + Node.js
- SQLite (better-sqlite3)
- Whisper (nodejs-whisper) for voice dictation
- electron-builder for Windows installer
- bcrypt for password hashing
- node-cron for scheduled backups
- archiver for ZIP backups

## Key paths
- Main process: main.js
- Renderer: src/
- Database: spinepay.db
- Models: models/
- Backups: C:\SpinePayBackups
- Installer output: dist/

## Features built (DO NOT rebuild these)
1. SOAP Notes with Whisper voice dictation
2. CMS-1500 / HCFA form generation + print/PDF/fax
3. Windows installer with setup wizard + auto-updater + nightly backups
4. Intake Forms
5. PI Cases
6. EOB Records
7. Waitlist
8. Time Clock
9. Billing & Claims
10. Reminder Templates
11. Referrals
12. Transportation

## Completed prompts
- Prompt 1: Mic fix, SQLite migrations, voice dictation ✅
- Prompt 2: HCFA form, print/PDF, fax cover sheet ✅
- Prompt 3: Windows installer, setup wizard, auto-updater, backups ✅

## Next prompt
- Prompt 4: Staff onboarding system

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
- Black and gold theme throughout
- Primary gold: #FFD700
- Background: #1a1a1a

## GitHub
- Repo: blk-gif/spinepay-pro
- Always push to GitHub when done

## Practice Info
- Name: Walden Bailey Chiropractic
- Address: 1086 Walden Ave Suite 1, Buffalo NY 14211
- Phone: (716) 893-9200
- Email: drward@waldenbaileychiropratic.com
