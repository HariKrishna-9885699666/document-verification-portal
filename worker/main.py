"""
DVP OCR Worker - Document Text Extraction Service

This service simulates an Amazon EKS worker pod that processes uploaded documents.
In production, it would:
  1. Listen for DocumentUploaded events from Amazon EventBridge
  2. Download the document from S3
  3. Run Tesseract/PaddleOCR for text extraction
  4. Post extracted data back to the backend via PATCH /api/documents/:id/ocr
  5. Store OCR JSON in the processed S3 bucket

For local development, it uses Floci's S3 and EventBridge emulation.

Document type-specific extractors use regex patterns for:
  - Aadhaar: 12-digit number, name, date of birth
  - PAN: 10-character alphanumeric, name
  - Passport: 8-character alphanumeric, name
"""

import os
import json
import logging
import re
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Configure structured logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ocr-worker")

app = FastAPI(
    title="DVP OCR Worker",
    description="Document text extraction service for the Document Verification Portal",
    version="1.0.0",
)

# Backend URL for posting OCR results (configured via environment variable)
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:4000/api")


class OCRTask(BaseModel):
    """Payload received when an OCR processing task is triggered."""
    document_id: str  # UUID of the document in the database
    s3_key: str       # S3 object key for the uploaded document
    document_type: str  # Document type: AADHAAR, PAN, PASSPORT, etc.


# ---------------------------------------------------------------------------
# Document Type-Specific Extractors
# Each extractor uses regex patterns to identify fields from OCR text.
# Accuracy depends on image quality and OCR engine configuration.
# ---------------------------------------------------------------------------

def extract_aadhaar(text: str) -> dict:
    """
    Extract fields from an Indian Aadhaar card.
    
    Fields:
      - aadhaar_number: 12-digit number (XXXX XXXX XXXX)
      - name: Cardholder name
      - dob: Date of birth
    """
    data = {}
    aadhaar_match = re.search(r"\b\d{4}\s?\d{4}\s?\d{4}\b", text)
    if aadhaar_match:
        data["aadhaar_number"] = aadhaar_match.group().replace(" ", "")
    name_match = re.search(r"(?:Name|नाम)[:\s]*([A-Za-z\s]+)", text, re.IGNORECASE)
    if name_match:
        data["name"] = name_match.group(1).strip()
    dob_match = re.search(r"(?:DOB|Date of Birth|जन्म तिथि)[:\s]*([\d/\-\.]+)", text, re.IGNORECASE)
    if dob_match:
        data["dob"] = dob_match.group(1).strip()
    return data


def extract_pan(text: str) -> dict:
    """
    Extract fields from a PAN card.
    
    Fields:
      - pan_number: 10-character alphanumeric (AAAAA9999A)
      - name: Cardholder name
    """
    data = {}
    pan_match = re.search(r"\b[A-Z]{5}\d{4}[A-Z]\b", text)
    if pan_match:
        data["pan_number"] = pan_match.group()
    name_match = re.search(r"(?:Name|नाम)[:\s]*([A-Z\s]+)", text, re.IGNORECASE)
    if name_match:
        data["name"] = name_match.group(1).strip()
    return data


def extract_passport(text: str) -> dict:
    """
    Extract fields from a Passport.
    
    Fields:
      - passport_number: Alphanumeric (varies by country, e.g., A1234567)
      - name: Passport holder name
    """
    data = {}
    passport_match = re.search(r"\b[A-Z]\d{7}\b", text)
    if passport_match:
        data["passport_number"] = passport_match.group()
    name_match = re.search(r"(?:Surname|Given Name|Name)[:\s]*([A-Z\s]+)", text, re.IGNORECASE)
    if name_match:
        data["name"] = name_match.group(1).strip()
    return data


# Registry of document type extractors
# Add new extractors here as document types are added
EXTRACTORS = {
    "AADHAAR": extract_aadhaar,
    "PAN": extract_pan,
    "PASSPORT": extract_passport,
}


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@app.post("/process")
async def process_document(task: OCRTask):
    """
    Process a document using OCR and post results back to the backend.
    
    This is the main processing endpoint, typically triggered by an
    EventBridge event (DocumentUploaded) in the production workflow.
    
    Steps:
      1. Download document from S3 (using s3_key)
      2. Run OCR using Tesseract/PaddleOCR
      3. Extract structured fields using document type-specific extractors
      4. Post extracted data to backend via PATCH /api/documents/:id/ocr
      5. Return the extracted data
    
    Args:
        task: OCRTask with document_id, s3_key, and document_type
    
    Returns:
        Dictionary with status, document_id, and extracted ocr_data
    """
    logger.info(f"Processing document {task.document_id} of type {task.document_type}")

    try:
        # -------------------------------------------------------------------
        # Step 1: Download document from S3
        # In production:
        #   s3 = boto3.client("s3")
        #   s3.download_file("dvp-documents-raw", task.s3_key, local_path)
        # -------------------------------------------------------------------

        # -------------------------------------------------------------------
        # Step 2: Run OCR
        # In production:
        #   import pytesseract
        #   from PIL import Image
        #   img = Image.open(local_path)
        #   text = pytesseract.image_to_string(img)
        #
        # For local development, simulate OCR with sample data
        # -------------------------------------------------------------------
        text = f"Simulated OCR text for {task.document_type} document"

        # -------------------------------------------------------------------
        # Step 3: Extract structured fields
        # Use the appropriate extractor based on document type
        # -------------------------------------------------------------------
        extractor = EXTRACTORS.get(task.document_type)
        ocr_data = extractor(text) if extractor else {"extracted_text": text}

        # -------------------------------------------------------------------
        # Step 4: Post results to backend
        # -------------------------------------------------------------------
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{BACKEND_URL}/documents/{task.document_id}/ocr",
                json={"ocrData": ocr_data},
            )
            resp.raise_for_status()

        logger.info(f"OCR completed for {task.document_id}")
        return {
            "status": "completed",
            "document_id": task.document_id,
            "ocr_data": ocr_data,
        }

    except Exception as e:
        logger.error(f"OCR failed for {task.document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    """Health check endpoint for Kubernetes liveness/readiness probes."""
    return {"status": "ok"}
