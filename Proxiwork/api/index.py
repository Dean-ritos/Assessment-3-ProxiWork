from pathlib import Path
import importlib.util

backend_index = (
    Path(__file__).resolve().parent.parent
    / "backend"
    / "api"
    / "index.py"
)

spec = importlib.util.spec_from_file_location(
    "backend_api_index",
    backend_index,
)

if spec is None or spec.loader is None:
    raise ImportError(
        f"Unable to load backend application from {backend_index}"
    )

backend_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backend_module)

app = backend_module.app
