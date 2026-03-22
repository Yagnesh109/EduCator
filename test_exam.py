import sys, os, json
sys.path.insert(0, os.path.abspath('backend'))
from dotenv import load_dotenv
load_dotenv('backend/.env')
from services.exam_service import _call_gemini_exam, extract_gemini_text

prompt = """You are an exam setter. Build a timed mock exam focused strictly on the syllabus and past papers provided.
Total questions: 10. Total time (minutes): 30.
Respect the provided sections/weights; if counts do not sum to total, scale proportionally.
Output a strict JSON object with keys: sections, questions, timing.
sections: list of {name, plannedQuestions, weight, focusTopics[]}.
questions: list of objects with fields {id, section, question, options[4], answer, explanation, difficulty (easy|medium|hard), suggestedTimeMinutes}.
timing: {totalMinutes, recommendedPacingPerSection: map section->minutes}.
Use only syllabus/past paper topics; avoid generic filler.
Return JSON only, no markdown, no comments.
Syllabus:
8086 Internal Architecture (Registers, Flags), Real Mode Memory Addressing Basics, Addressing Mode Types
Sections requested:
- Concepts (7 questions, weight 0.35)
"""

try:
    print("Calling Gemini API...")
    body = _call_gemini_exam(prompt, max_output_tokens=8192)
    data = json.loads(body)
    
    with open('api_response.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
        
    text = extract_gemini_text(data)
    with open('api_text.txt', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Done. Wrote api_response.json and api_text.txt")
except Exception as e:
    print("ERROR:", e)
