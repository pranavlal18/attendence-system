# Task 1: Project Setup Foundation

**Files:**
- Create: `package.json` with initial dependencies
- Create: `tsconfig.json` TypeScript configuration
- Create: `tailwind.config.ts` Tailwind configuration
- Create: `next.config.js` Next.js configuration
- Modify: `app/layout.tsx` root layout with metadata
- Create: `env.d.ts` environment type definitions

**Interfaces:**
- Consumes: None (foundation task)
- Produces: Base project structure

**Steps:**

[ ] **Step 1: Initialize Next.js project with TypeScript**
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir
```
Expected: Project scaffolded with Next.js 14, TypeScript, Tailwind CSS

[ ] **Step 2: Install shadcn/ui dependencies**
```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input select dialog dropdown-menu table tabs scrolling-text-area accordion
```
Expected: shadcn/ui components installed and configured

[ ] **Step 3: Install Supabase dependencies**
```bash
npm install @supabase/supabase-js @supabase/ui
```
Expected: Supabase JavaScript client and UI components

[ ] **Step 4: Install form and validation dependencies**
```bash
npm install react-hook-form zod
npm install -D @types/react-hook-form @types/zod
```
Expected: React Hook Form and Zod for form validation

[ ] **Step 5: Install date utility dependencies**
```bash
npm install date-fns
```
Expected: date-fns for date handling

[ ] **Step 6: Configure Tailwind CSS for shadcn/ui**
Verify `tailwind.config.ts` includes `classNameVariants` and correct content paths

[ ] **Step 7: Create directory structure**
```bash
mkdir -p src/components/{ui,shared,features/{auth,workers,attendance,reports,calendar}}
mkdir -p src/{lib,services,schemas,types}
mkdir -p constants
mkdir -p docs/superpowers/{specs,plans}
```
Expected: All source directories created

[ ] **Step 8: Verify project runs**
```bash
npm run dev
```
Expected: Next.js dev server starts at http://localhost:3000

**Commit:**
```bash
git add .
git commit -m "feat: project setup with Next.js, TypeScript, Tailwind, shadcn/ui, Supabase"
```