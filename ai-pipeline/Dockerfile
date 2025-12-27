# AI Pipeline Docker Image
# Intel OpenVINO + YOLO based vehicle detection

FROM openvino/ubuntu22_runtime:2024.0.0

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-pip \
    python3-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/
COPY run.py .
COPY config.json* ./

# Create models directory
RUN mkdir -p /app/models

# Set default environment variables
ENV API_ENDPOINT=http://host.docker.internal:3000/api/realtime/detection \
    DEVICE=CPU \
    MQTT_HOST=host.docker.internal \
    MQTT_PORT=1883

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python3 -c "import sys; sys.exit(0)"

# Run the pipeline
CMD ["python3", "run.py", "--config", "config.json"]
