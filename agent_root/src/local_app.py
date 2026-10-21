"""Local video API without PostgreSQL, Redis, or a graph connection."""
from src.main import create_app
app = create_app(start_runner=False, initialize_graph=False)
