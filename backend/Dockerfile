FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies (FFmpeg for video clipping, Node.js for yt-dlp JS signature engine)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    nodejs \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Create unprivileged system user for secure container execution
RUN groupadd -g 10001 appuser && \
    useradd -u 10001 -g appuser -s /bin/bash -m appuser && \
    mkdir -p /app/tmp_media && \
    chown -R appuser:appuser /app

# Copy application source code
COPY --chown=appuser:appuser . /app

# Switch to non-root user
USER appuser

# Expose port (Render dynamically assigns $PORT)
EXPOSE 8000

# Start FastAPI application using Uvicorn
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
