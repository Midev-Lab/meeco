"""AWS Lambda entry point (Function URL, payload format 2.0). Same FastAPI app as everywhere else.

Why Lambda suits this app: the backend never touches the audio (the browser uploads straight to S3), every call is
short except /finalize (up to 15 min, which a Function URL allows), and there is no idle server to put to sleep.
Background tasks (the early title) run before the response is returned, since Lambda freezes after it.
"""
from mangum import Mangum

from app.main import create_app

handler = Mangum(create_app(), lifespan="off")
