#!/bin/bash
# =============================================================================
# Floci Resource Initialization Script
# =============================================================================
# This script runs once when the floci-init container starts.
# It creates all necessary AWS resources inside the Floci emulator:
#
# Resources created:
#   1. S3 buckets: dvp-documents-raw, dvp-documents-processed
#   2. EventBridge rules: DocumentUploaded, OCRCompleted, VerificationCompleted
#   3. IAM roles: LambdaRole, EKSWorkerRole, S3AccessRole
#   4. IAM policies attached to each role
#
# The script uses the AWS CLI pointed at Floci's endpoint.
# All operations are idempotent (fail silently if resource already exists).
# =============================================================================

set -e

FLOCI_ENDPOINT="${AWS_ENDPOINT_URL:-http://localhost:4566}"

echo "=========================================="
echo "Initializing Floci AWS Resources"
echo "Endpoint: $FLOCI_ENDPOINT"
echo "=========================================="

# ---------------------------------------------------------------------------
# 1. Create S3 Buckets
# ---------------------------------------------------------------------------
echo "[1/5] Creating S3 buckets..."

# Raw documents bucket (user uploads go here)
aws s3 mb s3://dvp-documents-raw \
  --endpoint-url $FLOCI_ENDPOINT \
  --region us-east-1 2>/dev/null || echo "  -> dvp-documents-raw already exists"

# Processed documents bucket (OCR JSON results stored here)
aws s3 mb s3://dvp-documents-processed \
  --endpoint-url $FLOCI_ENDPOINT \
  --region us-east-1 2>/dev/null || echo "  -> dvp-documents-processed already exists"

# ---------------------------------------------------------------------------
# 2. Create EventBridge Rules
# ---------------------------------------------------------------------------
echo "[2/5] Creating EventBridge rules..."

# Rule for document upload events (triggers OCR processing)
aws events put-rule \
  --name dvp-document-uploaded \
  --event-pattern '{"source": ["dvp.document"], "detail-type": ["DocumentUploaded"]}' \
  --endpoint-url $FLOCI_ENDPOINT \
  --region us-east-1 2>/dev/null || echo "  -> dvp-document-uploaded rule exists"

# Rule for OCR completion events (triggers status transition)
aws events put-rule \
  --name dvp-ocr-completed \
  --event-pattern '{"source": ["dvp.document"], "detail-type": ["OCRCompleted"]}' \
  --endpoint-url $FLOCI_ENDPOINT \
  --region us-east-1 2>/dev/null || echo "  -> dvp-ocr-completed rule exists"

# Rule for verification completion events (triggers notifications)
aws events put-rule \
  --name dvp-verification-completed \
  --event-pattern '{"source": ["dvp.document"], "detail-type": ["VerificationCompleted"]}' \
  --endpoint-url $FLOCI_ENDPOINT \
  --region us-east-1 2>/dev/null || echo "  -> dvp-verification-completed rule exists"

# ---------------------------------------------------------------------------
# 3. Create IAM Roles
# ---------------------------------------------------------------------------
echo "[3/5] Creating IAM roles..."

# Lambda execution role (for the NestJS API Lambda function)
aws iam create-role \
  --role-name LambdaRole \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
  --endpoint-url $FLOCI_ENDPOINT \
  --region us-east-1 2>/dev/null || echo "  -> LambdaRole already exists"

# EKS worker role (for the OCR processing pods)
aws iam create-role \
  --role-name EKSWorkerRole \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
  --endpoint-url $FLOCI_ENDPOINT \
  --region us-east-1 2>/dev/null || echo "  -> EKSWorkerRole already exists"

# S3 access role (cross-account access for Lambda to S3)
aws iam create-role \
  --role-name S3AccessRole \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"arn:aws:iam::000000000000:role/LambdaRole"},"Action":"sts:AssumeRole"}]}' \
  --endpoint-url $FLOCI_ENDPOINT \
  --region us-east-1 2>/dev/null || echo "  -> S3AccessRole already exists"

# ---------------------------------------------------------------------------
# 4. Attach IAM Policies to Roles
# ---------------------------------------------------------------------------
echo "[4/5] Attaching IAM policies..."

# LambdaRole: S3 read/write for document storage
aws iam put-role-policy \
  --role-name LambdaRole \
  --policy-name S3Access \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:GetObject","s3:PutObject"],"Resource":["arn:aws:s3:::dvp-documents-raw/*","arn:aws:s3:::dvp-documents-processed/*"]}]}' \
  --endpoint-url $FLOCI_ENDPOINT \
  --region us-east-1 2>/dev/null || echo "  -> LambdaRole:S3Access policy exists"

# LambdaRole: EventBridge publish for workflow events
aws iam put-role-policy \
  --role-name LambdaRole \
  --policy-name EventBridgeAccess \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"events:PutEvents","Resource":"*"}]}' \
  --endpoint-url $FLOCI_ENDPOINT \
  --region us-east-1 2>/dev/null || echo "  -> LambdaRole:EventBridgeAccess policy exists"

# LambdaRole: RDS Data API access for database operations
aws iam put-role-policy \
  --role-name LambdaRole \
  --policy-name RDSDataAccess \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["rds-data:ExecuteStatement","rds-data:BatchExecuteStatement"],"Resource":"*"}]}' \
  --endpoint-url $FLOCI_ENDPOINT \
  --region us-east-1 2>/dev/null || echo "  -> LambdaRole:RDSDataAccess policy exists"

# EKSWorkerRole: S3 read access for downloading documents
aws iam put-role-policy \
  --role-name EKSWorkerRole \
  --policy-name S3ReadAccess \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:GetObject"],"Resource":["arn:aws:s3:::dvp-documents-raw/*","arn:aws:s3:::dvp-documents-processed/*"]}]}' \
  --endpoint-url $FLOCI_ENDPOINT \
  --region us-east-1 2>/dev/null || echo "  -> EKSWorkerRole:S3ReadAccess policy exists"

# ---------------------------------------------------------------------------
# 5. Verify Resources
# ---------------------------------------------------------------------------
echo "[5/5] Verifying resources..."

echo ""
echo "S3 Buckets:"
aws s3 ls --endpoint-url $FLOCI_ENDPOINT --region us-east-1 2>/dev/null

echo ""
echo "EventBridge Rules:"
aws events list-rules \
  --endpoint-url $FLOCI_ENDPOINT \
  --region us-east-1 \
  --query "Rules[?contains(Name, 'dvp')].Name" \
  --output text 2>/dev/null

echo ""
echo "IAM Roles:"
aws iam list-roles \
  --endpoint-url $FLOCI_ENDPOINT \
  --region us-east-1 \
  --query "Roles[?contains(RoleName, 'Role')].[RoleName]" \
  --output text 2>/dev/null

echo ""
echo "=========================================="
echo "Floci initialization complete!"
echo "=========================================="
