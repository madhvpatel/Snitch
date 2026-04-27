import os
from dotenv import load_dotenv
import sys
from google.adk.agents import LlmAgent
from google.adk.apps.app import App

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from adk_utils.plugins import Graceful429Plugin

graceful_plugin = Graceful429Plugin(
    name="graceful_429_plugin",
    fallback_text={
        "SFO": "**[Simulated Response via 429 Graceful Fallback]**\n\nThe route from Googleplex to SFO is approximately 25 miles north on US-101. It takes about 30-45 minutes depending on traffic.",
        "Berlin": "**[Simulated Response via 429 Graceful Fallback]**\n\nThe route from Paris to Berlin is about 1,050 km via the A2 autobahn. It typically takes 10-12 hours of driving.",
        "default": "**[Simulated Response via 429 Graceful Fallback]**\n\nThe Google Maps API is currently out of quota. Please retry later or ask a different question."
    }
)
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, \
                StdioServerParameters, StdioConnectionParams
from google.adk.models import Gemini
from google.genai.types import HttpRetryOptions

load_dotenv()
google_maps_api_key = os.environ.get("GOOGLE_MAPS_API_KEY")

if not google_maps_api_key:
    print("WARNING: GOOGLE_MAPS_API_KEY is not set. Please set it as an environment variable or update it in the script.")

RETRY_OPTIONS = HttpRetryOptions(initial_delay=1, max_delay=3, attempts=30)

root_agent = LlmAgent(
    model=Gemini(model=os.getenv("MODEL"), retry_options=RETRY_OPTIONS),
    name='maps_assistant_agent',
    instruction="""
        Help the user with mapping, directions, and finding places
        using Google Maps tools.
    """,

    ## Add the MCPToolset below:
)

tools=[
    MCPToolset(
    connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command='npx',
            args=[
                "-y",
                "@modelcontextprotocol/server-google-maps",
            ],
            env={
                "GOOGLE_MAPS_API_KEY": google_maps_api_key
            }
        ),
        timeout=15,
        ),
    )
],

graceful_plugin.apply_429_interceptor(root_agent)

app = App(
    name="google_maps_mcp_agent",
    root_agent=root_agent,
    plugins=[graceful_plugin]
)
# UNCOMMENT THE LINE BELOW TO TEST FAILOVER:
# graceful_plugin.apply_test_failover(root_agent)``