# Wachsen

Wachsen is a comprehensive, exam preparation and revision platform. Designed to help students plan schedules, execute exam-taking sessions, scan physical questions, generate conceptual flashcards via AI, and track revision logs all in one place.
***Powered By Mesh API***

## Core Features

- **Exam Planner & Dashboard**: Features robust calendar schedules (daily, weekly, monthly, and mentor timelines) for tracking upcoming tasks.
- **Dynamic Font & Theme Engine**: Supports responsive clamp-based typography scaling and a dark/light visual toggle.
- **Physical Document Scanner**: Decodes and scans question sheets using integrated PDF.js rendering.
- **AI Tutoring & Evaluations**: Leverages Mesh LLM Chat Completions to evaluate subjective answers and resolve conceptual doubts.
- **Interactive Concept Cards**: Dynamically generates and formats study flashcards for topic revision.
- **Premium Subscription & Payments**: Multi-tier billing flows (Lite, Rise, Peak) configured with Razorpay API endpoints.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, TypeScript, TanStack Query, Recharts, Lucide Icons, MathJax (math typesetting).
- **Backend API**: Express (Node.js) server.
- **Database & Auth**: Supabase (Postgres tables, schema validation, avatar storage bucket).

## Getting Started

### 1. Prerequisites
Ensure you have Node.js installed on your system.

### 2. Installation
Install the project dependencies using npm:
```bash
npm install
```

### 3. Environment Setup
Duplicate the `.env.example` file in the root directory, rename it to `.env`, and provide your own credentials:
```bash
cp .env.example .env
```

### 4. Running the Project
The project uses concurrent client and server tasks. You can run them locally:

- **Frontend Dev Client** (Vite server running on port 3000):
  ```bash
  npm run dev
  ```

- **Backend Express Server**:
  ```bash
  npm run api
  ```
  or
  ```bash
  node server.js
  ```

## Environment Configuration

| Variable Name | Description | Source |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | The public URL endpoint for your Supabase project instance. | Supabase Dashboard |
| `VITE_SUPABASE_ANON_KEY` | Anonymous public API access key for client authentication. | Supabase Dashboard |
| `SUPABASE_PROJECT_ID` | Project reference ID for Supabase services. | Supabase Dashboard |
| `MESH_API_KEY` | Secret access token for AI Chat Completion model endpoints. | Mesh API Console |
| `MESH_API_URL` | Chat completions endpoint URL. | Mesh API Console |
| `MESH_MODEL` | The default text completion model (e.g. Gemini 2.5 flash). | Mesh API Console |
| `VITE_RAZORPAY_KEY_ID` | Client-side publishable key for loading the checkout script. | Razorpay Dashboard |
| `RAZORPAY_KEY_ID` | Server-side Razorpay merchant key identifier. | Razorpay Dashboard |
| `RAZORPAY_KEY_SECRET` | Secret api credential token for backend signature verification. | Razorpay Dashboard |
