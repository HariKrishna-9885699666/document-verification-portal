#!/bin/sh
# =============================================================================
# Floci Init Hook - Create DVP AWS Resources
# =============================================================================
# This script runs as a Floci "start" phase init hook after the HTTP server
# is ready on port 4566. It creates all necessary AWS resources:
#
# Resources created:
#   1. S3 buckets: dvp-documents-raw, dvp-documents-processed
#   2. EventBridge rules: DocumentUploaded, OCRCompleted, VerificationCompleted
#   3. IAM roles: LambdaRole, EKSWorkerRole, S3AccessRole
#   4. IAM policies attached to each role
#
# The compat image pre-configures AWS CLI with:
#   AWS_ENDPOINT_URL=http://localhost:4566
#   AWS_ACCESS_KEY_ID=test
#   AWS_SECRET_ACCESS_KEY=test
#   AWS_DEFAULT_REGION=us-east-1
# =============================================================================

set -e

echo "=========================================="
echo "Initializing DVP AWS Resources"
echo "Endpoint: ${AWS_ENDPOINT_URL:-http://localhost:4566}"
echo "=========================================="

# ---------------------------------------------------------------------------
# 1. Create S3 Buckets
# ---------------------------------------------------------------------------
echo "[1/5] Creating S3 buckets..."

aws s3 mb s3://dvp-documents-raw --region us-east-1 2>/dev/null || echo "  -> dvp-documents-raw already exists"
aws s3 mb s3://dvp-documents-processed --region us-east-1 2>/dev/null || echo "  -> dvp-documents-processed already exists"

# ---------------------------------------------------------------------------
# 2. Create EventBridge Rules
# ---------------------------------------------------------------------------
echo "[2/5] Creating EventBridge rules..."

aws events put-rule \
  --name dvp-document-uploaded \
  --event-pattern '{"source": ["dvp.document"], "detail-type": ["DocumentUploaded"]}' \
  --region us-east-1 2>/dev/null || echo "  -> dvp-document-uploaded rule exists"

aws events put-rule \
  --name dvp-ocr-completed \
  --event-pattern '{"source": ["dvp.document"], "detail-type": ["OCRCompleted"]}' \
  --region us-east-1 2>/dev/null || echo "  -> dvp-ocr-completed rule exists"

aws events put-rule \
  --name dvp-verification-completed \
  --event-pattern '{"source": ["dvp.document"], "detail-type": ["VerificationCompleted"]}' \
  --region us-east-1 2>/dev/null || echo "  -> dvp-verification-completed rule exists"

# ---------------------------------------------------------------------------
# 3. Create IAM Roles
# ---------------------------------------------------------------------------
echo "[3/5] Creating IAM roles..."

aws iam create-role \
  --role-name LambdaRole \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
  --region us-east-1 2>/dev/null || echo "  -> LambdaRole already exists"

aws iam create-role \
  --role-name EKSWorkerRole \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
  --region us-east-1 2>/dev/null || echo "  -> EKSWorkerRole already exists"

aws iam create-role \
  --role-name S3AccessRole \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"arn:aws:iam::000000000000:role/LambdaRole"},"Action":"sts:AssumeRole"}]}' \
  --region us-east-1 2>/dev/null || echo "  -> S3AccessRole already exists"

# ---------------------------------------------------------------------------
# 4. Attach IAM Policies to Roles
# ---------------------------------------------------------------------------
echo "[4/5] Attaching IAM policies..."

aws iam put-role-policy \
  --role-name LambdaRole \
  --policy-name S3Access \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:GetObject","s3:PutObject"],"Resource":["arn:aws:s3:::dvp-documents-raw/*","arn:aws:s3:::dvp-documents-processed/*"]}]}' \
  --region us-east-1 2>/dev/null || echo "  -> LambdaRole:S3Access policy exists"

aws iam put-role-policy \
  --role-name LambdaRole \
  --policy-name EventBridgeAccess \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"events:PutEvents","Resource":"*"}]}' \
  --region us-east-1 2>/dev/null || echo "  -> LambdaRole:EventBridgeAccess policy exists"

aws iam put-role-policy \
  --role-name LambdaRole \
  --policy-name RDSDataAccess \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["rds-data:ExecuteStatement","rds-data:BatchExecuteStatement"],"Resource":"*"}]}' \
  --region us-east-1 2>/dev/null || echo "  -> LambdaRole:RDSDataAccess policy exists"

aws iam put-role-policy \
  --role-name EKSWorkerRole \
  --policy-name S3ReadAccess \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:GetObject"],"Resource":["arn:aws:s3:::dvp-documents-raw/*","arn:aws:s3:::dvp-documents-processed/*"]}]}' \
  --region us-east-1 2>/dev/null || echo "  -> EKSWorkerRole:S3ReadAccess policy exists"

# ---------------------------------------------------------------------------
# 5. Verify Resources
# ---------------------------------------------------------------------------
echo "[5/5] Verifying resources..."

echo ""
echo "S3 Buckets:"
aws s3 ls --region us-east-1 2>/dev/null

echo ""
echo "EventBridge Rules:"
aws events list-rules \
  --region us-east-1 \
  --query "Rules[?contains(Name, 'dvp')].Name" \
  --output text 2>/dev/null

echo ""
echo "IAM Roles:"
aws iam list-roles \
  --region us-east-1 \
  --query "Roles[?contains(RoleName, 'Role')].[RoleName]" \
  --output text 2>/dev/null

echo ""
echo "=========================================="
echo "DVP resource initialization complete!"
echo "=========================================="
