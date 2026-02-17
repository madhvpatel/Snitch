#!/usr/bin/env python3
"""Test script for Python ACRCloud backend"""

import requests
import json

API_BASE = 'http://localhost:3001'

print('🧪 Testing Python ACRCloud Backend\n')

# Test 1: Health Check
def test_health():
    print('Test 1: Health Check')
    try:
        response = requests.get(f'{API_BASE}/health')
        data = response.json()
        print(f'✅ {data["message"]}')
        return True
    except Exception as e:
        print(f'❌ Failed: {e}')
        return False

# Test 2: Lyrics endpoint
def test_lyrics():
    print('\nTest 2: Lyrics Search')
    
    # Test Case 1: Rick Astley (Check basic functionality)
    print('  Sub-test 1: "Never Gonna Give You Up"')
    try:
        response = requests.post(
            f'{API_BASE}/api/identify-lyrics',
            json={'lyrics': 'never gonna give you up'}
        )
        data = response.json()
        if response.ok:
            print(f'  ✅ Found: {data["title"]} by {data["artist"]} (Label: {data.get("label")})')
        else:
            print(f'  ❌ Failed: {data.get("error")}')
            return False
    except Exception as e:
        print(f'  ❌ Failed: {e}')
        return False
        
    # Test Case 2: The Police (Check fix for previous failure)
    print('\n  Sub-test 2: "Every Breath You Take"')
    try:
        response = requests.post(
            f'{API_BASE}/api/identify-lyrics',
            json={'lyrics': 'every breath you take every move you make'}
        )
        data = response.json()
        if response.ok:
            print(f'  ✅ Found: {data["title"]} by {data["artist"]} (Label: {data.get("label")})')
            # Verify it's NOT Ed Sheeran
            if "Sheeran" in data["artist"]:
                 print('  ❌ Incorrect match: Still matching Ed Sheeran!')
                 return False
            return True
        else:
            print(f'  ❌ Failed: {data.get("error")}')
            return False
    except Exception as e:
        print(f'  ❌ Failed: {e}')
        return False

# Run tests
if __name__ == '__main__':
    results = []
    results.append(test_health())
    results.append(test_lyrics())
    
    passed = sum(results)
    total = len(results)
    
    print('\n' + '='*50)
    print(f'📊 Results: {passed}/{total} passed')
    
    if passed == total:
        print('🎉 All tests passed!')
    else:
        print('⚠️  Some tests failed')
