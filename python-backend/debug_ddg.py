from duckduckgo_search import DDGS

print("Testing DuckDuckGo Search...")
try:
    results = list(DDGS().text("never gonna give you up lyrics", region='us-en', max_results=5))
    print(f"Found {len(results)} results")
    for r in results:
        print(f"Title: {r['title']}")
        print(f"Desc: {r['body'][:50]}...")
except Exception as e:
    print(f"Error: {e}")
