import urllib.request
import json

BASE = 'http://127.0.0.1:8000/api'

def req(path, method='GET', data=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(f'{BASE}{path}', data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

def main():
    print('=== STEP 1: Registration with credentials ===')
    status, res = req('/auth/register/', 'POST', {
        'username': 'alpha_builder_99',
        'email': 'alpha99@proofid.network',
        'password': 'password123',
        'password_confirm': 'password123',
        'first_name': 'Alpha',
        'last_name': 'Builder'
    })
    print('Register status:', status)
    assert status == 201, f'Registration failed: {res}'
    print('ProofID allocated:', res.get('proof_id'))

    print('\n=== STEP 2: Login with created credentials ===')
    status, res = req('/auth/login/', 'POST', {'username': 'alpha_builder_99', 'password': 'password123'})
    print('Login status:', status)
    assert status == 200, f'Login failed: {res}'
    token = res['tokens']['access']

    print('\n=== STEP 3: Google One-Click Auth ===')
    status, res = req('/auth/google/', 'POST', {'email': 'google.suite.tester@gmail.com', 'name': 'Google Suite Tester'})
    print('Google status:', status)
    assert status == 200, f'Google auth failed: {res}'
    google_token = res['tokens']['access']
    print('Google ProofID:', res.get('proof_id'))

    print('\n=== STEP 4: GitHub Developer Sign-In ===')
    status, res = req('/auth/github/', 'POST', {'username': 'monad-dev-suite', 'name': 'Monad Developer'})
    print('GitHub status:', status)
    assert status == 200, f'GitHub auth failed: {res}'
    print('GitHub ProofID:', res.get('proof_id'))

    print('\n=== STEP 5: Web3 Wallet Sign-In ===')
    status, res = req('/auth/web3/', 'POST', {'address': '0x71C8364f3B731057434524F5374464a938Efe608'})
    print('Web3 status:', status)
    assert status == 200, f'Web3 auth failed: {res}'
    print('Web3 ProofID:', res.get('proof_id'))

    print('\n=== STEP 6: Add ID Proofs to Credential Vault ===')
    proofs = [
        ('DRIVING_LICENSE', 'California DMV', 'DL-CA-9938214'),
        ('PASSPORT', 'US State Dept / ICAO', 'P-093821094'),
        ('NATIONAL_ID', 'National ID Authority', 'NID-99201948'),
        ('VOTER_ID', 'Election Commission', 'VOTE-CA-28491'),
        ('TAX_ID', 'IRS Tax Registry', 'TAX-US-991823'),
        ('WORK_PERMIT', 'Immigration Authority', 'VISA-EAD-394821'),
    ]
    for cred_type, issuer, doc_id in proofs:
        status, res = req('/credentials/', 'POST', {
            'credential_type': cred_type,
            'issuer_name': issuer,
            'evidence_url': f'https://oracle.verify/{doc_id}',
            'notes': f'Cryptographically verified {cred_type}'
        }, token=google_token)
        print(f"  + Added {cred_type}: HTTP {status} (hash: {res.get('credential_hash', '')[:14]}...)")
        assert status in [200, 201], f"Failed to add {cred_type}: {res}"

    print('\n=== STEP 7: Vault Inspection ===')
    status, res = req('/credentials/', 'GET', token=google_token)
    creds = res.get('results', res)
    print(f"Total Vaulted Credentials: {len(creds)}")
    for c in creds:
        print(f"  * {c.get('credential_type_display')} -> {c.get('issuer_name')}")

    print('\n=== ALL 7 END-TO-END VALIDATION CHECKS PASSED SUCCESSFULLY! ===')

if __name__ == '__main__':
    main()
