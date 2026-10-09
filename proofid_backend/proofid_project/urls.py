"""ProofID URL Configuration"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.http import FileResponse
import os

def serve_frontend(request, path=''):
    """Serve the frontend index.html for all non-API routes"""
    frontend_path = os.path.join(settings.BASE_DIR.parent, 'frontend', 'index.html')
    return FileResponse(open(frontend_path, 'rb'), content_type='text/html')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    # Serve frontend for all other routes
    path('', serve_frontend),
    path('<path:path>', serve_frontend),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
