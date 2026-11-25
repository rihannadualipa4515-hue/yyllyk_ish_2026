from django.urls import path

from . import views


app_name = "courses"

urlpatterns = [
    path("", views.index, name="index"),
    path("health/", views.health, name="health"),
    path("learn/<slug:course_id>/", views.learn, name="learn"),
    path("learn/<slug:course_id>/<int:step_index>/", views.learn, name="lesson"),
]
