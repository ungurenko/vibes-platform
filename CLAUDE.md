# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VIBES is a Russian-language Learning Management System (LMS) for teaching "Vibe Coding" (AI-assisted web development). The platform features student learning paths, administrative dashboards, and an integrated AI assistant.

## Build and Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Vite, port 3000)
npm run build        # Production build
npm run preview      # Preview production build
```

No test framework is currently configured. Testing is manual.

## Environment Variables

Create `.env` from `.env.example`:
```
VITE_SUPABASE_URL=<supabase_project_url>
VITE_SUPABASE_ANON_KEY=<supabase_anon_key>
OPENROUTER_API_KEY=<openrouter_api_key>
```

## Architecture

### Tech Stack
- **Frontend**: React 19, TypeScript 5.8, Tailwind CSS (CDN)
- **Build**: Vite 6
- **Backend**: Supabase (auth, PostgreSQL, RLS)
- **AI**: OpenRouter API via Vercel serverless (`/api/chat.js`)
- **Hosting**: Vercel

### Routing
Client-side routing via `activeTab` state in `App.tsx`. No React Router - navigation uses a `TabId` string type. To add a new route:
1. Add TabId to `types.ts`
2. Create view component in `views/`
3. Register in `App.tsx` render logic

### State Management
- React hooks + Context API (`SoundContext.tsx`)
- LocalStorage for persistence (with quota handling)
- No external state library

### Data Flow
1. `App.tsx` is the root - handles auth, fetches initial data
2. Data passed to views via props
3. Supabase for persistence (profiles, progress, content, invites, calls)
4. Falls back to mock data (`data.ts`) when Supabase unavailable

### Key Files
- `App.tsx` - Root component with auth, routing, data management (519 lines)
- `types.ts` - TypeScript interfaces for all data models
- `data.ts` - Mock data and constants (49KB)
- `lib/supabase.ts` - Supabase client and helper functions
- `api/chat.js` - Vercel serverless function for AI chat
- `components/Shared.tsx` - Reusable UI components
- `components/Sidebar.tsx` - Navigation and theme toggle

### Views Structure
- Student views: `Home`, `Lessons`, `Roadmaps`, `StyleLibrary`, `PromptBase`, `Glossary`, `Assistant`, `UserProfile`
- Auth views: `Login`, `Register`, `Onboarding`
- Admin views: `AdminDashboard`, `AdminStudents`, `AdminContent`, `AdminCalls`, `AdminAssistant`, `AdminSettings`

## Database Schema (Supabase)

Main tables with RLS enabled:
- `profiles` - User data (name, email, role, avatar, is_banned)
- `user_progress` - Lesson completion tracking by user_id
- `app_content` - Dynamic content as JSON blobs by key
- `invites` - Registration invite tokens
- `calls` - Meeting schedules

## Known Issues

See `refactoring-plan.md` for detailed bug list. Key issues:
- Progress calculation uses hardcoded lesson count at `App.tsx:77`
- Large view components need splitting (AdminContent.tsx is 106KB)
- Some handlers are empty stubs (marked in refactoring plan)
- No automated tests

## Deployment

Vercel handles deployment. `vercel.json` configures SPA routing. Environment variables must be set in Vercel dashboard.

## Language

All UI text is in Russian. No i18n library - strings are hardcoded in components.
