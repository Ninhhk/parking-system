"""
Gunicorn configuration for LPD API Service
Optimized for production with memory leak mitigation
"""

import multiprocessing
import os

# Server socket
bind = "0.0.0.0:8000"
backlog = 2048

# Worker processes
workers = 1  # Keep single worker for ML workload to avoid memory duplication
worker_class = "sync"
worker_connections = 1000
threads = 2  # Use threads for concurrent requests within single worker

# Worker lifecycle - CRITICAL for memory leak mitigation
max_requests = 100  # Restart worker after 100 requests to clear accumulated memory
max_requests_jitter = 10  # Add randomness to prevent all workers restarting simultaneously
timeout = 120  # 2 minutes timeout for slow OCR operations
graceful_timeout = 30  # 30 seconds for graceful shutdown
keepalive = 5

# Logging
accesslog = "-"  # Log to stdout
errorlog = "-"  # Log to stderr
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "lpd-api"

# Server mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# Environment variables
raw_env = [
    'PYTHONUNBUFFERED=1',
    'PYTHONDONTWRITEBYTECODE=1',
    'OMP_NUM_THREADS=2',
    'MKL_NUM_THREADS=2',
    'OPENBLAS_NUM_THREADS=2',
]

# Hooks
def on_starting(server):
    """Called just before the master process is initialized."""
    server.log.info("Starting LPD API Service with Gunicorn")

def on_reload(server):
    """Called to recycle workers during a reload via SIGHUP."""
    server.log.info("Reloading workers")

def when_ready(server):
    """Called just after the server is started."""
    server.log.info("Server is ready. Spawning workers")

def worker_int(worker):
    """Called when a worker receives SIGINT or SIGQUIT."""
    worker.log.info("Worker received interrupt signal")

def pre_fork(server, worker):
    """Called just before a worker is forked."""
    pass

def post_fork(server, worker):
    """Called just after a worker has been forked."""
    server.log.info(f"Worker spawned (pid: {worker.pid})")

def post_worker_init(worker):
    """Called just after a worker has initialized the application."""
    worker.log.info(f"Worker initialized (pid: {worker.pid})")

def worker_exit(server, worker):
    """Called just after a worker has been exited."""
    server.log.info(f"Worker exited (pid: {worker.pid})")

def pre_exec(server):
    """Called just before a new master process is forked."""
    server.log.info("Forked child, re-executing")

def pre_request(worker, req):
    """Called just before a worker processes the request."""
    worker.log.debug(f"{req.method} {req.path}")

def post_request(worker, req, environ, resp):
    """Called after a worker processes the request."""
    pass

def child_exit(server, worker):
    """Called just after a worker has been exited, in the master process."""
    server.log.info(f"Child worker exited (pid: {worker.pid})")

def worker_abort(worker):
    """Called when a worker received the SIGABRT signal."""
    worker.log.info(f"Worker received SIGABRT signal (pid: {worker.pid})")

def nworkers_changed(server, new_value, old_value):
    """Called just after num_workers has been changed."""
    server.log.info(f"Number of workers changed from {old_value} to {new_value}")
