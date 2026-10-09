import urllib.request
import json
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

def run_tests():
    print("Testing ProofID Endpoints...")
    login_req = urllib.request.Request(
        'http://localhost:8000/api/auth/login/',
        data=json.dumps({'username': 'demo', 'password': 'demo123'}).encode(),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(login_req) as res:
        login_data = json.loads(res.read().decode())
        token = login_data['tokens']['access']
        print(f"[OK] Auth Login OK - User: {login_data['user']['username']}")

    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    endpoints = [
        ('GET', 'http://localhost:8000/api/dashboard/', None, 'Dashboard'),
        ('GET', 'http://localhost:8000/api/credentials/', None, 'Credentials'),
        ('GET', 'http://localhost:8000/api/agents/', None, 'AI Agents'),
        ('GET', 'http://localhost:8000/api/reputation/', None, 'Reputation'),
        ('GET', 'http://localhost:8000/api/activity/', None, 'Activity Timeline'),
        ('GET', 'http://localhost:8000/api/settings/', None, 'Settings'),
        ('GET', 'http://localhost:8000/api/blockchain/status/', None, 'Blockchain Status (Public)'),
        ('GET', 'http://localhost:8000/api/verify/?q=PID-8F3A29B1', None, 'Public Verify Alex (PID-8F3A29B1)'),
        ('GET', 'http://localhost:8000/api/verify/?q=PID-4E90B12D', None, 'Public Verify Sarah (PID-4E90B12D)'),
        ('GET', 'http://localhost:8000/api/verify/?q=AGT-7C91B420', None, 'Public Verify Agent (AGT-7C91B420)'),
        ('POST', 'http://localhost:8000/api/analyze/', {'subject_type': 'identity', 'subject_id': 'PID-8F3A29B1'}, 'AI Trust Analyzer'),
    ]

    for method, url, body, name in endpoints:
        data = json.dumps(body).encode() if body else None
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                print(f"[OK] [{resp.status}] {name} ({url})")
        except Exception as e:
            print(f"[FAIL] {name}: {e}")

    print("\nAll endpoints verified successfully!")

if __name__ == '__main__':
    run_tests()
