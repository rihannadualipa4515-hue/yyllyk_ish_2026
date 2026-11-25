import re

from django.http import Http404
from django.shortcuts import render

from .data import get_course, get_courses


def index(request):
    return render(request, "courses/index.html", {"courses": get_courses()})


def learn(request, course_id, step_index=0):
    course = get_course(course_id)
    if course is None:
        raise Http404("Kurs tapylmady")
    if step_index < 0 or step_index >= len(course["steps"]):
        raise Http404("Sapak tapylmady")

    step = course["steps"][step_index]
    return render(
        request,
        "courses/learn.html",
        {
            "courses": get_courses(),
            "course": course,
            "step": step,
            "step_index": step_index,
            "step_count": len(course["steps"]),
            "step_number": step_index + 1,
            "previous_index": step_index - 1,
            "next_index": step_index + 1,
            "has_previous": step_index > 0,
            "has_next": step_index < len(course["steps"]) - 1,
            "example_lines": step["example"].splitlines(),
            "paragraphs": step["text"].split("\n\n"),
            "check_pattern": step.get("check", ""),
        },
    )


def health(request):
    return render(request, "courses/health.html", {"course_count": len(get_courses())})
