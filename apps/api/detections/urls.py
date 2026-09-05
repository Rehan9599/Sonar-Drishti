from django.urls import path

from . import views

urlpatterns = [
    path("upload/", views.upload),
    path("jobs/", views.job_list),
    path("jobs/<uuid:job_id>/", views.job_detail),
    path("detections/<uuid:job_id>/", views.detections),
    path("detections/<uuid:detection_id>/review/", views.review),
    path("export/<uuid:job_id>/", views.export),
]
