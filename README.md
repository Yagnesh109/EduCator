# Week 4: Advanced Study Mechanics & Exam Simulation

## Educational Content Generator AI Agent Development Project - Dual Track Version - EduCator

EduCator is a study assistant that turns uploaded content into multiple study resources (MCQs, flashcards, true/false, fill-in-the-blanks, and summaries), with optional text-to-speech and audio generation.

## Current Workflow
1. User logs in (Google or email/password).
2. User adds one or more sources (text + files like `.txt`, `.pdf`, `.docx`, `.pptx`) into a single session.
3. User generates study resources (default 20 items per tool where applicable):
   - MCQs
   - Flashcards
   - True/False
   - Fill-in-the-Blanks
   - Summary
4. User practices each resource type and sees scoring/progress (where applicable).
5. User analyzes Knowledge Gaps to get concept explanations based on wrong answers.
6. AI Guide answers text or voice questions grounded in the uploaded sources.
6. User can:
   - Regenerate results for the same source
   - Generate for a new source
   - Save results to history
7. History can be viewed, expanded, and items deleted.
8. Summary can be spoken (server TTS) and the displayed summary text can be translated to the selected language.
9. Download outputs (PDF/CSV/Text) from study pages.

## Features Implemented
- Multi-format input: TXT, PDF, DOCX, PPTX
- Multi-source sessions (generation uses all added sources in the session)
- MCQ generation + answer verification + scoring/progress
- Flashcard generation + review tracking
- True/False generation + scoring/progress
- Fill-in-the-Blanks generation + scoring/progress
- Summary generation (separate summary page)
- Difficulty levels (easy / medium / hard) with instant re-generation on supported pages
- Knowledge Gap Analyzer (mode-specific) with concept explanations based on wrong answers
- AI Guide (text + voice toggle)
- Voice assistant: speech input + spoken answers
- Server audio generation (MP3) via `/api/tts`
- Summary text translation via `/api/translate`
- OpenRouter integration
  - MCQs: OpenRouter (google/gemini-2.5-flash)
  - Flashcards: OpenRouter (google/gemini-2.5-flash)
  - Summary: OpenRouter via (google/gemini-2.5-flash)
  - Voice assistant: OpenRouter (google/gemini-2.5-flash)
- Temporary file storage for uploads (fileId restore on return)
- History storage in Firestore
- History list with per-item details + delete + clear all
- Export/download (PDF, CSV, Text) on study pages
- More MCQs/Flashcards: backend refill endpoint exists (UI button not added yet)
- Voice options: language selector available

## Week 4 Features: Implementation Details & Use Cases

### Spaced Repetition Queue
- **Implementation**: Built `SpacedPlanSection.js` mapped to 5 intervals (1, 2, 4, 7, and 14 days). User interactions ("I knew this", "Need review") dynamically compute the next review date via epoch timestamps. State is persisted in Firestore under the user's account by tying into the `HistoryPanel` session saves.
- **Use Case**: Maximizes long-term memory retention. The system automatically schedules flashcards. The schedule is backed by Firestore, meaning a user can log in from any device and their exact study queue is ready for them.

### Key Topics at a Glance
- **Implementation**: Utilized the Gemini/OpenRouter API to extract high-level summaries from the uploaded source text, rendering them immediately via `KnowledgeGapSection.js` and `SummarySection.js` acting as dynamic table of contents.
- **Use Case**: Acts as an automated table of contents. Immediately after uploading a document or notes, the app scans the content and extracts the main themes. This allows users to quickly understand the scope of the material and identify what they need to learn first before diving into individual questions.

### Persistent Study Plan (History)
- **Implementation**: Developed a comprehensive `/api/history/session` backend endpoint and a `HistoryPage.js` UI. It serializes the active session state (MCQs, flashcards, blanks, tracking) and stores it in Firebase Firestore permanently tied to the authenticated user's ID.
- **Use Case**: Ensures no progress is lost. The user's active session, including generated MCQs, flashcards, and review plans, is saved to their account history. They can close the app today and perfectly resume their study session tomorrow.

### Adjustable Difficulty
- **Implementation**: Added `DifficultySelect.js` to the UI, passing user selections to prompt-engineered templates in `gemini_service.py` to dynamically adjust LLM output complexity (Easy, Medium, Hard).
- **Use Case**: Keeps the learner in their optimal zone of proximal development. The AI generation engine adjusts the complexity of the questions. Users can select their preferred difficulty level, ensuring beginners aren't overwhelmed and advanced students are adequately challenged.

### Voice and Audio Helpers
- **Implementation**: Integrated browser native `SpeechRecognition` in `UploadPage.js` for microphone input. Backend `/api/tts` uses TTS generation to stream spoken audio responses directly to the user.
- **Use Case**: Enables hands-free and auditory learning. Users can use their microphone to ask the AI guide questions about the material and receive spoken, text-to-speech answers. It also supports listening to summaries in different languages, catering to diverse learning preferences.

### History and Exports
- **Implementation**: Built `ExportSection.js` utilizing frontend browser APIs to format JSON flashcard/MCQ arrays into downloadable Text, CSV, and generated PDFs right from the study pages.
- **Use Case**: Facilitates offline studying and sharing. If a user wants to study away from their screen, they can export their dynamically generated study sets directly to PDF, CSV, or TXT formats to print out or share with classmates.

### Future-Ready Diagram Support
- **Implementation**: Designed the `source/upload` API and frontend file handlers robustly enough to accommodate image parsing logic gracefully in the future (serving as architectural placeholders). 
- **Use Case**: The system's file upload architecture is structured to accommodate image processing. This acts as a foundation, ready to be plugged in when visual diagram and whiteboard parsing features are rolled out in the future.

### Mock Exam Simulator
- **Implementation**: Built `ExamMockPage.js` containing real-time timer logic and score grading. On the backend, created `exam_service.py` utilizing a customized Gemini prompt to enforce valid JSON generation mapped exactly to student-uploaded syllabus sections and weights.
- **Use Case**: Provides high-stakes, realistic test practice. A student uploads their specific course syllabus and optionally past exam papers. They define the desired length and duration. The system's AI then generates a comprehensive, timed practice exam perfectly mapped to their syllabus topics. The exam interface features a sticky countdown timer. Upon completion, it auto-submits, calculates the final score, and reveals correct answers alongside detailed explanations.

## Tech Stack
- Frontend: React
- Backend: FastAPI (Python)
- AI: OpenRouter + Gemini (fallback)
- Database: Firebase Firestore

