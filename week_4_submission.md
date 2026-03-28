# Week 4 Progress Report: Advanced Study Mechanics & Exam Simulation

In Week 4, our primary focus was transforming the core app from a basic content generator into a **personalized, highly interactive studying platform**. We focused on long-term retention tools, dynamic difficulty, and realistic exam simulation. 

Here are the 8 major features we implemented this week:

## 1. Mock Exam Simulator
* **What we did:** We built a feature (`ExamMockPage.js` and `exam_service.py`) that generates a full practice test based on a student’s uploaded syllabus and past papers. It enforces proper JSON generation via Gemini to create a sectioned exam with specific weights.
* **Why it matters:** It gives students high-stakes, timed practice with auto-grading and detailed explanations, perfectly mimicking real exam pressure.

## 2. Spaced Repetition Queue
* **What we did:** We implemented a smart flashcard scheduling system mapped to 5 intervals (1, 2, 4, 7, and 14 days). The app dynamically computes the next review date based on whether the user marks front/back cards as "I knew this" or "Need review".
* **Why it matters:** This automates study schedules and ensures maximum long-term memory retention so students don't forget older material.

## 3. Persistent Study Plan
* **What we did:** We developed backend endpoints (`/api/history/session`) and tied them to Firebase Firestore to permanently save the user's active session, review plans, and generated MCQs/flashcards to their account.
* **Why it matters:** Users can now start studying on one device, close the app, and seamlessly resume their exact progress later without losing any data.

## 4. Key Topics at a Glance
* **What we did:** We utilized the AI APIs to automatically extract high-level themes from any uploaded material and display them as a dynamic table of contents.
* **Why it matters:** It acts as a quick primer, helping the user understand the scope of the upload before they dive into individual questions.

## 5. Adjustable Difficulty
* **What we did:** We created UI controls and prompt-engineered custom AI instructions allowing users to scale the complexity of the generated questions between Easy, Medium, and Hard.
* **Why it matters:** It keeps the learner in their optimal comfort zone—preventing beginners from feeling overwhelmed while ensuring advanced students are adequately challenged.

## 6. Voice and Audio Helpers
* **What we did:** We integrated Web Speech APIs for microphone input and a backend `/api/tts` endpoint for generating spoken audio responses.
* **Why it matters:** This makes the platform much more accessible, supporting auditory learners and allowing for hands-free study sessions.

## 7. History and Exports
* **What we did:** We built an export suite that allows users to instantly convert their dynamically generated flashcards and MCQs into formatted PDF, CSV, or Text files straight from the browser.
* **Why it matters:** It allows students to take their study materials offline, print them out, or easily share them with classmates.

## 8. Future-Ready Diagram Architecture
* **What we did:** We designed the backend upload handlers securely and robustly to serve as placeholders for upcoming image processing capabilities.
* **Why it matters:** It lays the architectural groundwork so that, in future weeks, we can seamlessly plug in visual diagram parsing and whiteboard image support. 

--- 
**Summary Statement:** 
"This week, we took the platform from generating plain text to creating a fully interactive, cross-device study experience. We successfully deployed spaced repetition algorithms, a high-stakes mock exam simulator, dynamic difficulty scaling, and comprehensive session saving via Firestore—ensuring students can study effectively for long-term retention."
