FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy seed scripts
COPY . .

# Run the seeder
CMD ["python", "-u", "seed_splunk.py"]
