from duckduckgo_search import DDGS

backends = ['api', 'html', 'lite']
query = "every breath you take lyrics"

print(f"Query: {query}")

for backend in backends:
    print(f"\n--- Testing backend: {backend} ---")
    try:
        results = list(DDGS().text(query, backend=backend, max_results=3))
        print(f"Found {len(results)} results")
        for r in results:
            print(f"  Title: {r['title']}")
    except Exception as e:
        print(f"  Error: {e}")
