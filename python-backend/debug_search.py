from googlesearch import search

query = "never gonna give you up song lyrics"
print(f"Searching for: {query}")

try:
    results = list(search(query, num_results=5, advanced=True))
    print(f"Found {len(results)} results:")
    for i, res in enumerate(results):
        print(f"{i+1}. Title: {res.title}")
        print(f"   Desc: {res.description[:100]}...")
        
except Exception as e:
    print(f"Error: {e}")
