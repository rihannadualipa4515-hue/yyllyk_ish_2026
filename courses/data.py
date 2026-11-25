import json
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def get_courses():
    data_path = Path(__file__).with_name("lesson_data.json")
    with data_path.open(encoding="utf-8") as data_file:
        return json.load(data_file)


def get_course(course_id):
    return next((course for course in get_courses() if course["id"] == course_id), None)
