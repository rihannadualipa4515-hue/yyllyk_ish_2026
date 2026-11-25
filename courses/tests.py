from django.test import TestCase
from django.urls import reverse

from .data import get_courses


class CoursePagesTests(TestCase):
    def test_home_lists_all_courses(self):
        response = self.client.get(reverse("courses:index"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Git")
        self.assertContains(response, "GitHub")
        self.assertContains(response, "Docker")

    def test_course_page_renders_lesson_and_simulator(self):
        response = self.client.get(reverse("courses:learn", args=["git"]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Taslama üstünde işlemegiň kynçylyklary")
        self.assertContains(response, 'id="terminal-form"')
        self.assertContains(response, 'id="course-data"')

    def test_lesson_sidebar_contains_every_course_lesson(self):
        response = self.client.get(reverse("courses:learn", args=["git"]))

        self.assertContains(response, 'class="lesson-list"')
        self.assertEqual(
            response.content.count(b'data-lesson='),
            len(get_courses()[0]["steps"]),
        )

    def test_all_legacy_lessons_are_loaded(self):
        courses = get_courses()

        self.assertEqual([course["id"] for course in courses], ["git", "github", "docker"])
        self.assertEqual(sum(len(course["steps"]) for course in courses), 83)

    def test_unknown_course_and_lesson_return_404(self):
        self.assertEqual(self.client.get("/learn/unknown/").status_code, 404)
        self.assertEqual(self.client.get("/learn/git/999/").status_code, 404)

    def test_health_page(self):
        response = self.client.get(reverse("courses:health"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Kurs sany: 3")

    def test_every_lesson_route_is_reachable(self):
        for course in get_courses():
            for step_index in range(len(course["steps"])):
                with self.subTest(course=course["id"], step=step_index):
                    response = self.client.get(
                        reverse("courses:lesson", args=[course["id"], step_index])
                    )
                    self.assertEqual(response.status_code, 200)
