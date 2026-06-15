# Document Verification Portal (DVP)

A cloud-native web application for secure document upload, verification, and status tracking. Upload identity documents (Aadhaar, PAN, Passport, etc.), and the system validates, processes OCR, and tracks verification status using AWS services.

---

## Table of Contents

1. [Flow Explanation](#1-flow-explanation-laymans-terms)
2. [Architecture Overview](#2-architecture-overview)
3. [Project Structure](#3-project-structure)
4. [Prerequisites](#4-prerequisites)
5. [Setup & Running](#5-setup--running)
6. [API Reference](#6-api-reference)
7. [Frontend Pages](#7-frontend-pages)
8. [How to Use the Application](#8-how-to-use-the-application)
9. [AWS Infrastructure](#9-aws-infrastructure)
10. [Local Development with Floci](#10-local-development-with-floci)
11. [Kubernetes Deployment](#11-kubernetes-deployment)
12. [Environment Variables](#12-environment-variables)

---

## 1. Flow Explanation

Think of the system like a **digital document checking office** with multiple departments. Here's how every piece fits together, step by step:

### The Big Picture

```
                     ┌─────────────────────────────────────────────────────────┐
                     │                 DOCUMENT VERIFICATION PORTAL              │
                     │                                                         │
  ┌──────┐          ┌▼────────┐     ┌───────────┐     ┌──────────────────┐    │
  │ You  │ ────────▶│  Website │────▶│  Backend  │────▶│   Database       │    │
  │(User)│          │(Next.js)│     │ (NestJS)  │     │  (PostgreSQL)    │    │
  └──────┘          └─────────┘     └─────┬─────┘     └──────────────────┘    │
                                          │                                    │
                                  ┌───────▼────────┐                          │
                                  │   AWS Cloud     │                          │
                                  │  (or Floci)     │                          │
                                  │                 │                          │
                                  │  ┌───────────┐  │                          │
                                  │  │ S3 Storage │  │  ┌──────────────────┐  │
                                  │  │ (File Box) │  │  │   OCR Worker     │  │
                                  │  └─────┬─────┘  │  │  (Python/FastAPI) │  │
                                  │        │        │  └────────┬─────────┘  │
                                  │  ┌─────▼─────┐  │           │           │
                                  │  │ EventBridge│◀─┘           │           │
                                  │  │ (Post Office)│           │           │
                                  │  └───────────┘              │           │
                                  │        │                    │           │
                                  │  ┌─────▼─────┐              │           │
                                  │  │ EKS/K8s   │──────────────┘           │
                                  │  │ (Factory) │                           │
                                  │  └───────────┘                           │
                                  └─────────────────────────────────────────┘
```

### Step-by-Step Flow

#### Step 1: User Signs Up

| What happens | Plain English |
|---|---|
| You open the website and click "Register" | Like creating an account on any website |
| You enter your name, email, and password | Your password is scrambled (hashed) so even we can't read it |
| The system gives you a **JWT token** | Like a digital ID card — you show this with every request to prove who you are |

#### Step 2: User Uploads a Document (3-Step Process)

| What happens | Plain English |
|---|---|
| You select document type (Aadhaar, PAN, etc.) and pick a file | Like choosing a category before uploading |
| You click "Upload" | The system asks "Where should I store this?" |
| **Step 2a** — The frontend sends the file to `POST /api/documents/upload` as multipart/form-data | Sends the file to the backend along with the document type |
| **Step 2b** — The backend uploads the file to S3 using the AWS SDK (`s3.service.ts`) | Backend puts the file into the S3 file cabinet directly (no CORS issues since this is server-to-server) |
| **Step 2c** — The backend fires a **DocumentUploaded** event via **EventBridgeService** | EventBridge is like a post office — it sends a notification saying "New document arrived!" to whoever is listening |
| **Step 2d** — The backend directly calls the **OCR Worker** at `http://worker:8000/process` with the document details | Like a manager walking over to the factory floor and saying "Here's a new document, start working on it" |

> **Production note:** In production with real AWS S3, the frontend would use the presigned URL flow (`upload-url` → PUT to S3 → `confirm-upload`) to avoid routing large files through the backend. CORS is configured on the real S3 bucket.

#### Step 3: Document is Processed

| What happens | Plain English |
|---|---|
| The **OCR Worker** (`worker/main.py`) receives the processing request | Like a factory worker getting handed a new item |
| The worker downloads the file from S3 using the `s3Key` | Takes the document out of the file cabinet |
| Runs **Tesseract OCR** (text recognition) | Like a machine that reads the document and types out all the text |
| Uses **document-type extractors** (regex patterns) to find specific fields: | Like filling out a form by finding the right boxes: |
| &nbsp;&nbsp;• For **Aadhaar**: finds the 12-digit number, name, DOB | |
| &nbsp;&nbsp;• For **PAN**: finds the 10-char alphanumeric PAN number | |
| &nbsp;&nbsp;• For **Passport**: finds the passport number | |
| Posts extracted data back via `PATCH /api/documents/:id/ocr` | Tells the backend "I found these details in the document" |
| Backend stores OCR data (transitions to `OCR_COMPLETED`), copies to S3 processed bucket, then auto-transitions to `REVIEW_PENDING` | Files the extracted information and marks it ready for human review |
| Fires **OCRCompleted** event | Sends a message: "OCR is done! Ready for human review." |

#### Step 4: Admin Reviews the Document

| What happens | Plain English |
|---|---|
| Admin logs into the **Admin Dashboard** (`frontend/app/admin/page.tsx`) | Like a manager logging into their review panel |
| Sees all documents with **REVIEW_PENDING** status | A queue of items waiting for approval |
| Opens a document, compares original vs. OCR data | Checks if the machine read the document correctly |
| Clicks **Approve** or **Reject** (with optional remarks) | Makes a decision |
| Status changes to **APPROVED** or **REJECTED** | The document's final status is set |
| Fires **VerificationCompleted** event | Notifies everyone: "This document has been decided!" |

#### Step 5: User Checks Status

| What happens | Plain English |
|---|---|
| User visits **Dashboard** or **Status page** | Logs in and checks their documents |
| Sees a color-coded badge: | |
| &nbsp;&nbsp;🟢 **APPROVED** — Green (all good!) | |
| &nbsp;&nbsp;🔴 **REJECTED** — Red (needs attention) | |
| &nbsp;&nbsp;🟡 **PROCESSING** — Yellow (being worked on) | |
| Every status change is logged in **audit_logs** | Like a security camera recording every action taken |

### The Status Workflow

```
UPLOADED ──► OCR_COMPLETED ──► REVIEW_PENDING ──► APPROVED
                                              └──► REJECTED
   ↑               ↑                   ↑
Upload done     OCR finishes        Admin reviews
+ confirmed     extracting text     and decides
```

### Where AWS Services Fit In (and What Floci Does)

| AWS Service | Real world | Floci replacement |
|---|---|---|
| **S3** | Amazon's file storage in the cloud | Floci pretends to be S3 on your computer |
| **EventBridge** | Amazon's event post office | Floci pretends to be EventBridge |
| **API Gateway** | The front door for API calls | Floci pretends to be API Gateway |
| **Lambda** | Runs code without servers | Floci can run Lambda functions too |
| **EKS** | Amazon's Kubernetes (container factory) | Floci emulates EKS for local testing |
| **RDS** | Amazon's PostgreSQL database | We use real PostgreSQL (Docker) for reliability |
| **IAM** | Amazon's identity system (who can do what) | Floci pretends to be IAM |

### Local vs. Production

When running **locally** (Docker Compose):
- Floci emulates all AWS services on `localhost:4566`
- PostgreSQL runs in a Docker container
- The backend runs as a standard HTTP server
- The OCR worker runs as a Docker container

When running in **production** (real AWS):
- Floci is replaced by real AWS services
- The backend runs as a Lambda function behind API Gateway
- The OCR worker runs on EKS pods
- RDS PostgreSQL is used for the database
- S3, EventBridge, IAM are all real AWS services

---

## 2. Architecture Overview

### High-Level Architecture (PRD Section 8)

```
Frontend (React/Next.js :3000)
    │
    ▼
API Gateway / Backend (NestJS :4000)
    │
    ├──► RDS (PostgreSQL :5432) — Metadata storage
    │
User Upload
    │
    ▼
S3 Bucket (dvp-documents-raw) — File storage
    │
    ▼
EventBridge — Event-driven workflow
    │
    ▼
EKS Worker Pods — OCR Processing
    │
    ├──► Tesseract OCR — Text extraction
    │
    ▼
RDS Update — Status & extracted data
```

### Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 16.2.9 + TypeScript + Tailwind CSS | User interface |
| **Backend API** | NestJS 11 + TypeScript | REST API server |
| **Database** | PostgreSQL 16 | Metadata, users, documents, audit |
| **OCR Worker** | Python 3.12 + FastAPI + Tesseract | Document text extraction |
| **Local AWS** | Floci (Docker) | S3, EventBridge, IAM, API Gateway emulation |
| **Orchestration** | Docker Compose / Kubernetes | Container management |
| **Auth** | JWT + bcryptjs | Authentication & authorization |

---

## 3. Project Structure

```
document-verification-portal/
│
├── .env                          # Root environment variables (docker-compose auto-loads this)
├── .gitignore
├── docker-compose.yml            # Local dev stack: Floci + Postgres + Backend + Worker + Frontend
├── README.md                     # This file
│
├── env/                          # Per-service environment files (secrets)
│   ├── floci.env
│   ├── floci-init.env
│   ├── postgres.env
│   ├── backend.env
│   ├── worker.env
│   └── frontend.env
│
├── backend/                      # NestJS API Server
│   ├── src/
│   │   ├── main.ts               # HTTP server entry point (local dev)
│   │   ├── handler.ts             # Lambda handler (serverless deployment)
│   │   ├── app.module.ts          # Root module (imports all features)
│   │   │
│   │   ├── auth/                  # FR1: Authentication
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.service.ts    # Register/login with JWT + bcrypt
│   │   │   ├── auth.controller.ts # POST /api/auth/register, /api/auth/login
│   │   │   ├── jwt.strategy.ts    # Passport JWT validation
│   │   │   ├── jwt-auth.guard.ts  # Auth guard for protected routes
│   │   │   └── dto/
│   │   │       ├── register.dto.ts
│   │   │       └── login.dto.ts
│   │   │
│   │   ├── documents/             # FR2+3: Document Upload & Status
│   │   │   ├── documents.module.ts
│   │   │   ├── documents.service.ts   # S3 presigned URLs + EventBridge events
│   │   │   ├── documents.controller.ts
│   │   │   └── dto/
│   │   │       ├── upload-url.dto.ts
│   │   │       └── update-ocr.dto.ts
│   │   │
│   │   ├── admin/                 # FR5: Admin Review
│   │   │   ├── admin.module.ts
│   │   │   ├── admin.service.ts   # Approve/reject with EventBridge events
│   │   │   ├── admin.controller.ts
│   │   │   └── dto/
│   │   │       └── review.dto.ts
│   │   │
│   │   ├── audit/                 # FR6: Audit Trail
│   │   │   ├── audit.module.ts
│   │   │   └── audit.service.ts   # Immutable action logging
│   │   │
│   │   ├── notifications/         # FR7: Notifications
│   │   │   ├── notifications.module.ts
│   │   │   └── notifications.service.ts  # Event-driven notifications
│   │   │
│   │   ├── common/
│   │   │   ├── aws/               # AWS Service Clients
│   │   │   │   ├── aws.module.ts
│   │   │   │   ├── s3.service.ts        # Presigned URLs, S3 operations
│   │   │   │   ├── eventbridge.service.ts  # Event publishing
│   │   │   │   └── index.ts
│   │   │   ├── enums/             # Shared enums
│   │   │   │   ├── role.enum.ts         # USER, ADMIN, SUPER_ADMIN
│   │   │   │   ├── document-type.enum.ts  # AADHAAR, PAN, PASSPORT, etc.
│   │   │   │   ├── document-status.enum.ts # UPLOADED, APPROVED, etc.
│   │   │   │   └── index.ts
│   │   │   ├── roles.decorator.ts # @Roles() decorator for RBAC
│   │   │   └── roles.guard.ts     # Role-based access guard
│   │   │
│   │   └── database/
│   │       ├── database.module.ts # TypeORM + PostgreSQL config
│   │       └── entities/
│   │           ├── user.entity.ts      # Users table
│   │           ├── document.entity.ts  # Documents table
│   │           ├── audit-log.entity.ts # Audit logs table
│   │           └── index.ts
│   │
│   ├── scripts/
│   │   └── init-floci.sh          # Floci init: S3 buckets, EventBridge, IAM
│   ├── serverless.yml             # Serverless Framework config (Lambda + API Gateway)
│   ├── Dockerfile                 # Production Docker image
│   ├── Dockerfile.lambda          # Lambda-optimized Docker image
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                       # Standalone dev environment
│
├── frontend/                      # Next.js Application
│   ├── app/
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Redirects to /login or /dashboard
│   │   ├── login/page.tsx         # Sign in form
│   │   ├── register/page.tsx      # Registration form
│   │   ├── dashboard/page.tsx     # Document list with status badges
│   │   ├── upload/page.tsx        # Document upload form
│   │   ├── status/page.tsx        # Check status by document ID
│   │   ├── documents/[id]/page.tsx # Document detail with OCR data
│   │   └── admin/page.tsx         # Admin review dashboard
│   ├── components/
│   │   ├── StatusBadge.tsx        # Color-coded status pill
│   │   ├── OcrViewer.tsx          # OCR key-value display
│   │   ├── UploadWidget.tsx       # Reusable upload form
│   │   └── AuditTimeline.tsx      # Vertical timeline component
│   ├── lib/
│   │   └── api.ts                 # Typed API client with JWT auth
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── postcss.config.mjs
│   └── .env.local                 # Standalone dev environment
│
├── worker/                        # Python OCR Worker
│   ├── main.py                    # FastAPI app with document extractors
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env
│
├── floci/
│   └── application.yml            # Floci config: services, storage, init hooks
│
├── k8s/                           # Kubernetes Manifests
│   ├── namespace.yaml             # dvp namespace
│   ├── ocr-worker.yaml            # Deployment + Service + HPA
│   ├── rbac.yaml                  # ServiceAccount + Role + RoleBinding
│   └── backend-service.yaml       # Backend ClusterIP service
│
└── iam/                           # IAM Role Definitions
    ├── lambda-role.json           # LambdaRole: S3 + EventBridge + RDS + Logs
    ├── eks-worker-role.json       # EKSWorkerRole: S3 read + EKS access
    └── s3-access-role.json        # S3AccessRole: Cross-account S3 access
```

---

## 4. Prerequisites

- **Docker** & **Docker Compose** — for running the full stack locally
- **Node.js 22+** — for standalone backend/frontend development
- **Python 3.12+** — for standalone OCR worker development
- **AWS CLI** — for interacting with Floci (optional, used by init scripts)
- **kubectl** — for Kubernetes deployment (optional, production only)

---

## 5. Setup & Running

### Option A: Full Stack with Docker Compose (Recommended)

This runs everything — Floci, PostgreSQL, Backend, Worker, and Frontend — in containers.

```bash
# 1. Clone the repository
git clone <repo-url>
cd document-verification-portal

# 2. Start all services
docker compose up -d

# 3. Watch the initialization
docker compose logs -f floci-init

# 4. Check that everything is running
docker compose ps

# 5. Access the application
#    Frontend: http://localhost:3000
#    Backend:  http://localhost:4000/api
#    Floci:    http://localhost:4566

# 6. Stop everything
docker compose down

# 7. Stop and delete volumes (reset all data)
docker compose down -v
```

After starting, the **floci-init** service automatically creates:
- S3 buckets: `dvp-documents-raw`, `dvp-documents-processed`
- EventBridge rules: `dvp-document-uploaded`, `dvp-ocr-completed`, `dvp-verification-completed`
- IAM roles: `LambdaRole`, `EKSWorkerRole`, `S3AccessRole`

### Option B: Standalone Development (Faster Iteration)

Run each service individually for faster development cycles.

**Terminal 1 — PostgreSQL:**
```bash
docker run -d --name dvp-postgres \
  -e POSTGRES_DB=dvp_db \
  -e POSTGRES_USER=dvp_user \
  -e POSTGRES_PASSWORD=dvp_pass \
  -p 5432:5432 \
  postgres:16-alpine
```

**Terminal 2 — Floci (AWS Emulator):**
```bash
docker run -d --name dvp-floci \
  -p 4566:4566 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  floci/floci:latest
```

Then initialize AWS resources:
```bash
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
aws s3 mb s3://dvp-documents-raw --region us-east-1
aws s3 mb s3://dvp-documents-processed --region us-east-1
```

**Terminal 3 — Backend:**
```bash
cd backend
npm install
npm run start:dev
# Runs on http://localhost:4000
```

**Terminal 4 — Frontend:**
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

**Terminal 5 — OCR Worker (optional):**
```bash
cd worker
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload
# Runs on http://localhost:8000
```

### Option C: Lambda Deployment (Production)

```bash
cd backend
npm install
npm run build
npx serverless deploy --stage dev
```

---

## 6. API Reference

All endpoints are prefixed with `/api`. Authenticated endpoints require `Authorization: Bearer <token>`.

### Auth (No authentication required)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create a new user account |
| `POST` | `/api/auth/login` | Login and receive JWT token |

**POST /api/auth/register**
```json
// Request
{ "name": "John Doe", "email": "john@example.com", "password": "password123" }

// Response
{ "user": { "id": "uuid", "name": "John Doe", "email": "john@example.com", "role": "USER" }, "token": "jwt..." }
```

**POST /api/auth/login**
```json
// Request
{ "email": "john@example.com", "password": "password123" }

// Response
{ "user": { "id": "uuid", "name": "John Doe", "email": "john@example.com", "role": "USER" }, "token": "jwt..." }
```

### Documents (Authentication required)

| Method | Endpoint | Description |
|---|---|---|---|
| `POST` | `/api/documents/upload` | Upload file + document type (multipart/form-data), triggers OCR |
| `POST` | `/api/documents/upload-url` | Register document + get presigned S3 URL (for production direct upload) |
| `POST` | `/api/documents/:id/confirm-upload` | Confirm file uploaded to S3, trigger OCR (production flow) |
| `GET` | `/api/documents` | List user's documents |
| `GET` | `/api/documents/:id` | Get document details |
| `GET` | `/api/documents/:id/status` | Get verification status |
| `PATCH` | `/api/documents/:id/ocr` | Update OCR data (internal, worker calls this) |

### Admin (ADMIN/SUPER_ADMIN only)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/documents/pending` | List documents awaiting review |
| `PATCH` | `/api/admin/documents/:id/approve` | Approve a document |
| `PATCH` | `/api/admin/documents/:id/reject` | Reject a document |

---

## 7. Frontend Pages

| Page | Route | Description |
|---|---|---|
| **Login** | `/login` | Sign in with email + password |
| **Register** | `/register` | Create a new account |
| **Dashboard** | `/dashboard` | View all uploaded documents with status badges |
| **Upload** | `/upload` | Upload a new document (select type + file) |
| **Status** | `/status` | Check document status by UUID |
| **Document Detail** | `/documents/[id]` | View document details and OCR data |
| **Admin Dashboard** | `/admin` | Review and approve/reject pending documents |

---

## 8. How to Use the Application

### Default Admin Credentials

| Role | Email | Password |
|---|---|---|
| **Administrator** | `admin@example.com` | `Admin1234!` |

Register this admin account once when you first run the application by sending a POST request to `/api/auth/register`:

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@example.com","password":"Admin1234!"}'
```

Then log in at `/login` with these credentials to access the **Admin Dashboard** (`/admin`).

### Step-by-Step Walkthrough

#### As a Regular User

1. **Register** — Go to `/register` and create an account (name, email, password)
2. **Login** — Go to `/login` with your new credentials
3. **Dashboard** — You'll land at `/dashboard` (initially empty)
4. **Upload a document** — Click "Upload Document" or go to `/upload`:
   - Select a document type (Aadhaar, PAN, Passport, etc.)
   - Pick a file (PDF, JPG, or PNG, max 20MB)
   - Click "Upload" — the frontend sends the file to the backend, which uploads it to S3 and triggers OCR processing
5. **Wait for processing** — The document will transition: `UPLOADED` → `OCR_COMPLETED` → `REVIEW_PENDING` (usually seconds)
6. **Check status** — Visit `/documents/[id]` to see the extracted OCR data
7. **Wait for admin review** — An admin must approve or reject the document
8. **Final status** — Once reviewed, the status changes to `APPROVED` (green) or `REJECTED` (red)

#### As an Admin

1. **Login** — Go to `/login` with `admin@example.com` / `Admin1234!`
2. **Admin Dashboard** — Go to `/admin` to see all documents with `REVIEW_PENDING` status
3. **Review a document** — Click a document ID to view its details (original file, OCR-extracted data)
4. **Approve or Reject** — Add optional remarks and click the action button
5. **Check result** — The document status updates, and the user can see the final verdict

### Status Meanings

| Status | Color | Meaning |
|---|---|---|
| `UPLOADED` | Gray | File uploaded to S3, OCR pending |
| `OCR_COMPLETED` | Yellow | OCR extracted text from the document |
| `REVIEW_PENDING` | Blue | Waiting for admin review |
| `APPROVED` | Green | Document verified and accepted |
| `REJECTED` | Red | Document rejected by admin |

---

## 9. AWS Infrastructure

### Resource Mapping (PRD Section 9)

| AWS Resource | DVP Usage | Local Equivalent |
|---|---|---|
| **API Gateway v2** | REST API front-end for all endpoints | Floci emulator |
| **Lambda (NestJS)** | Auth, Document, Admin service functions | Standard HTTP server |
| **S3 (raw)** | User-uploaded documents | Floci S3 emulator |
| **S3 (processed)** | OCR result JSON files | Floci S3 emulator |
| **EventBridge** | DocumentUploaded, OCRCompleted, VerificationCompleted events | Floci EventBridge |
| **EKS** | OCR worker pods (Python FastAPI) | Docker container |
| **RDS (PostgreSQL)** | Users, documents, audit_logs tables | Docker PostgreSQL |
| **IAM (LambdaRole)** | S3 read/write + EventBridge publish + RDS access | Floci IAM |
| **IAM (EKSWorkerRole)** | S3 read access for OCR workers | Floci IAM |
| **IAM (S3AccessRole)** | Cross-account S3 delegation | Floci IAM |

### IAM Roles & Policies

The `iam/` directory contains JSON definitions for all IAM roles. These are applied automatically by the `floci-init` container in local development.

- **LambdaRole** (`iam/lambda-role.json`): Permissions for the NestJS Lambda function
- **EKSWorkerRole** (`iam/eks-worker-role.json`): Permissions for OCR worker nodes
- **S3AccessRole** (`iam/s3-access-role.json`): Cross-account S3 delegation

### EventBridge Events

| Event | Source | Trigger | Consumer |
|---|---|---|---|
| `DocumentUploaded` | `dvp.document` | User uploads a document | OCR Worker starts processing |
| `OCRCompleted` | `dvp.document` | OCR extraction finishes | Document status advances to OCR_COMPLETED |
| `VerificationCompleted` | `dvp.document` | Admin approves/rejects | Notification system, audit trail |

---

## 10. Local Development with Floci

Floci emulates 53+ AWS services locally on port 4566. It's a drop-in replacement for LocalStack and requires no auth token.

### Configuration

Floci is configured via `floci/application.yml` which enables:
- S3, API Gateway v2, Lambda, EventBridge, RDS, ECS, EKS, IAM, STS, CloudFormation, CloudWatch

The configuration file is mounted into the Floci container at `/app/config/application.yml`.

### Initialization

When Floci starts, it runs init hooks (defined in `application.yml`) that create:
1. **S3 buckets**: `dvp-documents-raw` and `dvp-documents-processed`
2. **EventBridge rules**: for all three domain events
3. **IAM roles**: LambdaRole, EKSWorkerRole, S3AccessRole with policies attached

Alternatively, you can run `backend/scripts/init-floci.sh` manually:
```bash
bash backend/scripts/init-floci.sh
```

### Verifying Floci is Working

```bash
# Check Floci health
curl http://localhost:4566/_floci/health

# List S3 buckets
aws s3 ls --endpoint-url http://localhost:4566

# List IAM roles
aws iam list-roles --endpoint-url http://localhost:4566
```

### AWS SDK Configuration

The backend's `S3Service` and `EventBridgeService` (in `backend/src/common/aws/`) use environment variables to connect to Floci:

```
AWS_ENDPOINT_URL=http://localhost:4566
AWS_DEFAULT_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

The S3 client uses `forcePathStyle: true` because Floci serves S3 in path-style mode (`http://host:4566/bucket/key`).

---

## 11. Kubernetes Deployment

For production deployment on Amazon EKS, apply the manifests in the `k8s/` directory:

```bash
# Create namespace and deploy resources
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/rbac.yaml
kubectl apply -f k8s/ocr-worker.yaml
kubectl apply -f k8s/backend-service.yaml

# Check status
kubectl get pods -n dvp
kubectl get services -n dvp
kubectl get hpa -n dvp
```

### K8s Resources

| File | Resource | Purpose |
|---|---|---|
| `namespace.yaml` | Namespace `dvp` | Isolated environment for all DVP resources |
| `rbac.yaml` | ServiceAccount + Role + RoleBinding | Minimal RBAC for OCR worker pods |
| `ocr-worker.yaml` | Deployment (2 pods) + Service (ClusterIP) + HPA (2-10 pods) | OCR processing with auto-scaling |
| `backend-service.yaml` | Service (ClusterIP) | Internal service discovery for backend |

---

## 12. Environment Variables

### Root `.env` (auto-loaded by docker-compose)

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_DB` | `dvp_db` | PostgreSQL database name |
| `POSTGRES_USER` | `dvp_user` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `dvp_pass` | PostgreSQL password |
| `JWT_SECRET` | `dev-secret-key-...` | JWT signing secret (change in production) |
| `JWT_EXPIRATION` | `24h` | JWT token expiration |
| `AWS_ENDPOINT_URL` | `http://floci:4566` | AWS endpoint (Floci in Docker, localhost otherwise) |
| `AWS_DEFAULT_REGION` | `us-east-1` | AWS region |
| `AWS_ACCESS_KEY_ID` | `test` | Dummy AWS access key (Floci accepts any value) |
| `AWS_SECRET_ACCESS_KEY` | `test` | Dummy AWS secret key (Floci accepts any value) |

### Per-Service Env Files

| File | Used By | Key Variables |
|---|---|---|
| `env/postgres.env` | PostgreSQL container | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` |
| `env/floci.env` | Floci container | `FLOCI_HOSTNAME`, `FLOCI_STORAGE_MODE`, AWS credentials |
| `env/backend.env` | Backend container | Database connection, JWT config, AWS endpoint |
| `env/worker.env` | Worker container | `BACKEND_URL`, AWS endpoint |
| `env/frontend.env` | Frontend container | `NEXT_PUBLIC_API_URL`, `PORT` |
| `env/floci-init.env` | floci-init container | AWS endpoint + credentials |

> **Security Note:** All `.env` files containing secrets are listed in `.gitignore` and should never be committed to version control. In production, use AWS Secrets Manager or Parameter Store instead of env files.
