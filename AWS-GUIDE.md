# AWS Infrastructure Guide — Document Verification Portal

This document explains every AWS resource used in this project, why it's needed, how it fits in the overall flow, and how to create each one manually in the AWS Console.

---

## Table of Contents

1. [AWS Overview — What is AWS?](#1-aws-overview--what-is-aws)
2. [Complete Data Flow (AWS Edition)](#2-complete-data-flow-aws-edition)
3. [Resource 1: S3 Buckets](#3-resource-1-s3-buckets)
4. [Resource 2: IAM Roles & Policies](#4-resource-2-iam-roles--policies)
5. [Resource 3: Lambda Function](#5-resource-3-lambda-function)
6. [Resource 4: API Gateway](#6-resource-4-api-gateway)
7. [Resource 5: EventBridge](#7-resource-5-eventbridge)
8. [Resource 6: RDS (PostgreSQL)](#8-resource-6-rds-postgresql)
9. [Resource 7: EKS Cluster](#9-resource-7-eks-cluster)
10. [Step-by-Step: Create Everything Manually](#10-step-by-step-create-everything-manually)
11. [IAM Policies Explained in Detail](#11-iam-policies-explained-in-detail)
12. [How Floci Emulates All of This Locally](#12-how-floci-emulates-all-of-this-locally)

---

## 1. AWS Overview — What is AWS?

**Amazon Web Services (AWS)** is a cloud platform that provides on-demand computing resources. Instead of buying and maintaining physical servers, you rent services from AWS.

For this project, we use 7 core AWS services:

| Service | What it does | Real-world analogy |
|---|---|---|
| **S3** | Stores files (documents, images) | A massive file cabinet in the cloud |
| **IAM** | Manages who can do what | A security badge system |
| **Lambda** | Runs code without managing servers | A self-service kitchen — you put your recipe (code) in, it cooks it |
| **API Gateway** | Front door for API calls | A receptionist that directs visitors to the right department |
| **EventBridge** | Event notification bus | A post office that delivers messages |
| **RDS** | Managed relational database | A filing room with indexed cabinets |
| **EKS** | Runs containerized applications | A factory assembly line |

---

## 2. Complete Data Flow (AWS Edition)

Here's how data flows through all the AWS resources when a user uploads a document:

```
                         AWS CLOUD
  ───────────────────────────────────────────────────────────────────

  STEP 1: User Uploads a Document
  ──────────────────────────────────
  User's Browser ──PUT file──▶ S3 (dvp-documents-raw bucket)
                                    │
                                    │  S3 triggers an event notification
                                    ▼
                              EventBridge
                         ("DocumentUploaded" event)

  STEP 2: OCR Processing
  ──────────────────────────────────
  EventBridge ──triggers──▶ EKS Worker Pod (OCR)
                                    │
                                    │  Worker downloads file from S3
                                    ▼
                              S3 (dvp-documents-raw)
                                    │
                                    │  Worker runs Tesseract OCR
                                    ▼
                              Worker extracts text
                                    │
                                    │  Worker POSTs result to API
                                    ▼
                              API Gateway ──▶ Lambda (Backend API)
                                    │
                                    │  Lambda stores OCR data in DB
                                    │  Lambda copies JSON to S3
                                    ▼
                              S3 (dvp-documents-processed bucket)
                                    │
                                    │  Lambda fires EventBridge event
                                    ▼
                              EventBridge
                         ("OCRCompleted" event)

  STEP 3: Admin Review
  ──────────────────────────────────
  Admin's Browser ──▶ API Gateway ──▶ Lambda (Admin API)
                                    │
                                    │  Lambda updates DB status
                                    │  Lambda fires EventBridge event
                                    ▼
                              EventBridge
                         ("VerificationCompleted" event)
```

---

## 3. Resource 1: S3 Buckets

### What is S3?

**Amazon S3 (Simple Storage Service)** is an object storage service. Think of it as a folder in the cloud where you can store any file — documents, images, videos, backups. Each file is called an "object" and is stored in a "bucket."

### Why do we need it?

In DVP, users upload identity documents (Aadhaar, PAN, Passport). These files need to be:
- Stored securely (not on the application server)
- Accessible for processing (OCR worker reads them)
- Archived for audit purposes

### Our Buckets

| Bucket Name | Purpose | Who writes | Who reads |
|---|---|---|---|
| `dvp-documents-raw` | Original uploaded documents | User's browser (via presigned URL) | OCR Worker, Admin |
| `dvp-documents-processed` | OCR result JSON files | Backend Lambda | Admin, Audit |

### Folder Structure Inside Buckets

```
dvp-documents-raw/
  └── {userId}/
      └── {documentId}/
          └── original.pdf         # The uploaded file

dvp-documents-processed/
  └── {userId}/
      └── {documentId}/
          └── processed.json       # OCR extraction results
```

### What is a Presigned URL?

Normally, to upload a file to S3, you need AWS credentials. But we don't want to expose our AWS keys to users' browsers. A **presigned URL** is a temporary URL that grants permission to upload a specific file to a specific bucket for a limited time (1 hour).

**Flow:**
1. Backend generates a presigned URL using its AWS credentials
2. Backend gives the URL to the frontend
3. Frontend uploads the file directly to S3 using this URL
4. The URL expires after 1 hour

### How to create manually in AWS Console

```bash
# Via AWS CLI
aws s3 mb s3://dvp-documents-raw --region us-east-1
aws s3 mb s3://dvp-documents-processed --region us-east-1

# Configure lifecycle policy (optional - archive old documents)
aws s3api put-bucket-lifecycle-configuration \
  --bucket dvp-documents-raw \
  --lifecycle-configuration '{
    "Rules": [{
      "Id": "archive-after-90-days",
      "Status": "Enabled",
      "Filter": {},
      "Transitions": [{
        "Days": 90,
        "StorageClass": "GLACIER"
      }]
    }]
  }'

# Block public access (security best practice)
aws s3api put-public-access-block \
  --bucket dvp-documents-raw \
  --public-access-block-configuration '{
    "BlockPublicAcls": true,
    "IgnorePublicAcls": true,
    "BlockPublicPolicy": true,
    "RestrictPublicBuckets": true
  }'
```

**AWS Console steps:**
1. Go to S3 → "Create bucket"
2. Bucket name: `dvp-documents-raw`
3. Region: `US East (N. Virginia) us-east-1`
4. Uncheck "Block all public access" (for presigned URL access)
5. Click "Create bucket"
6. Repeat for `dvp-documents-processed`

---

## 4. Resource 2: IAM Roles & Policies

### What is IAM?

**AWS Identity and Access Management (IAM)** is a security service that controls who can do what in your AWS account. It's like a security badge system:
- **Users**: People who log in (you, your team)
- **Roles**: Permissions that AWS services assume (not people)
- **Policies**: Rules that define what actions are allowed or denied

### Why do we need it?

Every AWS service needs permission to talk to other AWS services. For example:
- Lambda needs permission to read/write files in S3
- Lambda needs permission to send events to EventBridge
- EKS worker nodes need permission to download files from S3

Instead of using a single master key, we create **roles** with **least privilege** — each role gets only the minimum permissions it needs.

### Our IAM Roles

#### Role 1: LambdaRole

**Who assumes it?** The Lambda function (when it runs our NestJS backend code)

**Why created?** The Lambda function needs to:
1. Read/write documents in S3 buckets
2. Publish events to EventBridge
3. Query RDS database
4. Write logs to CloudWatch

**Policies attached:**

| Policy Name | Actions | Resources | Why? |
|---|---|---|---|
| `S3Access` | `s3:GetObject`, `s3:PutObject`, `s3:PutObjectAcl` | `dvp-documents-raw/*`, `dvp-documents-processed/*` | Read/write documents and OCR results |
| `EventBridgeAccess` | `events:PutEvents` | `*` (all) | Fire workflow events |
| `RDSDataAccess` | `rds-data:ExecuteStatement`, `rds-data:BatchExecuteStatement` | `*` (all) | Query the database |
| `CloudWatchLogs` | `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` | `arn:aws:logs:*:*:*` | Store Lambda execution logs |

**Trust policy** (who can assume this role):
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
```
This says: "Only the Lambda service can use this role."

#### Role 2: EKSWorkerRole

**Who assumes it?** The EKS worker nodes (EC2 instances that run our OCR pods)

**Why created?** The OCR worker pods need to:
1. Download documents from S3 for processing
2. Describe the EKS cluster (for pod management)

**Policies attached:**

| Policy Name | Actions | Resources | Why? |
|---|---|---|---|
| `S3ReadAccess` | `s3:GetObject` | `dvp-documents-raw/*`, `dvp-documents-processed/*` | Download documents for OCR |
| `EKSAccess` | `eks:DescribeCluster`, `eks:ListClusters` | `*` (all) | Cluster management |

#### Role 3: S3AccessRole

**Who assumes it?** LambdaRole (cross-account access)

**Why created?** This is a secondary role that LambdaRole can assume when it needs full S3 access. It's an extra security layer — LambdaRole has limited S3 access by default, and can escalate only when needed.

### IAM Best Practices Followed

1. **Least privilege**: Each role has only the permissions it needs
2. **Resource-level restrictions**: Policies limit which S3 buckets can be accessed
3. **Separate roles per service**: Lambda and EKS have different roles
4. **No human users**: We use roles (for services), not IAM users (for people)

### How to create manually in AWS Console

```bash
# 1. Create LambdaRole
aws iam create-role \
  --role-name LambdaRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }]
  }'

# 2. Attach policies to LambdaRole
aws iam put-role-policy \
  --role-name LambdaRole \
  --policy-name S3Access \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": [
        "arn:aws:s3:::dvp-documents-raw/*",
        "arn:aws:s3:::dvp-documents-processed/*"
      ]
    }]
  }'

aws iam put-role-policy \
  --role-name LambdaRole \
  --policy-name EventBridgeAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "events:PutEvents",
      "Resource": "*"
    }]
  }'

# 3. Create EKSWorkerRole
aws iam create-role \
  --role-name EKSWorkerRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "Service": "ec2.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }]
  }'

# 4. Attach policy to EKSWorkerRole
aws iam put-role-policy \
  --role-name EKSWorkerRole \
  --policy-name S3ReadAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": [
        "arn:aws:s3:::dvp-documents-raw/*",
        "arn:aws:s3:::dvp-documents-processed/*"
      ]
    }]
  }'
```

**AWS Console steps:**
1. Go to IAM → "Roles" → "Create role"
2. Select "AWS service" → "Lambda" (for LambdaRole) or "EC2" (for EKSWorkerRole)
3. Click "Next"
4. Search for and select the policies: `AmazonS3FullAccess`, `CloudWatchLogsFullAccess`
5. Or click "Create inline policy" to write custom policies
6. Role name: `LambdaRole` or `EKSWorkerRole`
7. Click "Create role"

---

## 5. Resource 3: Lambda Function

### What is Lambda?

**AWS Lambda** is a serverless compute service. You upload your code, and AWS runs it without you managing any servers. You only pay when your code runs (per-request pricing).

### Why do we need it?

In DVP, the backend API (NestJS) runs as a Lambda function. Instead of running a server 24/7, Lambda only runs when someone makes an API call. This is more cost-effective for a document verification portal where traffic is not constant.

### How it works

```
User request ──▶ API Gateway ──▶ Lambda ──▶ Response
                                    │
                          (NestJS code runs here)
                                    │
                          ┌─────────┼─────────┐
                          ▼         ▼         ▼
                         S3      RDS     EventBridge
```

### Lambda Function Details

| Property | Value |
|---|---|
| **Function name** | `dvp-backend-api` |
| **Runtime** | `Node.js 22.x` |
| **Handler** | `dist/handler.handler` (the serverless-http wrapper) |
| **Memory** | `512 MB` |
| **Timeout** | `30 seconds` |
| **IAM Role** | `LambdaRole` (created above) |

### What the Lambda function does

The Lambda function is the entire NestJS backend application. It handles:
- `POST /api/auth/register` — Create user
- `POST /api/auth/login` — Login
- `POST /api/documents/upload-url` — Generate presigned S3 URL
- `GET /api/documents` — List documents
- `GET /api/documents/:id` — Get document detail
- `GET /api/documents/:id/status` — Get verification status
- `PATCH /api/documents/:id/ocr` — Store OCR results
- `GET /api/admin/documents/pending` — List pending reviews
- `PATCH /api/admin/documents/:id/approve` — Approve document
- `PATCH /api/admin/documents/:id/reject` — Reject document

### Cold Start vs. Warm Start

- **Cold start**: First invocation after deployment or idle period — Lambda downloads and initializes the code (~2-5 seconds)
- **Warm start**: Subsequent invocations — the Lambda container is reused (~10-50ms)

The handler.ts file implements the **warm start pattern**:
```typescript
let cachedServer;  // Global variable persists across warm invocations

export const handler = async (event, context) => {
  if (!cachedServer) {
    cachedServer = await bootstrap();  // Cold start: initialize NestJS
  }
  return cachedServer(event, context); // Warm start: reuse cached instance
};
```

### How to create manually in AWS Console

```bash
# Deploy via Serverless Framework (automated)
cd backend
npm run build
npx serverless deploy --stage prod

# Or create manually:
# 1. Zip the compiled code
npm run build
cd dist
zip -r ../function.zip .

# 2. Upload to Lambda
aws lambda create-function \
  --function-name dvp-backend-api \
  --runtime nodejs22.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/LambdaRole \
  --handler dist/handler.handler \
  --zip-file fileb://function.zip \
  --memory-size 512 \
  --timeout 30 \
  --environment Variables={
    DATABASE_HOST=your-rds-endpoint,
    DATABASE_NAME=dvp_db,
    DATABASE_USER=dvp_user,
    DATABASE_PASSWORD=your-password,
    JWT_SECRET=your-jwt-secret
  }
```

**AWS Console steps:**
1. Go to Lambda → "Create function"
2. Choose "Author from scratch"
3. Function name: `dvp-backend-api`
4. Runtime: `Node.js 22.x`
5. Architecture: `x86_64`
6. Permissions: Choose "Use an existing role" → select `LambdaRole`
7. Click "Create function"
8. Upload your code zip file
9. Handler: `dist/handler.handler`
10. Configuration → Edit memory to `512MB`, timeout to `30 seconds`
11. Environment variables: Add the database connection details

---

## 6. Resource 4: API Gateway

### What is API Gateway?

**Amazon API Gateway** is a managed service that creates, publishes, and secures REST APIs. It acts as the front door for your Lambda function — all HTTP requests from the frontend go through API Gateway before reaching Lambda.

### Why do we need it?

Instead of users calling Lambda directly (which is complex), they call a simple HTTP URL. API Gateway:
- Provides a stable HTTP endpoint (https://api.yourdomain.com)
- Handles authentication, throttling, and request validation
- Passes requests to Lambda and returns responses to users

### Architecture

```
Browser ──▶ https://api.yourdomain.com/api/auth/login
                              │
                    ┌─────────▼─────────┐
                    │   API Gateway v2  │  (HTTP API)
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Lambda Function │
                    └───────────────────┘
```

### Routes Defined

| Method | Path | Integrates with Lambda |
|---|---|---|
| `ANY` | `/api/{proxy+}` | All requests forwarded to Lambda |
| `ANY` | `/api/` | Root path |

The `{proxy+}` is a catch-all route — every request to any path under `/api/` is forwarded to Lambda. Lambda's NestJS router then decides which controller handles it based on the path and method.

### How to create manually in AWS Console

```bash
# Via AWS CLI
aws apigatewayv2 create-api \
  --name dvp-api \
  --protocol-type HTTP \
  --target arn:aws:lambda:us-east-1:YOUR_ACCOUNT:function:dvp-backend-api

# Get the API endpoint
aws apigatewayv2 get-api --api-id YOUR_API_ID
```

**AWS Console steps:**
1. Go to API Gateway → "Create API"
2. Choose "HTTP API" (not REST API)
3. API name: `dvp-api`
4. Integration: Choose "Lambda" → select `dvp-backend-api` function
5. Route: Configure `ANY /{proxy+}` to Lambda
6. Stage: `$default` (auto-deploy)
7. Click "Create"

---

## 7. Resource 5: EventBridge

### What is EventBridge?

**Amazon EventBridge** is a serverless event bus that connects different AWS services. Think of it as a post office:
- Services send messages (events) to EventBridge
- EventBridge delivers those messages to subscribers
- Subscribers can be Lambda functions, SQS queues, Step Functions, etc.

### Why do we need it?

In DVP, the document verification workflow is event-driven. When something happens (document uploaded, OCR completed, verification decided), other parts of the system need to know. EventBridge decouples these components:

```
DocumentUploaded event ──▶ EventBridge ──▶ OCR Worker picks up task
                                                    │
                    ┌─────────────────────────────────┘
                    ▼
OCRCompleted event ──▶ EventBridge ──▶ Backend updates status
                                               │
                    ┌────────────────────────────┘
                    ▼
VerificationCompleted event ──▶ EventBridge ──▶ Notifications
```

### Our Events

| Event Name | Source | When it fires | Payload |
|---|---|---|---|
| `DocumentUploaded` | `dvp.document` | User uploads a document | `{ "documentId": "uuid", "userId": "uuid", "s3Key": "..." }` |
| `OCRCompleted` | `dvp.document` | OCR worker finishes extraction | `{ "documentId": "uuid", "userId": "uuid" }` |
| `VerificationCompleted` | `dvp.document` | Admin approves or rejects | `{ "documentId": "uuid", "userId": "uuid", "result": "APPROVED" }` |

### Event Structure

Every event follows this JSON format (as defined in PRD Section 9):

```json
{
  "source": "dvp.document",
  "detail-type": "DocumentUploaded",
  "detail": {
    "documentId": "123e4567-e89b-12d3-a456-426614174000",
    "userId": "123e4567-e89b-12d3-a456-426614174001",
    "s3Key": "user-id/doc-id/original.pdf"
  }
}
```

### EventBridge Rules

Rules filter which events go to which targets:

| Rule Name | Event Pattern | Target |
|---|---|---|
| `dvp-document-uploaded` | `{ "source": ["dvp.document"], "detail-type": ["DocumentUploaded"] }` | EKS Worker (via SQS queue) |
| `dvp-ocr-completed` | `{ "source": ["dvp.document"], "detail-type": ["OCRCompleted"] }` | Backend Lambda |
| `dvp-verification-completed` | `{ "source": ["dvp.document"], "detail-type": ["VerificationCompleted"] }` | Notification Lambda |

### Event Flow Diagram

```
                    ┌──────────────────┐
                    │   EventBridge    │
                    │   Default Bus    │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
   ┌──────────▼──────┐  ┌───▼───────┐  ┌───▼──────────┐
   │ DocumentUploaded│  │OCRCompleted│  │Verification  │
   │    Rule         │  │   Rule    │  │Completed Rule│
   └──────────┬──────┘  └───┬───────┘  └───┬──────────┘
              │              │              │
     ┌────────▼──┐   ┌──────▼──────┐  ┌────▼────────┐
     │ EKS Worker│   │Lambda Update│  │Send Email   │
     │(SQS Queue)│   │    Status   │  │Notification │
     └───────────┘   └─────────────┘  └─────────────┘
```

### How to create manually in AWS Console

```bash
# 1. Create EventBridge rules
aws events put-rule \
  --name dvp-document-uploaded \
  --event-pattern '{
    "source": ["dvp.document"],
    "detail-type": ["DocumentUploaded"]
  }'

aws events put-rule \
  --name dvp-ocr-completed \
  --event-pattern '{
    "source": ["dvp.document"],
    "detail-type": ["OCRCompleted"]
  }'

aws events put-rule \
  --name dvp-verification-completed \
  --event-pattern '{
    "source": ["dvp.document"],
    "detail-type": ["VerificationCompleted"]
  }'

# 2. Add targets to rules (example: SQS queue for OCR worker)
aws events put-targets \
  --rule dvp-document-uploaded \
  --targets '[
    {
      "Id": "ocr-queue",
      "Arn": "arn:aws:sqs:us-east-1:YOUR_ACCOUNT:dvp-ocr-queue"
    }
  ]'
```

**AWS Console steps:**
1. Go to EventBridge → "Rules" → "Create rule"
2. Name: `dvp-document-uploaded`
3. Event bus: `default`
4. Rule type: "Rule with an event pattern"
5. Event pattern:
   ```json
   {
     "source": ["dvp.document"],
     "detail-type": ["DocumentUploaded"]
   }
   ```
6. Select target (e.g., SQS queue, Lambda function)
7. Click "Create"
8. Repeat for `dvp-ocr-completed` and `dvp-verification-completed`

---

## 8. Resource 6: RDS (PostgreSQL)

### What is RDS?

**Amazon RDS (Relational Database Service)** is a managed database service. It runs PostgreSQL (or MySQL, MariaDB, etc.) without you having to manage the underlying server, backups, patches, etc.

### Why do we need it?

We need a database to store:
- **Users**: names, emails, password hashes, roles
- **Documents**: metadata, status, OCR data, S3 keys
- **Audit logs**: immutable history of all actions

### Database Schema

```sql
-- Users table: stores user accounts
CREATE TABLE users (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    password_hash TEXT,
    role VARCHAR(50) DEFAULT 'USER',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Documents table: stores document metadata
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    document_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'UPLOADED',
    s3_key TEXT,
    ocr_data JSONB,      -- OCR extraction results (flexible JSON)
    remarks TEXT,         -- Admin rejection reason
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audit logs table: immutable action history
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    entity_type VARCHAR(100),  -- 'document', 'user'
    entity_id UUID,
    action VARCHAR(100),       -- 'UPLOADED', 'APPROVED', etc.
    performed_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### RDS Configuration

| Property | Value |
|---|---|
| **Engine** | PostgreSQL 16 |
| **Instance class** | `db.t3.micro` (free tier eligible) |
| **Storage** | 20 GB gp3 |
| **Database name** | `dvp_db` |
| **Master username** | `dvp_user` |
| **Master password** | (set during creation) |
| **Public access** | No (only accessible from Lambda via VPC) |
| **Backup retention** | 7 days |

### Connecting Lambda to RDS

In production, Lambda and RDS must be in the same VPC. Lambda needs:
1. A VPC configuration with the same subnets as RDS
2. A security group that allows Lambda to connect to RDS on port 5432
3. The RDS security group must allow inbound traffic from Lambda's security group

### How to create manually in AWS Console

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier dvp-postgres \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username dvp_user \
  --master-user-password YourStrongPassword \
  --allocated-storage 20 \
  --database-name dvp_db \
  --backup-retention-period 7 \
  --publicly-accessible false \
  --vpc-security-group-ids sg-YOUR_SECURITY_GROUP
```

**AWS Console steps:**
1. Go to RDS → "Create database"
2. Engine: `PostgreSQL`
3. Version: `PostgreSQL 16`
4. Templates: `Free tier`
5. DB instance identifier: `dvp-postgres`
6. Master username: `dvp_user`
7. Master password: (enter a strong password)
8. Instance configuration: `db.t3.micro`
9. Storage: 20 GB
10. Connectivity: Choose VPC, security group (allow port 5432)
11. Database name: `dvp_db`
12. Backup retention: 7 days
13. Click "Create database"

---

## 9. Resource 7: EKS Cluster

### What is EKS?

**Amazon EKS (Elastic Kubernetes Service)** is a managed Kubernetes service. Kubernetes is a system for running containerized applications (Docker containers) at scale. EKS manages the control plane (the "brain" of Kubernetes) while you manage the worker nodes (the "muscles" that run your containers).

### Why do we need it?

The OCR worker runs as a Docker container. We need a way to:
- Run multiple OCR workers in parallel
- Auto-scale workers based on demand
- Restart workers if they fail
- Distribute work across workers

EKS + Kubernetes provides all of this.

### Architecture

```
                    ┌─────────────────────────┐
                    │    EKS Control Plane     │  (Managed by AWS)
                    │  (Scheduler, API Server) │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │     Worker Nodes         │  (EC2 instances)
                    │  ┌──────┐  ┌──────┐     │
                    │  │OCR   │  │OCR   │     │
                    │  │Pod 1 │  │Pod 2 │     │
                    │  └──────┘  └──────┘     │
                    └─────────────────────────┘
```

### Our Kubernetes Resources

The OCR worker is defined in `k8s/ocr-worker.yaml` with:

| Resource | What it does |
|---|---|
| **Deployment** | Ensures 2 OCR pods are always running (replicas: 2) |
| **Service** | Internal DNS name `ocr-worker` for pod-to-pod communication |
| **HPA** | Automatically scales pods from 2 to 10 based on CPU usage |

### OCR Worker Pod

Each pod runs the Python FastAPI OCR service (`worker/main.py`) which:
1. Listens for processing tasks
2. Downloads documents from S3
3. Runs Tesseract OCR
4. Extracts structured fields
5. Posts results back to Lambda API

### How to create manually in AWS Console

Creating an EKS cluster is complex. Here's the minimal setup:

```bash
# 1. Create EKS cluster
eksctl create cluster \
  --name dvp-cluster \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 2 \
  --nodes-max 10 \
  --node-ami-family AmazonLinux2023 \
  --with-oidc \
  --managed

# 2. Update kubeconfig
aws eks update-kubeconfig --name dvp-cluster --region us-east-1

# 3. Deploy OCR worker
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/rbac.yaml
kubectl apply -f k8s/ocr-worker.yaml
kubectl apply -f k8s/backend-service.yaml
```

**AWS Console steps:**
1. Go to EKS → "Add cluster" → "Create"
2. Cluster name: `dvp-cluster`
3. Kubernetes version: (latest)
4. Service role: Create or select a role with `AmazonEKSClusterPolicy`
5. VPC: Select or create
6. Click "Create"
7. Wait 10-15 minutes for cluster creation
8. Go to "Compute" → "Add node group"
9. Node group name: `standard-workers`
10. Node IAM role: Create with `AmazonEKSWorkerNodePolicy`, `AmazonEKS_CNI_Policy`, `AmazonEC2ContainerRegistryReadOnly`
11. Instance type: `t3.medium`
12. Desired size: 2, Min: 2, Max: 10
13. Click "Create"

---

## 10. Step-by-Step: Create Everything Manually

Here's the complete order to create all AWS resources manually. Follow this sequence because some resources depend on others.

### Prerequisites

```bash
# Install AWS CLI
# Configure AWS credentials
aws configure
# Enter your AWS Access Key ID and Secret Access Key
# Default region: us-east-1
```

### Step 1: Create S3 Buckets

```bash
# Create raw documents bucket
aws s3 mb s3://dvp-documents-raw --region us-east-1

# Create processed documents bucket
aws s3 mb s3://dvp-documents-processed --region us-east-1

# Verify
aws s3 ls
```

### Step 2: Create IAM Roles

```bash
# Create LambdaRole (for the backend API)
aws iam create-role \
  --role-name LambdaRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach S3 policy to LambdaRole
aws iam put-role-policy \
  --role-name LambdaRole \
  --policy-name S3Access \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": [
        "arn:aws:s3:::dvp-documents-raw/*",
        "arn:aws:s3:::dvp-documents-processed/*"
      ]
    }]
  }'

# Attach EventBridge policy to LambdaRole
aws iam put-role-policy \
  --role-name LambdaRole \
  --policy-name EventBridgeAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "events:PutEvents",
      "Resource": "*"
    }]
  }'

# Attach CloudWatch Logs policy to LambdaRole
aws iam put-role-policy \
  --role-name LambdaRole \
  --policy-name CloudWatchLogs \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }]
  }'

# Create EKSWorkerRole
aws iam create-role \
  --role-name EKSWorkerRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ec2.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach S3 read policy to EKSWorkerRole
aws iam put-role-policy \
  --role-name EKSWorkerRole \
  --policy-name S3ReadAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": [
        "arn:aws:s3:::dvp-documents-raw/*",
        "arn:aws:s3:::dvp-documents-processed/*"
      ]
    }]
  }'
```

### Step 3: Create RDS Database

```bash
# Create security group for RDS
aws ec2 create-security-group \
  --group-name dvp-rds-sg \
  --description "Security group for DVP RDS PostgreSQL"

# Get your IP for temporary access
MY_IP=$(curl -s http://checkip.amazonaws.com)

# Allow PostgreSQL access from your IP
aws ec2 authorize-security-group-ingress \
  --group-name dvp-rds-sg \
  --protocol tcp \
  --port 5432 \
  --cidr $MY_IP/32

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier dvp-postgres \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username dvp_user \
  --master-user-password YourStrongPassword123 \
  --allocated-storage 20 \
  --database-name dvp_db \
  --backup-retention-period 7 \
  --vpc-security-group-ids $(aws ec2 describe-security-groups --group-names dvp-rds-sg --query 'SecurityGroups[0].GroupId' --output text) \
  --publicly-accessible true

# Wait for RDS to be ready (~5 minutes)
aws rds wait db-instance-available --db-instance-identifier dvp-postgres

# Get the endpoint
aws rds describe-db-instances \
  --db-instance-identifier dvp-postgres \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

### Step 4: Create EventBridge Rules

```bash
# Create rules
aws events put-rule --name dvp-document-uploaded --event-pattern '{"source": ["dvp.document"], "detail-type": ["DocumentUploaded"]}'
aws events put-rule --name dvp-ocr-completed --event-pattern '{"source": ["dvp.document"], "detail-type": ["OCRCompleted"]}'
aws events put-rule --name dvp-verification-completed --event-pattern '{"source": ["dvp.document"], "detail-type": ["VerificationCompleted"]}'
```

### Step 5: Deploy Lambda + API Gateway

```bash
# Using Serverless Framework (recommended)
cd backend
npm install
npm run build
npx serverless deploy --stage prod
```

### Step 6: Create EKS Cluster (Optional)

```bash
# Using eksctl (simplest way)
eksctl create cluster \
  --name dvp-cluster \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 2 \
  --managed

# Deploy OCR worker
kubectl apply -f k8s/
```

---

## 11. IAM Policies Explained in Detail

### What is an IAM Policy?

An IAM policy is a JSON document that defines permissions. It answers: "Who can do what, on which resources, under what conditions?"

### Policy Structure

```json
{
  "Version": "2012-10-17",     // Policy language version (always this)
  "Statement": [                // One or more permission statements
    {
      "Effect": "Allow",        // Allow or Deny
      "Action": [               // What actions are allowed
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": [             // Which resources these actions apply to
        "arn:aws:s3:::dvp-documents-raw/*"
      ],
      "Condition": {            // Optional: when does this apply?
        "IpAddress": {
          "aws:SourceIp": "192.168.1.0/24"
        }
      }
    }
  ]
}
```

### Policy Breakdown - LambdaRole S3Access

```json
{
  "Effect": "Allow",                              // ✅ Allow (not Deny)
  "Action": [
    "s3:GetObject",                               // Download files
    "s3:PutObject"                                // Upload files
  ],
  "Resource": [
    "arn:aws:s3:::dvp-documents-raw/*",           // Everything in raw bucket
    "arn:aws:s3:::dvp-documents-processed/*"      // Everything in processed bucket
  ]
}
```

**What this means:** Lambda can read and write any object in both DVP buckets. But it CANNOT:
- List buckets (`s3:ListBucket`)
- Delete objects (`s3:DeleteObject`)
- Change bucket settings (`s3:PutBucketPolicy`)

This is **least privilege** — Lambda gets only what it needs.

### Policy Breakdown - LambdaRole EventBridgeAccess

```json
{
  "Effect": "Allow",
  "Action": "events:PutEvents",     // Only publish events
  "Resource": "*"                    // To any event bus
}
```

**Why `Resource: "*"`?** EventBridge doesn't support resource-level permissions for `PutEvents`. You have to allow all resources. This is an AWS limitation, not a security issue — the events themselves are just messages.

### Policy Breakdown - EKSWorkerRole S3ReadAccess

```json
{
  "Effect": "Allow",
  "Action": "s3:GetObject",          // Only read/download (no write)
  "Resource": [
    "arn:aws:s3:::dvp-documents-raw/*",
    "arn:aws:s3:::dvp-documents-processed/*"
  ]
}
```

**What this means:** EKS workers can ONLY download files. They cannot upload, delete, or modify anything in S3. This is intentional — OCR workers should only read documents, not store results (that's Lambda's job).

### ARN Format Explained

**ARN** = Amazon Resource Name. It's the unique identifier for any AWS resource.

Format: `arn:partition:service:region:account-id:resource-type/resource-name`

Examples:
| ARN | Meaning |
|---|---|
| `arn:aws:s3:::dvp-documents-raw/*` | Any object in the dvp-documents-raw bucket (the `/*` means "any key") |
| `arn:aws:s3:::dvp-documents-raw` | The bucket itself (not objects inside it) |
| `arn:aws:lambda:us-east-1:123456789012:function:dvp-backend-api` | A specific Lambda function |
| `arn:aws:logs:*:*:*` | Any log group in any region, any account |

### Trust Policy vs. Permissions Policy

- **Trust policy**: "Who can use this role?" (attached to the role)
- **Permissions policy**: "What can they do after assuming the role?" (also attached to the role)

```
Role: LambdaRole
  ├── Trust Policy:    "Only Lambda service can assume this role"
  └── Permissions:     "Can read/write S3, publish to EventBridge, write logs"
```

---

## 12. How Floci Emulates All of This Locally

When you run `docker compose up`, Floci (`hectorvent/floci:latest`) starts and emulates all 7 AWS services on port 4566. Here's how each service is emulated:

### Local vs. Real AWS

| AWS Service | Real AWS | Floci (Local) |
|---|---|---|
| **S3** | `s3.amazonaws.com` | `http://localhost:4566` with `forcePathStyle: true` |
| **IAM** | `iam.amazonaws.com` | `http://localhost:4566` — accepts any credentials |
| **Lambda** | Runs Node.js code in managed containers | Runs Lambda in Docker containers (needs `/var/run/docker.sock`) |
| **API Gateway** | `apigateway.amazonaws.com` | `http://localhost:4566` — HTTP API endpoints |
| **EventBridge** | `events.amazonaws.com` | `http://localhost:4566` — put events, list rules |
| **RDS** | Managed PostgreSQL on AWS | Real PostgreSQL Docker container (not Floci) |
| **EKS** | Managed Kubernetes control plane | Emulated via Docker Compose service |

### Why do we still use real PostgreSQL?

Floci can emulate RDS, but for local development we use a real PostgreSQL container. This gives us:
- **Full SQL compatibility**: All PostgreSQL features work as expected
- **Data persistence**: Data survives container restarts (with named volumes)
- **Tool compatibility**: Can connect with pgAdmin, DBeaver, etc.
- **Faster performance**: No emulation overhead

### What Floci CAN and CANNOT do

**Floci CAN:**
- Store files in S3 (data persists with `persistent` storage mode)
- Create IAM roles and attach policies
- Create EventBridge rules and receive events
- Run Lambda functions (in Docker containers)
- Accept any AWS credentials (no real auth required)

**Floci CANNOT:**
- Actually run Lambda at scale (no auto-scaling)
- Provide production-level durability (data is local)
- Emulate every AWS service feature (some edge cases differ)
- Handle large traffic volumes (it's for development only)

### Verifying AWS Resources in Floci

```bash
# Check S3 buckets
aws s3 ls --endpoint-url http://localhost:4566

# List IAM roles
aws iam list-roles --endpoint-url http://localhost:4566

# List EventBridge rules
aws events list-rules --endpoint-url http://localhost:4566

# Put a test event
aws events put-events \
  --endpoint-url http://localhost:4566 \
  --entries '[
    {
      "Source": "dvp.document",
      "DetailType": "DocumentUploaded",
      "Detail": "{\"documentId\":\"test\",\"userId\":\"test\"}"
    }
  ]'
```

---

## Quick Reference: AWS Resource Summary

| # | Resource | Name | Created By | Purpose |
|---|---|---|---|---|
| 1 | **S3 Bucket** | `dvp-documents-raw` | `init-floci.sh` | Store uploaded documents |
| 2 | **S3 Bucket** | `dvp-documents-processed` | `init-floci.sh` | Store OCR JSON results |
| 3 | **IAM Role** | `LambdaRole` | `init-floci.sh` | Permissions for backend API |
| 4 | **IAM Role** | `EKSWorkerRole` | `init-floci.sh` | Permissions for OCR workers |
| 5 | **IAM Role** | `S3AccessRole` | `init-floci.sh` | Cross-account S3 delegation |
| 6 | **EventBridge Rule** | `dvp-document-uploaded` | `init-floci.sh` | Route upload events |
| 7 | **EventBridge Rule** | `dvp-ocr-completed` | `init-floci.sh` | Route OCR complete events |
| 8 | **EventBridge Rule** | `dvp-verification-completed` | `init-floci.sh` | Route verification events |
| 9 | **Lambda Function** | `dvp-backend-api` | `serverless deploy` | Run NestJS backend |
| 10 | **API Gateway** | `dvp-api` | `serverless deploy` | Front door for API |
| 11 | **RDS (PostgreSQL)** | `dvp-postgres` | Manual / CloudFormation | Store metadata |
| 12 | **EKS Cluster** | `dvp-cluster` | Manual / eksctl | Run OCR worker pods |
