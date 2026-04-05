# Week 6: Content-to-Learning Materials Converter & Smart Study Assistant

# Educational Content Generator AI Agent Development Project – Dual Track Version - Educator
EduCator turns uploaded study content into practice material (MCQs, flashcards, fill-in-the-blanks, true/false, and summaries) and adds retention tools like spaced repetition, revision, and mock exams.

## Current Workflow
1. User logs in (Google or email/password).
2. User adds one or more sources into a single session (text + files: `.txt`, `.pdf`, `.docx`, `.pptx`).
3. From the Upload page, user generates study tools (UI defaults to **12** items per tool where applicable):
   - MCQs
   - Flashcards (optionally with images)
   - Summary
   - Fill-in-the-Blanks (Premium)
   - True/False (Premium)
4. User practices on the respective pages, gets scoring/progress, and can export results.
5. On the Study Set page, the app builds a spaced-repetition plan and can run Knowledge Gap + Smart Revision analysis.
6. AI Guide answers questions grounded in the uploaded sources (text + optional voice answer).
7. Sessions are saved to History (Firestore) and can be restored later.
8. Premium tools can be unlocked via Stripe test-mode checkout (feature-gated in UI + backend).

## Features Implemented (from codebase)
FEATURES IMPLEMENTED

- Multi-format ingestion:
  Supports TXT, PDF, DOCX, PPTX text extraction with temporary upload storage (fileId restore)

- Multi-source sessions:
  Content generation uses all added sources within a session

- MCQ System:
  MCQ generation, verification (/api/verify/mcq), scoring and progress tracking in UI

- Flashcards:
  AI-generated flashcards with image enrichment via Unsplash/Pexels APIs and review marking

- Difficulty Control:
  Easy, Medium, Hard levels with instant regeneration

- Topic Extraction:
  Key topics extraction via /api/analyze/topics

- Spaced Repetition:
  Leitner-based scheduling via /api/spaced/schedule with Firestore save/load

- Smart Revision:
  Prioritizes weak topics and due cards, generates focused revision quiz (/api/revision/start)

- Knowledge Gap Analyzer (Premium):
  Weak topic detection and grounded revision notes via /api/recommend/knowledge-gaps

- AI Guide (RAG-based):
  Context-aware Q&A grounded in uploaded sources via /api/qa/source

- Voice Features:
  Speech-to-text (Web Speech API)
  Voice Q&A (/api/qa/voice)
  Audio summaries via /api/tts (Premium: audio_summary)

- Translation:
  Text and summary translation via /api/translate

- Mock Exam Generator (Premium):
  Full-length exam generation via /api/exam/mock

- YouTube Guide (Premium):
  Video recommendations via /api/youtube/recommend (YouTube Data API)

- Export Options:
  PDF, CSV, and quiz format via /api/export/study-set/{pdf|csv|quiz}

- Billing:
  Stripe Checkout, webhook integration, server-side entitlements (/api/billing/*)

- Diagnostics:
  Firebase connectivity check via /api/diag/firebase

- Diagram OCR:
  Extracts text from diagrams/whiteboards using Tesseract (/api/analyze/diagram)


## TECH STACK

Frontend:
- React (Create React App)
- React Router
- CSS
- Firebase JS SDK
- react-toastify

Backend:
- FastAPI
- Uvicorn
- PyPDF2 (PDF processing)
- gTTS (Text-to-Speech)
- Firebase Admin SDK
- Stripe SDK

Database and Storage:
- Firebase Firestore (user history and spaced repetition data)