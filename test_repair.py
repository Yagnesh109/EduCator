import sys, os, json
sys.path.insert(0, os.path.abspath('backend'))
from utils.mcq_utils import _repair_json_text

text = """{
  "sections": [
    {
      "name": "Concepts",
      "plannedQuestions": 7,
      "weight": 0.35,
      "focusTopics": [
        "8086 Internal Architecture (Registers, Flags)",
        "Real"""

try:
    repaired = _repair_json_text(text)
    print("REPAIRED:")
    print(repaired)
    print("---------")
    print("LOADING JSON...")
    json.loads(repaired)
    print("SUCCESS")
except Exception as e:
    import traceback
    traceback.print_exc()
